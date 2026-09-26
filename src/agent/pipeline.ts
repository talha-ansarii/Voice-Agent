import { voice } from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import * as sarvam from '@livekit/agents-plugin-sarvam';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import type { LiveConfig } from '../lib/config.js';
import { getGeminiApiKey, resolveGeminiModel } from '../lib/gemini.js';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function sarvamLanguageCode(language: string): string {
  if (language === 'multi') return 'unknown';
  return language;
}

const DEFAULT_KEYTERMS = [
  'automation',
  'web app',
  'AI agent',
  'lead',
  'email',
];

export function buildLlm(liveConfig: LiveConfig) {
  const model = liveConfig.llm_model;
  const provider = liveConfig.llm_provider.toLowerCase();
  const maxTokens = Number(liveConfig.llm_max_output_tokens) || 150;

  if (provider === 'groq') {
    console.log(`[LLM] Groq: ${model}`);
    return openai.LLM.withGroq({
      model: model || 'llama-3.3-70b-versatile',
    });
  }
  if (provider === 'claude') {
    console.log(`[LLM] Claude: ${model}`);
    return new openai.LLM({
      model: model || 'claude-haiku-3-5-latest',
      baseURL: 'https://api.anthropic.com/v1/',
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxCompletionTokens: maxTokens,
    } as openai.LLMOptions);
  }
  if (provider === 'openai') {
    console.log(`[LLM] OpenAI: ${model}`);
    return new openai.LLM({
      model: model || 'gpt-4o-mini',
      maxCompletionTokens: maxTokens,
    } as openai.LLMOptions);
  }

  const geminiModel = resolveGeminiModel(model);
  console.log(`[LLM] Gemini: ${geminiModel}`);
  return new google.LLM({
    model: geminiModel,
    apiKey: getGeminiApiKey(),
    maxOutputTokens: maxTokens,
    temperature: Number(liveConfig.llm_temperature) || 0.5,
  });
}

export function buildStt(liveConfig: LiveConfig) {
  const provider = liveConfig.stt_provider.toLowerCase();

  if (provider === 'deepgram') {
    const model = String(liveConfig.stt_model || 'flux-general-multi');
    const useFlux =
      liveConfig.stt_deepgram_version === 'v2' || model.startsWith('flux');

    if (useFlux) {
      const hints = asStringArray(liveConfig.stt_language_hints);
      const keyterms = asStringArray(liveConfig.stt_keyterms);
      const resolvedKeyterms = keyterms.length ? keyterms : DEFAULT_KEYTERMS;
      const eager =
        liveConfig.stt_eager_eot_threshold != null
          ? Number(liveConfig.stt_eager_eot_threshold)
          : undefined;
      const eotThreshold =
        liveConfig.stt_eot_threshold != null
          ? Number(liveConfig.stt_eot_threshold)
          : undefined;

      console.log(
        `[STT] Deepgram Flux ${model}` +
          (hints.length ? ` hints=${hints.join(',')}` : '') +
          (resolvedKeyterms.length
            ? ` keyterms=${resolvedKeyterms.join(',')}`
            : '') +
          (eager != null ? ` eagerEot=${eager}` : ''),
      );
      return new deepgram.STTv2({
        model,
        languageHint: hints.length ? hints : undefined,
        keyterms: resolvedKeyterms,
        eotTimeoutMs: Number(liveConfig.stt_eot_timeout_ms) || undefined,
        eagerEotThreshold: eager,
        eotThreshold,
      });
    }

    const lang = liveConfig.stt_language;
    const keyterm = asStringArray(liveConfig.stt_keyterms);
    console.log(`[STT] Deepgram Nova ${model} (${lang})`);
    return new deepgram.STT({
      model: model as 'nova-3',
      language: lang === 'multi' ? 'multi' : lang,
      detectLanguage: lang === 'multi',
      endpointing: Number(liveConfig.stt_endpointing_ms) || 25,
      keyterm: keyterm.length ? keyterm : asStringArray(liveConfig.stt_language_hints),
    });
  }

  const model = String(liveConfig.stt_model || 'saaras:v3');
  const languageCode = sarvamLanguageCode(liveConfig.stt_language);
  const mode = String(liveConfig.stt_mode || 'transcribe');
  const prompt = String(liveConfig.stt_prompt || '');
  console.log(
    `[STT] Sarvam ${model} lang=${languageCode} mode=${mode}` +
      (prompt ? ' prompt=on' : ''),
  );
  return new sarvam.STT({
    model: model as 'saaras:v3' | 'saarika:v2.5' | 'saaras:v2.5',
    languageCode,
    mode,
    flushSignal: true,
    prompt: prompt || undefined,
  });
}

export function buildTts(liveConfig: LiveConfig) {
  const provider = liveConfig.tts_provider.toLowerCase();
  const sampleRate = Number(liveConfig.tts_sample_rate) || 24000;
  const pace = Number(liveConfig.tts_pace) || 1;

  if (provider === 'deepgram') {
    const model = String(
      liveConfig.tts_model || liveConfig.tts_voice || 'aura-2-thalia-en',
    );
    console.log(`[TTS] Deepgram ${model}`);
    return new deepgram.TTS({ model, sampleRate });
  }

  const model = String(liveConfig.tts_model || 'bulbul:v3');
  console.log(
    `[TTS] Sarvam ${model} — ${liveConfig.tts_voice} ${liveConfig.tts_language} pace=${pace} rate=${sampleRate}`,
  );

  if (model === 'bulbul:v2') {
    return new sarvam.TTS({
      model: 'bulbul:v2',
      targetLanguageCode: liveConfig.tts_language,
      speaker: liveConfig.tts_voice,
      pace,
      sampleRate,
      enablePreprocessing: liveConfig.tts_enable_preprocessing !== false,
    });
  }

  return new sarvam.TTS({
    model: 'bulbul:v3',
    targetLanguageCode: liveConfig.tts_language,
    speaker: liveConfig.tts_voice,
    pace,
    sampleRate,
  });
}

export function buildSession(liveConfig: LiveConfig) {
  const delayMs = (liveConfig.stt_min_endpointing_delay || 0.2) * 1000;
  const preemptive = liveConfig.preemptive_generation !== false;
  console.log(
    `[SESSION] turnDetection=stt minDelay=${delayMs}ms preemptive=${preemptive}`,
  );
  return new voice.AgentSession({
    stt: buildStt(liveConfig),
    llm: buildLlm(liveConfig),
    tts: buildTts(liveConfig),
    turnHandling: {
      turnDetection: 'stt',
      endpointing: { minDelay: delayMs },
      preemptiveGeneration: {
        enabled: preemptive,
        preemptiveTts: liveConfig.preemptive_tts === true,
      },
    },
  });
}

export function buildRoomInputOptions(): Partial<voice.RoomInputOptions> {
  try {
    console.log('[AUDIO] BVC noise cancellation enabled');
    return {
      closeOnDisconnect: false,
      noiseCancellation: BackgroundVoiceCancellation(),
    };
  } catch {
    console.log('[AUDIO] Running without noise cancellation');
    return { closeOnDisconnect: false };
  }
}
