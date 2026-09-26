import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccessToken } from 'livekit-server-sdk';
import {
  createAgent,
  deleteAgent,
  getAgentConfigForUser,
  listAgents,
  mergeAgentConfig,
  updateAgent,
  upsertGoogleUser,
} from '../lib/agents.js';
import { CallType } from '../lib/call-types.js';
import { evaluateCallLogs } from '../lib/call-eval.js';
import { readConfig } from '../lib/config.js';
import {
  fetchBookings,
  fetchCallLogs,
  fetchContacts,
  fetchLeads,
  fetchStats,
  fetchTranscripts,
  getCallLogById,
  serializeCallLog,
  updateLead,
} from '../lib/db.js';
import { AGENT_NAME, dispatchCall, dispatchBulk } from '../lib/dispatch.js';
import {
  checkEnv,
  checkDatabaseConnection,
  outboundPstnStatus,
} from '../lib/env-check.js';
import {
  requireUserId,
  resolveTenant,
  type TenantScope,
} from '../lib/tenant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, '../../frontend');
const PORT = Number(process.env.PORT ?? 8000);

const app = express();

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-user-id, x-agent-id, Authorization',
  );
  next();
});
app.options(/.*/, (_req, res) => res.sendStatus(204));

app.use(express.json());

const metrics = {
  totalCalls: 0,
  totalBooked: 0,
  durations: [] as number[],
};

async function requireTenant(
  req: express.Request,
  res: express.Response,
): Promise<TenantScope | null> {
  const tenant = await resolveTenant(req);
  if (!tenant) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  req.tenant = tenant;
  return tenant;
}

app.post('/internal/auth/upsert-user', async (req, res) => {
  const expected = process.env.AUTH_SECRET ?? '';
  const auth = String(req.headers.authorization ?? '');
  if (!expected || auth !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const email = String(req.body?.email ?? '').trim();
    const googleId = String(req.body?.googleId ?? '').trim();
    const { user, agent } = await upsertGoogleUser({
      email,
      name: req.body?.name ?? null,
      image: req.body?.image ?? null,
      googleId,
    });
    res.json({ userId: user.id, agentId: agent.id, email: user.email });
  } catch (e) {
    console.error('[AUTH] upsert-user failed:', e);
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get('/api/agents', async (req, res) => {
  const userId = await requireUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    res.json(await listAgents(userId));
  } catch (e) {
    console.error('Error listing agents:', e);
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/agents', async (req, res) => {
  const userId = await requireUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const agent = await createAgent(userId, String(req.body?.name ?? 'New agent'));
    res.json(agent);
  } catch (e) {
    console.error('Error creating agent:', e);
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/api/agents/:id', async (req, res) => {
  const userId = await requireUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const updated = await updateAgent(userId, req.params.id, {
    name: req.body?.name,
  });
  if (!updated) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(updated);
});

app.delete('/api/agents/:id', async (req, res) => {
  const userId = await requireUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const result = await deleteAgent(userId, req.params.id);
  if (!result.ok) {
    res.status(400).json({ error: result.message });
    return;
  }
  res.json({ status: 'ok' });
});

app.get('/api/config', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  const config = await getAgentConfigForUser(tenant.userId, tenant.agentId);
  res.json(config ?? readConfig());
});

app.post('/api/config', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  const config = await mergeAgentConfig(
    tenant.userId,
    tenant.agentId,
    req.body ?? {},
  );
  if (!config) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  console.log('Agent configuration updated via UI.');
  res.json({ status: 'success' });
});

app.get('/api/logs', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    res.json(await fetchCallLogs(50, tenant));
  } catch (e) {
    console.error('Error fetching logs:', e);
    res.json([]);
  }
});

app.get('/api/logs/:logId/transcript', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    const row = await getCallLogById(BigInt(req.params.logId), tenant);
    if (!row) {
      res.status(404).type('text/plain').send('Log not found');
      return;
    }
    const s = serializeCallLog(row);
    const text =
      `Call Log — ${s.created_at}\n` +
      `Phone: ${s.phone_number ?? 'Unknown'}\n` +
      `Duration: ${s.duration_seconds ?? 0}s\n` +
      `Summary: ${s.summary ?? ''}\n\n` +
      `--- TRANSCRIPT ---\n` +
      (s.transcript ?? 'No transcript available.');
    res
      .type('text/plain')
      .setHeader(
        'Content-Disposition',
        `attachment; filename=transcript_${req.params.logId}.txt`,
      )
      .send(text);
  } catch (e) {
    res.status(500).type('text/plain').send(`Error: ${e}`);
  }
});

app.get('/api/bookings', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    res.json(await fetchBookings(tenant));
  } catch (e) {
    console.error('Error fetching bookings:', e);
    res.json([]);
  }
});

app.get('/api/stats', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    const stats = await fetchStats(tenant);
    res.json({
      total_calls: stats.total_calls,
      total_bookings: stats.total_bookings,
      total_leads: stats.total_leads,
      avg_duration: stats.avg_duration,
      booking_rate: stats.booking_rate,
      lead_rate: stats.lead_rate,
    });
  } catch (e) {
    res.json({
      total_calls: 0,
      total_bookings: 0,
      total_leads: 0,
      avg_duration: 0,
      booking_rate: 0,
      lead_rate: 0,
    });
  }
});

