import { AgentDispatchClient } from 'livekit-server-sdk';
import { CallType } from './call-types.js';
import { readConfig } from './config.js';
import { getOutboundRateLimitConfig, isRateLimited } from './db.js';

export const AGENT_NAME = 'outbound-caller';
const BULK_CONCURRENCY = Number(process.env.OUTBOUND_BULK_CONCURRENCY ?? 10);

export interface DispatchResult {
  status: 'ok' | 'error';
  dispatchId?: string;
  room?: string;
  phone?: string;
  message?: string;
}

function livekitCredentials() {
  const cfg = readConfig();
  const url = String(cfg.livekit_url || process.env.LIVEKIT_URL || '');
  const key = process.env.LIVEKIT_API_KEY || '';
  const secret = process.env.LIVEKIT_API_SECRET || '';
  if (!key) throw new Error('LIVEKIT_API_KEY not configured in .env');
  if (!secret) throw new Error('LIVEKIT_API_SECRET not configured in .env');
  return { url, key, secret };
}

function roomName(phone: string, callType: CallType): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const clean = phone.replace(/\+/g, '').replace(/\s/g, '');
  if (callType === CallType.DEMO) {
    return `demo-${Math.floor(10000 + Math.random() * 90000)}`;
  }
  const prefix = callType === CallType.OUTBOUND ? 'call' : callType;
  return `${prefix}-${clean}-${suffix}`;
}

export type DispatchTenant = {
  userId?: string;
  agentId?: string;
};

export async function dispatchCall(
  phone: string,
  callType: CallType = CallType.OUTBOUND,
  existingClient?: AgentDispatchClient,
  tenant?: DispatchTenant,
): Promise<DispatchResult> {
  if (callType === CallType.OUTBOUND && (await isRateLimited(phone))) {
    const { maxCalls, windowMs } = getOutboundRateLimitConfig();
    const windowMin = Math.round(windowMs / 60_000);
    return {
      status: 'error',
      phone,
      message: `Rate limited: max ${maxCalls} calls per ${windowMin} min to this number`,
    };
  }

  const { url, key, secret } = livekitCredentials();
  const ownClient = !existingClient;
  const client =
    existingClient ?? new AgentDispatchClient(url, key, secret);

  const room = roomName(phone, callType);
  const metadata = JSON.stringify({
    phone_number: phone,
    call_type: callType,
    is_demo: callType === CallType.DEMO,
    userId: tenant?.userId,
    agentId: tenant?.agentId,
  });

  try {
    const dispatch = await client.createDispatch(room, AGENT_NAME, {
      metadata,
    });
    console.log(`Dispatched ${callType} → ${phone}: ${dispatch.id}`);
    return { status: 'ok', dispatchId: dispatch.id, room, phone };
  } catch (e) {
    console.error('Dispatch error:', e);
    return { status: 'error', phone, message: String(e) };
  }
}

export async function dispatchBulk(
  numbers: string[],
  tenant?: DispatchTenant,
) {
  const { url, key, secret } = livekitCredentials();
  const client = new AgentDispatchClient(url, key, secret);
  const results: Array<Record<string, string | undefined>> = [];

  async function one(phone: string) {
    if (!phone.startsWith('+')) {
      return { phone, status: 'error', message: 'Must start with +' };
    }
    const r = await dispatchCall(phone, CallType.OUTBOUND, client, tenant);
    if (r.status === 'ok') {
      return { phone, status: 'ok', dispatch_id: r.dispatchId ?? '' };
    }
    return { phone, status: 'error', message: r.message ?? 'unknown' };
  }

  for (let i = 0; i < numbers.length; i += BULK_CONCURRENCY) {
    const chunk = numbers.slice(i, i + BULK_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map((n) => one(n.trim())));
    results.push(...chunkResults);
  }
  return results;
}
