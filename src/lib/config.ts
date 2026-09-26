import fs from 'node:fs';
import path from 'node:path';
import { CallType } from './call-types.js';

const CONFIG_FILE = 'config.json';
const SECRET_KEYS = new Set([
  'livekit_api_key',
  'livekit_api_secret',
  'openai_api_key',
  'gemini_api_key',
  'google_api_key',
  'sarvam_api_key',
  'cal_api_key',
  'telegram_bot_token',
  'supabase_key',
]);

let configCache: Record<string, unknown> | null = null;
let configMtime = 0;

function loadConfigFile(): Record<string, unknown> {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  const mtime = fs.statSync(CONFIG_FILE).mtimeMs;
  if (configCache && mtime === configMtime) return configCache;
  configCache = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  configMtime = mtime;
  return configCache!;
}

export interface LiveConfig {
  agent_instructions: string;
  stt_min_endpointing_delay: number;
  stt_endpointing_ms: number;
  stt_eot_timeout_ms: number;
  stt_deepgram_version: string;
  stt_model: string;
  stt_language_hints: string[];
  stt_keyterms: string[];
  stt_eager_eot_threshold: number | null;
  stt_eot_threshold: number | null;
  stt_prompt: string;
  stt_mode: string;
  llm_model: string;
  llm_provider: string;
  llm_max_output_tokens: number;
  llm_temperature: number;
  tts_model: string;
  tts_voice: string;
  tts_language: string;
  tts_provider: string;
  tts_sample_rate: number;
  tts_pace: number;
  tts_enable_preprocessing: boolean;
  stt_provider: string;
  stt_language: string;
  lang_preset: string;
  max_turns: number;
  first_line: string;
  first_line_inbound: string;
  first_line_outbound: string;
  agent_instructions_inbound: string;
  agent_instructions_outbound: string;
  sip_trunk_id: string;
  preemptive_generation: boolean;
  preemptive_tts: boolean;
  [key: string]: unknown;
}

export function liveConfigFromRecord(
  config: Record<string, unknown>,
): LiveConfig {
  const safe = Object.fromEntries(
    Object.entries(config).filter(([k]) => !SECRET_KEYS.has(k)),
  );

  return {
    agent_instructions: String(safe.agent_instructions ?? ''),
    stt_min_endpointing_delay: Number(safe.stt_min_endpointing_delay ?? 0.2),
    stt_endpointing_ms: Number(safe.stt_endpointing_ms ?? 25),
    stt_eot_timeout_ms: Number(safe.stt_eot_timeout_ms ?? 2500),
    stt_deepgram_version: String(safe.stt_deepgram_version ?? 'v2'),
    stt_model: String(safe.stt_model ?? 'saaras:v3'),
    stt_language_hints: Array.isArray(safe.stt_language_hints)
      ? safe.stt_language_hints.map(String)
      : [],
    stt_keyterms: Array.isArray(safe.stt_keyterms)
      ? safe.stt_keyterms.map(String)
      : [],
    stt_eager_eot_threshold:
      safe.stt_eager_eot_threshold != null
        ? Number(safe.stt_eager_eot_threshold)
        : null,
    stt_eot_threshold:
      safe.stt_eot_threshold != null ? Number(safe.stt_eot_threshold) : null,
    stt_prompt: String(safe.stt_prompt ?? ''),
    stt_mode: String(safe.stt_mode ?? 'transcribe'),
    llm_model: String(safe.llm_model ?? 'gemini-2.5-flash'),
    llm_provider: String(safe.llm_provider ?? 'gemini'),
    llm_max_output_tokens: Number(safe.llm_max_output_tokens ?? 150),
    llm_temperature: Number(safe.llm_temperature ?? 0.5),
    tts_model: String(safe.tts_model ?? 'bulbul:v3'),
    tts_voice: String(safe.tts_voice ?? 'kavya'),
    tts_language: String(safe.tts_language ?? 'hi-IN'),
    tts_provider: String(safe.tts_provider ?? 'sarvam'),
    tts_sample_rate: Number(safe.tts_sample_rate ?? 24000),
    tts_pace: Number(safe.tts_pace ?? 1),
    tts_enable_preprocessing: safe.tts_enable_preprocessing !== false,
    stt_provider: String(safe.stt_provider ?? 'sarvam'),
    stt_language: String(safe.stt_language ?? 'hi-IN'),
    lang_preset: String(safe.lang_preset ?? 'multilingual'),
    max_turns: Number(safe.max_turns ?? 25),
    first_line: String(safe.first_line ?? ''),
    first_line_inbound: String(safe.first_line_inbound ?? ''),
    first_line_outbound: String(safe.first_line_outbound ?? ''),
    agent_instructions_inbound: String(safe.agent_instructions_inbound ?? ''),
    agent_instructions_outbound: String(safe.agent_instructions_outbound ?? ''),
    sip_trunk_id: String(safe.sip_trunk_id ?? ''),
    preemptive_generation: safe.preemptive_generation !== false,
    preemptive_tts: safe.preemptive_tts === true,
    ...safe,
  };
}

