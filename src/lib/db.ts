import type { CallLog } from '@prisma/client';
import { prisma } from './prisma.js';
import type { TenantScope } from './tenant.js';
import { tenantWhere } from './tenant.js';

function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Run a DB query; on failure log and return fallback so calls still work. */
async function safeDb<T>(
  fallback: T,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!dbConfigured()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.warn(`[DB] ${label} failed — continuing without database:`, e);
    return fallback;
  }
}

/** Max outbound dispatches per phone in the window. Set 0 to disable. */
const RATE_LIMIT_CALLS = Number(process.env.OUTBOUND_RATE_LIMIT_MAX ?? 50);
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.OUTBOUND_RATE_LIMIT_WINDOW_MS ?? 3600 * 1000,
);

export interface SaveCallLogInput {
  phone: string;
  duration: number;
  transcript: string;
  summary?: string;
  recordingUrl?: string;
  callerName?: string;
  sentiment?: string;
  estimatedCostUsd?: number;
  callDate?: Date;
  callHour?: number;
  callDayOfWeek?: string;
  wasBooked?: boolean;
  interruptCount?: number;
  callType?: string;
  userId?: string | null;
  agentId?: string | null;
}

export async function saveCallLog(input: SaveCallLogInput) {
  if (!process.env.DATABASE_URL) {
    console.log(`[DB] No DATABASE_URL — local log ${input.phone} ${input.duration}s`);
    return { success: false, message: 'DATABASE_URL not configured' };
  }
  try {
    const row = await prisma.callLog.create({
      data: {
        phoneNumber: input.phone,
        durationSeconds: input.duration,
        transcript: input.transcript,
        summary: input.summary ?? '',
        recordingUrl: input.recordingUrl || null,
        callerName: input.callerName || null,
        sentiment: input.sentiment ?? 'unknown',
        estimatedCostUsd: input.estimatedCostUsd ?? null,
        callDate: input.callDate ?? null,
        callHour: input.callHour ?? null,
        callDayOfWeek: input.callDayOfWeek ?? null,
        wasBooked: input.wasBooked ?? false,
        interruptCount: input.interruptCount ?? 0,
        callType: input.callType ?? 'unknown',
        userId: input.userId ?? null,
        agentId: input.agentId ?? null,
      },
    });
    return { success: true, data: row };
  } catch (e) {
    console.error('[DB] saveCallLog failed:', e);
    return { success: false, message: String(e) };
  }
}

export function serializeCallLog(row: CallLog) {
  return {
    id: row.id.toString(),
    created_at: row.createdAt.toISOString(),
    phone_number: row.phoneNumber,
    duration_seconds: row.durationSeconds,
    transcript: row.transcript,
    summary: row.summary,
    recording_url: row.recordingUrl,
    caller_name: row.callerName,
    sentiment: row.sentiment,
    estimated_cost_usd: row.estimatedCostUsd
      ? Number(row.estimatedCostUsd)
      : null,
    call_type: row.callType,
    was_booked: row.wasBooked,
    interrupt_count: row.interruptCount,
  };
}

export async function fetchCallLogs(limit = 50, scope?: TenantScope) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await prisma.callLog.findMany({
    where: scope ? tenantWhere(scope) : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(serializeCallLog);
}

export async function fetchBookings(scope?: TenantScope) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await prisma.callLog.findMany({
    where: {
      summary: { contains: 'Confirmed', mode: 'insensitive' },
      ...(scope ? tenantWhere(scope) : {}),
    },
    select: {
      id: true,
      phoneNumber: true,
      summary: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id.toString(),
    phone_number: r.phoneNumber,
    summary: r.summary,
    created_at: r.createdAt.toISOString(),
  }));
}

