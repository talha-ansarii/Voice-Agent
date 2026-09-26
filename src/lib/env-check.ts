import { prisma } from './prisma.js';
import { getGeminiApiKey, validateGeminiApiKey } from './gemini.js';

export interface EnvCheckResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

function isRecordingConfigured(): boolean {
  if (process.env.RECORDING_DISABLED === '1') return false;
  const accessKey =
    process.env.RECORDING_S3_ACCESS_KEY ?? process.env.SUPABASE_S3_ACCESS_KEY;
  const secret =
    process.env.RECORDING_S3_SECRET_KEY ?? process.env.SUPABASE_S3_SECRET_KEY;
  const endpoint =
    process.env.RECORDING_S3_ENDPOINT ?? process.env.SUPABASE_S3_ENDPOINT;
  return Boolean(accessKey && secret && endpoint);
}

export function checkEnv(): EnvCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const gemini = validateGeminiApiKey();
  if (!gemini.valid) {
    if (gemini.reason === 'missing') {
      errors.push(
        'GEMINI_API_KEY is not set — LLM replies and sentiment analysis will fail. Get a key at https://aistudio.google.com/app/apikey',
      );
    } else {
      errors.push(
        `GEMINI_API_KEY looks invalid (${gemini.reason}). Use a Google AI Studio key starting with "AIza", not a GCP project ID.`,
      );
    }
  }

  if (!process.env.DATABASE_URL?.trim()) {
    warnings.push(
      'DATABASE_URL is not set — call logs, leads, and caller history will not persist.',
    );
  } else if (process.env.DATABASE_URL.includes('-pooler')) {
    warnings.push(
      'DATABASE_URL uses a Neon pooler host — use the direct host (no -pooler).',
    );
  }

  if (process.env.TELEGRAM_DISABLED !== '1') {
    const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
    const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
    if (token && !chatId) {
      warnings.push('TELEGRAM_BOT_TOKEN is set but TELEGRAM_CHAT_ID is missing.');
    } else if (token && chatId && chatId === token.split(':')[0]) {
      warnings.push(
        'TELEGRAM_CHAT_ID looks like the bot token prefix — use your numeric chat ID from @userinfobot.',
      );
    }
  }

  if (process.env.RECORDING_DISABLED === '1') {
    warnings.push('RECORDING_DISABLED=1 — call recordings are off.');
  } else if (!isRecordingConfigured()) {
    warnings.push(
      'Recording S3 not configured — set RECORDING_S3_* or SUPABASE_S3_* env vars, or RECORDING_DISABLED=1.',
    );
  }

  if (!process.env.DEEPGRAM_API_KEY?.trim()) {
    warnings.push('DEEPGRAM_API_KEY is not set — required when stt_provider is deepgram.');
  }

  const pstn = outboundPstnStatus();
  if (!pstn.ready) {
    warnings.push(
      'Outbound PSTN is not fully configured — set OUTBOUND_TRUNK_ID, VOBIZ_SIP_DOMAIN, VOBIZ_USERNAME, VOBIZ_PASSWORD, and VOBIZ_OUTBOUND_NUMBER.',
    );
  }

  return { ok: errors.length === 0, warnings, errors };
}

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length < 8) return '';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function outboundPstnStatus() {
  const trunkId = (
    process.env.OUTBOUND_TRUNK_ID ||
    process.env.SIP_TRUNK_ID ||
    ''
  ).trim();
  const domain = (process.env.VOBIZ_SIP_DOMAIN ?? '').trim();
  const username = (process.env.VOBIZ_USERNAME ?? '').trim();
  const password = (process.env.VOBIZ_PASSWORD ?? '').trim();
  const fromNumber = (process.env.VOBIZ_OUTBOUND_NUMBER ?? '').trim();
  return {
    ready: Boolean(trunkId && domain && username && password && fromNumber),
    has_trunk: Boolean(trunkId),
    has_sip_credentials: Boolean(domain && username && password),
    from_number_masked: maskPhone(fromNumber),
  };
}

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.warn('[ENV] Database connection failed:', e);
    return false;
  }
}

export function logEnvCheck(label = 'AGENT'): void {
  const result = checkEnv();
  for (const err of result.errors) {
    console.error(`[ENV] ${label} ERROR: ${err}`);
  }
  for (const warn of result.warnings) {
    console.warn(`[ENV] ${label} WARN: ${warn}`);
  }
  if (result.ok && result.warnings.length === 0) {
    console.log(`[ENV] ${label} configuration looks good.`);
  }
}

export async function logEnvCheckWithDb(label = 'AGENT'): Promise<void> {
  logEnvCheck(label);
  if (process.env.DATABASE_URL?.trim()) {
    const connected = await checkDatabaseConnection();
    if (connected) {
      console.log(`[ENV] ${label} database connection OK.`);
    } else {
      console.error(
        `[ENV] ${label} ERROR: Cannot reach Neon/Postgres — verify DATABASE_URL (direct host, no -pooler).`,
      );
    }
  }
}