app.get('/api/contacts', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    res.json(await fetchContacts(tenant));
  } catch (e) {
    console.error('Error fetching contacts:', e);
    res.json([]);
  }
});

app.get('/api/leads', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json(await fetchLeads(200, status, tenant));
  } catch (e) {
    console.error('Error fetching leads:', e);
    res.json([]);
  }
});

app.patch('/api/leads/:leadId', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  const result = await updateLead(req.params.leadId, req.body ?? {}, tenant);
  if (result.status === 'ok') {
    res.json(result);
    return;
  }
  res.status(400).json(result);
});

app.get('/api/transcripts/:roomId', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    res.json(await fetchTranscripts(req.params.roomId, tenant));
  } catch (e) {
    console.error('Error fetching transcripts:', e);
    res.json([]);
  }
});

app.get('/api/outbound/status', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  res.json(outboundPstnStatus());
});

app.post('/api/call/single', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  const phone = String(req.body?.phone ?? '').trim();
  if (!phone.startsWith('+')) {
    res.json({
      status: 'error',
      message: 'Phone number must start with + and country code',
    });
    return;
  }
  try {
    const result = await dispatchCall(phone, CallType.OUTBOUND, undefined, tenant);
    if (result.status === 'ok') {
      res.json({
        status: 'ok',
        dispatch_id: result.dispatchId,
        room: result.room,
        phone: result.phone,
      });
      return;
    }
    res.json({ status: 'error', message: result.message });
  } catch (e) {
    console.error('Outbound dispatch failed:', e);
    res.status(500).json({
      status: 'error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post('/api/call/bulk', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  const numbers = String(req.body?.numbers ?? '')
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);
  const results = await dispatchBulk(numbers, tenant);
  res.json({ results, total: results.length });
});

app.get('/api/demo-token', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  const config = (await getAgentConfigForUser(tenant.userId, tenant.agentId)) ??
    readConfig();
  const apiKey = process.env.LIVEKIT_API_KEY ?? '';
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? '';
  const livekitUrl =
    String(config.livekit_url || process.env.LIVEKIT_URL || '');

  if (!apiKey || !apiSecret) {
    res.json({ error: 'LiveKit API credentials not configured in .env' });
    return;
  }

  const result = await dispatchCall('demo', CallType.DEMO, undefined, tenant);
  if (result.status !== 'ok' || !result.room) {
    res.json({ error: result.message ?? 'Dispatch failed' });
    return;
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: 'demo-user',
    name: 'Demo Caller',
    ttl: 3600,
  });
  token.addGrant({
    roomJoin: true,
    room: result.room,
    canPublish: true,
    canSubscribe: true,
  });
  const jwt = await token.toJwt();

  res.json({ token: jwt, room: result.room, url: livekitUrl });
});

app.post('/internal/record-call', (req, res) => {
  metrics.totalCalls += 1;
  if (req.body?.booked) metrics.totalBooked += 1;
  if (req.body?.duration) metrics.durations.push(Number(req.body.duration));
  res.json({ ok: true });
});

app.get('/metrics', (_req, res) => {
  const avg =
    metrics.durations.length > 0
      ? metrics.durations.reduce((a, b) => a + b, 0) /
        metrics.durations.length
      : 0;
  const lines = [
    '# HELP voice_calls_total Total calls handled',
    '# TYPE voice_calls_total counter',
    `voice_calls_total ${metrics.totalCalls}`,
    '# HELP voice_calls_booked_total Calls with booking',
    '# TYPE voice_calls_booked_total counter',
    `voice_calls_booked_total ${metrics.totalBooked}`,
    '# HELP voice_call_duration_seconds_avg Average call duration',
    '# TYPE voice_call_duration_seconds_avg gauge',
    `voice_call_duration_seconds_avg ${avg.toFixed(2)}`,
  ];
  res.type('text/plain; version=0.0.4; charset=utf-8').send(lines.join('\n') + '\n');
});

app.get('/health', async (_req, res) => {
  const env = checkEnv();
  const dbOk = await checkDatabaseConnection();
  res.json({
    status: env.ok && (dbOk || !process.env.DATABASE_URL) ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'rapidx-ai-voice-agent',
    agent: AGENT_NAME,
    runtime: 'node',
    env_errors: env.errors,
    env_warnings: env.warnings,
    database_connected: dbOk,
  });
});

app.get('/api/eval', async (req, res) => {
  const tenant = await requireTenant(req, res);
  if (!tenant) return;
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    res.json(await evaluateCallLogs(limit, tenant));
  } catch (e) {
    console.error('Error running call eval:', e);
    res.status(500).json({ error: String(e) });
  }
});

app.get('/demo', (_req, res) => {
  res.sendFile(path.join(FRONTEND, 'demo.html'));
});

app.get('/', (_req, res) => {
  res.json({
    service: 'Voice Agent API',
    dashboard: 'Next.js dashboard — npm run dashboard (port 3001)',
    health: '/health',
    demo: '/demo',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const env = checkEnv();
  for (const err of env.errors) console.error(`[ENV] SERVER ERROR: ${err}`);
  for (const warn of env.warnings) console.warn(`[ENV] SERVER WARN: ${warn}`);
  console.log(`[UI] Dashboard http://0.0.0.0:${PORT}`);
});
