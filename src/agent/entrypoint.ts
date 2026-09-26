import { defineAgent, type JobContext } from '@livekit/agents';
import { RoomEvent } from '@livekit/rtc-node';
import { loadAgentConfigRecord } from '../lib/agents.js';
import {
  applyConfigForCallType,
  getLiveConfig,
  liveConfigFromRecord,
} from '../lib/config.js';
import {
  CallType,
  detectCallType,
  parseJobMetadata,
  resolveSipParticipant,
} from '../lib/call-types.js';
import {
  getCallerHistory,
  insertTranscript,
  upsertActiveCall,
} from '../lib/db.js';
import { AGENT_NAME } from '../lib/dispatch.js';
import { getSipClient, startRoomRecording } from '../lib/livekit-clients.js';
import { notifyAgentError } from '../lib/notify.js';
import { VoiceAssistant } from './assistant.js';
import { createCallLifecycle } from './call-lifecycle.js';
import { registerSessionEvents, getAvgTurnLatencyMs } from './events.js';
import { makeShutdownHook } from './post-call.js';
import {
  buildRoomInputOptions,
  buildSession,
} from './pipeline.js';
import { createAgentTools, type AgentToolsState } from './tools.js';

function extractCallerInfo(
  ctx: JobContext,
  metadata: ReturnType<typeof parseJobMetadata>,
) {
  let phoneNumber = metadata.phone_number;
  let callerName = '';

  for (const [, participant] of ctx.room.remoteParticipants) {
    if (
      participant.name &&
      participant.name !== 'Caller' &&
      participant.name !== 'Unknown'
    ) {
      callerName = participant.name;
    }
    if (!phoneNumber) {
      const attrs = participant.attributes;
      phoneNumber =
        attrs['sip.phoneNumber'] ?? attrs.phoneNumber ?? phoneNumber;
    }
    if (!phoneNumber && participant.identity.includes('+')) {
      const m = participant.identity.match(/\+\d{7,15}/);
      if (m) phoneNumber = m[0];
    }
  }

  const callerPhone = phoneNumber ?? 'unknown';
  return { phoneNumber, callerName, callerPhone };
}

