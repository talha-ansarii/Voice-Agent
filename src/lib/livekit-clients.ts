import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  SipClient,
} from 'livekit-server-sdk';

export function livekitApiHost(): string {
  const url = process.env.LIVEKIT_URL ?? '';
  return url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

function credentials() {
  const key = process.env.LIVEKIT_API_KEY ?? '';
  const secret = process.env.LIVEKIT_API_SECRET ?? '';
  if (!key || !secret) {
    throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET not configured');
  }
  return { host: livekitApiHost(), key, secret };
}

export function getSipClient(): SipClient {
  const { host, key, secret } = credentials();
  return new SipClient(host, key, secret);
}

export function getEgressClient(): EgressClient {
  const { host, key, secret } = credentials();
  return new EgressClient(host, key, secret);
}

export function getRoomClient(): RoomServiceClient {
  const { host, key, secret } = credentials();
  return new RoomServiceClient(host, key, secret);
}

/** Drop the SIP/PSTN leg and tear down the room. */
export async function hangupCall(
  roomName: string,
  participantIdentity: string | null,
): Promise<void> {
  if (!roomName) return;
  const room = getRoomClient();

  if (participantIdentity) {
    try {
      await room.removeParticipant(roomName, participantIdentity);
      console.log(`[END-CALL] Removed participant ${participantIdentity}`);
      return;
    } catch (e) {
      console.warn('[END-CALL] removeParticipant failed, trying SIP transfer:', e);
      try {
        const sip = getSipClient();
        await sip.transferSipParticipant(
          roomName,
          participantIdentity,
          'tel:+00000000',
          { playDialtone: false },
        );
        console.log('[END-CALL] SIP transfer hangup sent');
        return;
      } catch (transferErr) {
        console.warn('[END-CALL] SIP transfer failed:', transferErr);
      }
    }
  }

  try {
    await room.deleteRoom(roomName);
    console.log(`[END-CALL] Deleted room ${roomName}`);
  } catch (e) {
    console.warn('[END-CALL] deleteRoom failed:', e);
  }
}

function recordingS3Config(): {
  accessKey: string;
  secret: string;
  endpoint: string;
  bucket: string;
  region: string;
  publicUrlBase: string;
} | null {
  if (process.env.RECORDING_DISABLED === '1') return null;

  const accessKey =
    process.env.RECORDING_S3_ACCESS_KEY ?? process.env.SUPABASE_S3_ACCESS_KEY;
  const secret =
    process.env.RECORDING_S3_SECRET_KEY ?? process.env.SUPABASE_S3_SECRET_KEY;
  const endpoint =
    process.env.RECORDING_S3_ENDPOINT ?? process.env.SUPABASE_S3_ENDPOINT;
  if (!accessKey || !secret || !endpoint) return null;

  const bucket =
    process.env.RECORDING_S3_BUCKET ?? 'call-recordings';
  const region =
    process.env.RECORDING_S3_REGION ??
    process.env.SUPABASE_S3_REGION ??
    'ap-south-1';
  const publicUrlBase =
    process.env.RECORDING_PUBLIC_URL_BASE ??
    (process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}`
      : '');

  return { accessKey, secret, endpoint, bucket, region, publicUrlBase };
}

export function isRecordingEnabled(): boolean {
  return recordingS3Config() !== null;
}

export async function startRoomRecording(roomName: string): Promise<string | null> {
  const s3 = recordingS3Config();
  if (!s3) {
    console.warn(
      '[RECORDING] S3 not configured — set RECORDING_S3_* or SUPABASE_S3_* env vars, or RECORDING_DISABLED=1',
    );
    return null;
  }
  try {
    const egress = getEgressClient();
    const filepath = `recordings/${roomName}.ogg`;
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.OGG,
      filepath,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: s3.accessKey,
          secret: s3.secret,
          bucket: s3.bucket,
          region: s3.region,
          endpoint: s3.endpoint,
          forcePathStyle: true,
        }),
      },
    });
    const info = await egress.startRoomCompositeEgress(roomName, fileOutput, {
      audioOnly: true,
    });
    console.log(`[RECORDING] Started egress: ${info.egressId}`);
    return info.egressId ?? null;
  } catch (e) {
    console.warn('[RECORDING] Failed to start:', e);
    return null;
  }
}

export async function stopRoomRecording(
  egressId: string,
  roomName: string,
): Promise<string> {
  const s3 = recordingS3Config();
  try {
    const egress = getEgressClient();
    await egress.stopEgress(egressId);
    if (!s3?.publicUrlBase) {
      console.log('[RECORDING] Stopped (no public URL base configured).');
      return '';
    }
    const url = `${s3.publicUrlBase.replace(/\/$/, '')}/recordings/${roomName}.ogg`;
    console.log(`[RECORDING] Stopped. URL: ${url}`);
    return url;
  } catch (e) {
    console.warn('[RECORDING] Stop failed:', e);
    return '';
  }
}
