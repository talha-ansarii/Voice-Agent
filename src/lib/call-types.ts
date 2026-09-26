import type { JobContext } from '@livekit/agents';

export enum CallType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  DEMO = 'demo',
}

export interface JobMetadata {
  phone_number?: string;
  call_type?: string;
  is_demo?: boolean;
  userId?: string;
  agentId?: string;
}

export function parseJobMetadata(raw: string): JobMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JobMetadata;
  } catch {
    return {};
  }
}

export function hasSipParticipant(ctx: JobContext): boolean {
  for (const p of ctx.room.remoteParticipants.values()) {
    const identity = p.identity ?? '';
    const attrs = p.attributes ?? {};
    if (
      identity.startsWith('sip_') ||
      attrs['sip.phoneNumber'] ||
      attrs.phoneNumber
    ) {
      return true;
    }
  }
  return false;
}

export function detectCallType(ctx: JobContext, metadata: JobMetadata): CallType {
  if (metadata.call_type) {
    const v = metadata.call_type as CallType;
    if (Object.values(CallType).includes(v)) return v;
  }
  if (metadata.phone_number === 'demo' || metadata.is_demo) return CallType.DEMO;
  if (hasSipParticipant(ctx)) return CallType.INBOUND;
  if (metadata.phone_number?.startsWith('+')) return CallType.OUTBOUND;
  return CallType.INBOUND;
}

export function resolveSipParticipant(ctx: JobContext) {
  for (const p of ctx.room.remoteParticipants.values()) {
    const identity = p.identity ?? '';
    const attrs = p.attributes ?? {};
    if (
      identity.startsWith('sip_') ||
      attrs['sip.phoneNumber'] ||
      attrs.phoneNumber
    ) {
      return p;
    }
  }
  return undefined;
}