export function getLiveConfig(phoneNumber?: string | null): LiveConfig {
  let config: Record<string, unknown> = {};
  const paths: string[] = [];
  if (phoneNumber && phoneNumber !== 'unknown' && phoneNumber !== 'demo') {
    const clean = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
    paths.push(path.join('configs', `${clean}.json`));
  }
  paths.push(path.join('configs', 'default.json'), CONFIG_FILE);

  for (const p of paths) {
    if (fs.existsSync(p)) {
      config = JSON.parse(fs.readFileSync(p, 'utf-8'));
      console.log(`[CONFIG] Loaded: ${p}`);
      break;
    }
  }
  if (Object.keys(config).length === 0) config = loadConfigFile();
  return liveConfigFromRecord(config);
}

/** Disk template for new agents — not written by the Settings UI. */
export function defaultAgentConfigTemplate(): Record<string, unknown> {
  return { ...loadConfigFile() };
}

/** Map lang_preset to Sarvam TTS language when tts_language is not explicitly overridden. */
export function resolveTtsLanguage(
  langPreset: string,
  explicitLanguage?: string,
): string {
  if (explicitLanguage && explicitLanguage !== 'auto') return explicitLanguage;
  switch (langPreset) {
    case 'hindi':
      return 'hi-IN';
    case 'english':
    case 'hinglish':
      return 'en-IN';
    default:
      return 'en-IN';
  }
}

export function applyLanguageAlignedConfig(cfg: LiveConfig): LiveConfig {
  const out = { ...cfg };
  const explicit = cfg.tts_language as string | undefined;
  const useAuto = !explicit || explicit === 'auto';
  if (useAuto) {
    out.tts_language = resolveTtsLanguage(out.lang_preset);
  }
  if (!out.stt_prompt && out.lang_preset === 'hinglish') {
    out.stt_prompt =
      'Sales call. Indian English and Hindi mixed speech. Names, email addresses, phone numbers, business types.';
  }
  return out;
}

export function applyConfigForCallType(
  cfg: LiveConfig,
  callType: CallType,
): LiveConfig {
  let out = { ...cfg };
  if (callType === CallType.INBOUND) {
    if (out.agent_instructions_inbound)
      out.agent_instructions = out.agent_instructions_inbound;
    if (out.first_line_inbound) out.first_line = out.first_line_inbound;
  } else if (callType === CallType.OUTBOUND) {
    if (out.agent_instructions_outbound)
      out.agent_instructions = out.agent_instructions_outbound;
    if (out.first_line_outbound) out.first_line = out.first_line_outbound;
  }
  return applyLanguageAlignedConfig(out);
}

const LANGUAGE_PRESETS: Record<string, string> = {
  hinglish:
    'Speak in natural Hinglish — mix Hindi and English like educated Indians do.',
  hindi: 'Speak only in pure Hindi.',
  english: 'Speak only in Indian English with a warm, professional tone.',
  multilingual:
    "Detect the caller's language and reply in that same language for the entire call.",
};

export function getLanguageInstruction(langPreset: string): string {
  const instruction =
    LANGUAGE_PRESETS[langPreset] ?? LANGUAGE_PRESETS.multilingual;
  return `\n\n[LANGUAGE DIRECTIVE]\n${instruction}`;
}

/** Hard limits for PSTN calls — keeps TTS latency low and avoids cut-off monologues. */
export function getTelephonyReplyRules(): string {
  return (
    '\n\n[PHONE CALL RULES — MANDATORY]\n' +
    '- ONE sentence per reply, max 18 words.\n' +
    '- Never list features or give a pitch longer than one sentence.\n' +
    '- Ask one question at a time, then stop and listen.\n' +
    '- If the caller says hello/yes/haan/ji, respond briefly and move to the next step.\n' +
    '- Before save_lead: repeat email letter-by-letter and phone digit-by-digit; get explicit yes.\n' +
    '- Never invent contact details.\n' +
    '- When caller is not interested or says goodbye: one short farewell, then call end_call immediately.'
  );
}

export function getIstTimeContext(): string {
  const ist = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
  );
  const todayStr = ist.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = ist.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `\n\n[SYSTEM CONTEXT]\nCurrent date & time: ${todayStr} at ${timeStr} IST\nAlways use ISO dates when calling save_booking_intent. Appointments in IST (+05:30).]`;
}

export function readConfig(): Record<string, unknown> {
  const config = loadConfigFile();
  const safe = Object.fromEntries(
    Object.entries(config).filter(([k]) => !SECRET_KEYS.has(k)),
  );
  const get = (key: string, env: string, def = '') =>
    safe[key] != null && safe[key] !== ''
      ? safe[key]
      : process.env[env] ?? def;

  return {
    ...safe,
    first_line: get('first_line', 'FIRST_LINE'),
    livekit_url: get('livekit_url', 'LIVEKIT_URL'),
    sip_trunk_id:
      get('sip_trunk_id', 'OUTBOUND_TRUNK_ID') || get('sip_trunk_id', 'SIP_TRUNK_ID'),
    stt_min_endpointing_delay: Number(
      get('stt_min_endpointing_delay', 'STT_MIN_ENDPOINTING_DELAY') || 0.2,
    ),
  };
}

export function writeConfig(data: Record<string, unknown>): void {
  const config = loadConfigFile();
  for (const [k, v] of Object.entries(data)) {
    if (!SECRET_KEYS.has(k)) config[k] = v;
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  configCache = config;
  configMtime = fs.statSync(CONFIG_FILE).mtimeMs;
}