export async function fetchStats(scope?: TenantScope) {
  const empty = {
    total_calls: 0,
    total_bookings: 0,
    total_leads: 0,
    avg_duration: 0,
    booking_rate: 0,
    lead_rate: 0,
  };
  return safeDb(empty, 'fetchStats', async () => {
    const where = scope ? tenantWhere(scope) : undefined;
    const [rows, leadCount] = await Promise.all([
      prisma.callLog.findMany({
        where,
        select: { durationSeconds: true, summary: true },
      }),
      prisma.lead.count({ where }),
    ]);
    const total = rows.length;
    const bookings = rows.filter((r) =>
      (r.summary ?? '').includes('Confirmed'),
    ).length;
    const durations = rows
      .map((r) => r.durationSeconds)
      .filter((d): d is number => d != null);
    const avg = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    return {
      total_calls: total,
      total_bookings: bookings,
      total_leads: leadCount,
      avg_duration: avg,
      booking_rate: total ? Math.round((bookings / total) * 100) : 0,
      lead_rate: total ? Math.round((leadCount / total) * 100) : 0,
    };
  });
}

export async function getCallerHistory(phone: string): Promise<string> {
  if (!dbConfigured() || phone === 'unknown') return '';
  return safeDb('', 'getCallerHistory', async () => {
    const last = await prisma.callLog.findFirst({
      where: { phoneNumber: phone },
      orderBy: { createdAt: 'desc' },
      select: { summary: true, createdAt: true },
    });
    if (!last?.summary) return '';
    const date = last.createdAt.toISOString().slice(0, 10);
    return `\n\n[CALLER HISTORY: Last call ${date}. Summary: ${last.summary}]`;
  });
}

export function getOutboundRateLimitConfig() {
  return {
    maxCalls: RATE_LIMIT_CALLS,
    windowMs: RATE_LIMIT_WINDOW_MS,
    enabled: RATE_LIMIT_CALLS > 0 && !!process.env.DATABASE_URL,
  };
}

export async function isRateLimited(phone: string): Promise<boolean> {
  if (RATE_LIMIT_CALLS <= 0) return false;
  if (!dbConfigured() || phone === 'unknown' || phone === 'demo') return false;
  return safeDb(false, 'isRateLimited', async () => {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const count = await prisma.callLog.count({
      where: { phoneNumber: phone, createdAt: { gte: since } },
    });
    return count >= RATE_LIMIT_CALLS;
  });
}

export async function upsertActiveCall(data: {
  roomId: string;
  phone?: string;
  callerName?: string;
  status: string;
  callType?: string;
  userId?: string | null;
  agentId?: string | null;
}) {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.activeCall.upsert({
      where: { roomId: data.roomId },
      create: {
        roomId: data.roomId,
        phone: data.phone,
        callerName: data.callerName,
        status: data.status,
        callType: data.callType,
        lastUpdated: new Date(),
        userId: data.userId ?? null,
        agentId: data.agentId ?? null,
      },
      update: {
        phone: data.phone,
        callerName: data.callerName,
        status: data.status,
        callType: data.callType,
        lastUpdated: new Date(),
        userId: data.userId ?? undefined,
        agentId: data.agentId ?? undefined,
      },
    });
  } catch (e) {
    console.debug('[ACTIVE-CALL]', e);
  }
}

export async function insertTranscript(data: {
  callRoomId: string;
  phone: string;
  role: string;
  content: string;
  userId?: string | null;
  agentId?: string | null;
}) {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.callTranscript.create({
      data: {
        callRoomId: data.callRoomId,
        phone: data.phone,
        role: data.role,
        content: data.content,
        userId: data.userId ?? null,
        agentId: data.agentId ?? null,
      },
    });
  } catch (e) {
    console.debug('[TRANSCRIPT-STREAM]', e);
  }
}

