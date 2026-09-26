/** Google AI Studio / Gemini API key (plugin also reads GOOGLE_API_KEY). */
export function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    ''
  );
}

export function validateGeminiApiKey(): {
  valid: boolean;
  reason?: 'missing' | 'invalid_format' | 'looks_like_project_id';
} {
  const key = getGeminiApiKey().trim();
  if (!key) return { valid: false, reason: 'missing' };
  if (key.startsWith('AIza')) return { valid: true };
  if (/^[a-z]+-[a-z]+-\d+/.test(key)) {
    return { valid: false, reason: 'looks_like_project_id' };
  }
  return { valid: false, reason: 'invalid_format' };
}

/** Default for voice calls — fast, widely available on Google AI Studio. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Map retired model IDs to current equivalents (Google AI Studio returns 404 otherwise). */
const DEPRECATED_GEMINI_MODELS: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite-preview-02-05': 'gemini-2.5-flash-lite',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-3.1-flash-lite': 'gemini-2.5-flash',
};

export function resolveGeminiModel(model?: string): string {
  const raw = (model ?? '').trim();
  if (!raw) return DEFAULT_GEMINI_MODEL;
  const mapped = DEPRECATED_GEMINI_MODELS[raw];
  if (mapped && mapped !== raw) {
    console.warn(`[LLM] Model "${raw}" is retired — using "${mapped}" instead`);
    return mapped;
  }
  return raw;
}

const SENTIMENT_MODEL = 'gemini-2.5-flash';

export async function classifyCallSentiment(
  transcriptText: string,
): Promise<string> {
  if (!transcriptText || transcriptText === 'unavailable') return 'unknown';
  const key = getGeminiApiKey();
  if (!key) return 'unknown';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SENTIMENT_MODEL}:generateContent`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'Classify this call as one word: positive, neutral, negative, or frustrated.\n\n' +
                  transcriptText.slice(0, 800),
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 16, temperature: 0 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      console.warn('[SENTIMENT] Gemini HTTP', resp.status);
      return 'unknown';
    }
    const data = (await resp.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() ??
      'unknown';
    const word = text.split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? 'unknown';
    console.log(`[SENTIMENT] ${word}`);
    return word;
  } catch (e) {
    console.warn('[SENTIMENT] Failed:', e);
    return 'unknown';
  }
}