async function dialOutbound(
  ctx: JobContext,
  phoneNumber: string,
  liveConfig: ReturnType<typeof getLiveConfig>,
): Promise<string | null> {
  const trunkId =
    process.env.OUTBOUND_TRUNK_ID ||
    process.env.SIP_TRUNK_ID ||
    liveConfig.sip_trunk_id ||
    '';
  if (!trunkId) {
    console.error(
      '[OUTBOUND] OUTBOUND_TRUNK_ID / SIP_TRUNK_ID / sip_trunk_id not configured',
    );
    return null;
  }
  const identity = `sip_${phoneNumber.replace(/\+/g, '')}`;
  try {
    const sip = getSipClient();
    const fromNumber = (process.env.VOBIZ_OUTBOUND_NUMBER ?? '').trim();
    await sip.createSipParticipant(trunkId, phoneNumber, ctx.room.name ?? '', {
      participantIdentity: identity,
      participantName: 'Callee',
      waitUntilAnswered: true,
      playDialtone: true,
      ...(fromNumber ? { fromNumber } : {}),
    });
    console.log(`[OUTBOUND] Connected to ${phoneNumber} as ${identity}`);
    return identity;
  } catch (e) {
    console.error('[OUTBOUND] Dial failed:', e);
    const maybeErr = e as {
      status?: number;
      code?: string;
      metadata?: { sip_status?: string; sip_status_code?: string };
    };
    const sipCode = maybeErr.metadata?.sip_status_code;
    const sipStatus = maybeErr.metadata?.sip_status;
    if (sipCode === '486' || sipStatus === 'Busy Here') {
      console.error(
        '[OUTBOUND] Callee busy (SIP 486). End other calls on that phone and retry in 30–60s.',
      );
    } else if (maybeErr?.status === 404 || maybeErr?.code === 'not_found') {
      console.error(
        `[OUTBOUND] LiveKit could not find SIP trunk "${trunkId}". Verify the trunk exists in the same LiveKit project as LIVEKIT_API_KEY/LIVEKIT_API_SECRET.`,
      );
    }
    return null;
  }
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`[ROOM] Connected: ${ctx.room.name}`);

    const metadata = parseJobMetadata(ctx.job.metadata ?? '');
    const callType = detectCallType(ctx, metadata);
    console.log(`[CALL] Type: ${callType}`);

    let { phoneNumber, callerName, callerPhone } = extractCallerInfo(
      ctx,
      metadata,
    );

    const stored =
      metadata.agentId
        ? await loadAgentConfigRecord(metadata.agentId, metadata.userId)
        : null;
    let liveConfig = stored
      ? liveConfigFromRecord(stored)
      : getLiveConfig(callerPhone);
    liveConfig = applyConfigForCallType(liveConfig, callType);

    const history = await getCallerHistory(callerPhone);
    if (history) {
      liveConfig.agent_instructions += history;
    }

    const toolsState: AgentToolsState = {
      callerPhone,
      callerName,
      roomName: ctx.room.name ?? '',
      sipIdentity: null,
      bookingIntent: null,
      leadSaved: null,
      userId: metadata.userId,
      agentId: metadata.agentId,
    };

    const deferGreeting = callType === CallType.OUTBOUND;

    if (callType === CallType.OUTBOUND) {
      if (!phoneNumber?.startsWith('+')) {
        console.error('[OUTBOUND] Invalid phone in metadata');
        return;
      }
      const sipIdentity = await dialOutbound(ctx, phoneNumber, liveConfig);
      if (!sipIdentity) {
        notifyAgentError(callerPhone, 'Outbound dial failed or no answer');
        await upsertActiveCall({
          roomId: ctx.room.name ?? '',
          phone: callerPhone,
          status: 'no_answer',
          callType,
          userId: metadata.userId ?? null,
          agentId: metadata.agentId ?? null,
        });
        return;
      }
      toolsState.sipIdentity = sipIdentity;
      const participant = resolveSipParticipant(ctx);
      if (participant) toolsState.sipIdentity = participant.identity;
    } else {
      const participant = resolveSipParticipant(ctx);
      if (participant) {
        toolsState.sipIdentity = participant.identity;
        const attrs = participant.attributes;
        if (!phoneNumber) {
          phoneNumber =
            attrs['sip.phoneNumber'] ?? attrs.phoneNumber ?? phoneNumber;
          callerPhone = phoneNumber ?? callerPhone;
          toolsState.callerPhone = callerPhone;
        }
      } else if (callType === CallType.DEMO) {
        toolsState.sipIdentity = null;
      } else {
        toolsState.sipIdentity = 'inbound_caller';
      }
    }

    const session = buildSession(liveConfig);
    const callLifecycle = createCallLifecycle({
      session,
      ctx,
      roomName: ctx.room.name ?? '',
      sipIdentity: toolsState.sipIdentity,
    });

    const tools = createAgentTools(toolsState, callLifecycle);
    const agent = new VoiceAssistant({
      tools,
      liveConfig,
      deferGreeting,
    });

    await session.start({
      agent,
      room: ctx.room,
      inputOptions: buildRoomInputOptions(),
    });

    if (deferGreeting) {
      await agent.speakGreeting();
    }

    const callStartTime = new Date();
    const egressId = await startRoomRecording(ctx.room.name ?? '');

    const logTranscript = async (role: string, content: string) => {
      await insertTranscript({
        callRoomId: ctx.room.name ?? '',
        phone: callerPhone,
        role,
        content,
        userId: metadata.userId ?? null,
        agentId: metadata.agentId ?? null,
      });
    };

    const sessionState = {
      agentIsSpeaking: false,
      interruptCount: 0,
      turnCount: 0,
      maxTurns: liveConfig.max_turns,
      lastFinalTranscriptAt: null as number | null,
      turnLatenciesMs: [] as number[],
      sttProvider: liveConfig.stt_provider.toLowerCase(),
      pendingHangup: false,
      logTranscript,
      onCallerHangup: () => {
        void callLifecycle.terminateCall('caller goodbye');
      },
    };

    registerSessionEvents(session, sessionState);

    await upsertActiveCall({
      roomId: ctx.room.name ?? '',
      phone: callerPhone,
      callerName,
      status: 'active',
      callType,
      userId: metadata.userId ?? null,
      agentId: metadata.agentId ?? null,
    });

    ctx.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log(`[HANGUP] Disconnected: ${participant.identity}`);
      sessionState.agentIsSpeaking = false;
      if (!callLifecycle.isEnding()) {
        void callLifecycle.terminateCall('participant disconnected');
      }
    });

    const shutdownState = {
      ctx,
      agent,
      toolsState,
      callerPhone,
      callStartTime,
      egressId,
      get interruptCount() {
        return sessionState.interruptCount;
      },
      get avgTurnLatencyMs() {
        return getAvgTurnLatencyMs(sessionState);
      },
      ttsVoice: liveConfig.tts_voice,
      callType,
      shutdownDone: false,
    };

    ctx.addShutdownCallback(makeShutdownHook(shutdownState));

    console.log(`[AGENT] Session live — ${callType} (${AGENT_NAME})`);
  },
});