export async function fetchContacts(scope?: TenantScope) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await prisma.callLog.findMany({
    where: scope ? tenantWhere(scope) : undefined,
    select: {
      phoneNumber: true,
      callerName: true,
      summary: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const contacts: Record<
    string,
    {
      phone_number: string;
      caller_name: string;
      total_calls: number;
      last_seen: string;
      is_booked: boolean;
    }
  > = {};
  for (const r of rows) {
    const phone = r.phoneNumber ?? 'unknown';
    if (!contacts[phone]) {
      contacts[phone] = {
        phone_number: phone,
        caller_name: r.callerName ?? '',
        total_calls: 0,
        last_seen: r.createdAt.toISOString(),
        is_booked: false,
      };
    }
    const c = contacts[phone];
    c.total_calls += 1;
    if (!c.caller_name && r.callerName) c.caller_name = r.callerName;
    if ((r.summary ?? '').includes('Confirmed')) c.is_booked = true;
  }
  return Object.values(contacts).sort((a, b) =>
    b.last_seen.localeCompare(a.last_seen),
  );
}

export async function getCallLogById(id: bigint, scope?: TenantScope) {
  return prisma.callLog.findFirst({
    where: { id, ...(scope ? tenantWhere(scope) : {}) },
  });
}

export interface SaveLeadInput {
  name: string;
  email: string;
  phone: string;
  requirements?: string;
  interestLevel?: string;
  source?: string;
  callRoomId?: string;
  userId?: string | null;
  agentId?: string | null;
}

export async function saveLead(input: SaveLeadInput) {
  if (!process.env.DATABASE_URL) {
    console.log(`[DB] No DATABASE_URL — local lead ${input.name} ${input.email}`);
    return { success: false, message: 'DATABASE_URL not configured' };
  }
  try {
    const row = await prisma.lead.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        requirements: input.requirements ?? '',
        interestLevel: input.interestLevel ?? 'medium',
        source: input.source ?? 'outbound_call',
        callRoomId: input.callRoomId || null,
        userId: input.userId ?? null,
        agentId: input.agentId ?? null,
      },
    });
    console.log(`[DB] Saved lead for ${input.name} (${input.email})`);
    return { success: true, data: row };
  } catch (e) {
    console.error('[DB] saveLead failed:', e);
    return { success: false, message: String(e) };
  }
}

export function serializeLead(row: {
  id: string;
  createdAt: Date;
  name: string | null;
  email: string | null;
  phone: string | null;
  requirements: string | null;
  interestLevel: string | null;
  source: string | null;
  callRoomId: string | null;
  status: string | null;
}) {
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    name: row.name,
    email: row.email,
    phone: row.phone,
    requirements: row.requirements,
    interest_level: row.interestLevel,
    source: row.source,
    call_room_id: row.callRoomId,
    status: row.status,
  };
}

export async function fetchLeads(
  limit = 200,
  status?: string,
  scope?: TenantScope,
) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await prisma.lead.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(scope ? tenantWhere(scope) : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(serializeLead);
}

export async function updateLead(
  id: string,
  data: { status?: string; interest_level?: string; requirements?: string },
  scope?: TenantScope,
) {
  if (!process.env.DATABASE_URL) {
    return { status: 'error', message: 'DATABASE_URL not configured' };
  }
  const update: Record<string, string> = {};
  if (data.status) update.status = data.status;
  if (data.interest_level) update.interestLevel = data.interest_level;
  if (data.requirements !== undefined) update.requirements = data.requirements;
  if (!Object.keys(update).length) {
    return { status: 'error', message: 'No valid fields' };
  }
  try {
    const existing = await prisma.lead.findFirst({
      where: { id, ...(scope ? tenantWhere(scope) : {}) },
    });
    if (!existing) {
      return { status: 'error', message: 'Lead not found' };
    }
    const row = await prisma.lead.update({ where: { id }, data: update });
    return { status: 'ok', data: serializeLead(row) };
  } catch (e) {
    console.error('[DB] updateLead failed:', e);
    return { status: 'error', message: String(e) };
  }
}

export async function fetchTranscripts(roomId: string, scope?: TenantScope) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await prisma.callTranscript.findMany({
    where: { callRoomId: roomId, ...(scope ? tenantWhere(scope) : {}) },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    call_room_id: r.callRoomId,
    phone: r.phone,
    role: r.role,
    content: r.content,
    created_at: r.createdAt.toISOString(),
  }));
}
