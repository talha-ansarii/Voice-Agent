"use client";

import { useEffect, useState } from "react";
import { api, type AgentConfig } from "@/lib/api";

export default function SettingsPage() {
  const [config, setConfig] = useState<AgentConfig>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    await api.saveConfig({
      agent_instructions: config.agent_instructions,
      first_line: config.first_line,
      first_line_outbound: config.first_line_outbound,
      lang_preset: config.lang_preset,
      llm_model: config.llm_model,
      llm_provider: config.llm_provider,
      llm_max_output_tokens: config.llm_max_output_tokens,
      llm_temperature: config.llm_temperature,
      stt_provider: config.stt_provider,
      stt_model: config.stt_model,
      stt_language: config.stt_language,
      stt_mode: config.stt_mode,
      stt_deepgram_version: config.stt_deepgram_version,
      stt_language_hints: config.stt_language_hints,
      stt_keyterms: config.stt_keyterms,
      stt_endpointing_ms: config.stt_endpointing_ms,
      stt_eot_timeout_ms: config.stt_eot_timeout_ms,
      stt_eager_eot_threshold: config.stt_eager_eot_threshold,
      stt_prompt: config.stt_prompt,
      preemptive_generation: config.preemptive_generation,
      tts_provider: config.tts_provider,
      tts_model: config.tts_model,
      tts_voice: config.tts_voice,
      tts_language: config.tts_language,
      tts_pace: config.tts_pace,
      tts_sample_rate: config.tts_sample_rate,
      stt_min_endpointing_delay: config.stt_min_endpointing_delay,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="text-muted">Loading settings…</div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Agent settings</h1>
        <p className="text-sm text-muted">
          Updates config.json — takes effect on the next call
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">Outreach greeting</h2>
          <label className="mb-1 block text-xs text-muted">First line (outbound)</label>
          <input
            type="text"
            value={String(config.first_line_outbound || config.first_line || "")}
            onChange={(e) =>
              setConfig({ ...config, first_line_outbound: e.target.value, first_line: e.target.value })
            }
            className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-navy"
          />
        </section>

        <section className="rounded-xl border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">System prompt</h2>
          <textarea
            value={String(config.agent_instructions || "")}
            onChange={(e) =>
              setConfig({ ...config, agent_instructions: e.target.value })
            }
            rows={14}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 font-mono text-xs text-navy"
          />
        </section>

        <section className="rounded-xl border border-border bg-white p-6 shadow-card">
          <h2 className="mb-4 font-semibold text-navy">Models & voice</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">LLM provider</label>
              <select
                value={String(config.llm_provider || "gemini")}
                onChange={(e) => setConfig({ ...config, llm_provider: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">LLM model</label>
              <input
                type="text"
                value={String(config.llm_model || "")}
                onChange={(e) => setConfig({ ...config, llm_model: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">STT model</label>
              <input
                type="text"
                value={String(config.stt_model || "")}
                onChange={(e) => setConfig({ ...config, stt_model: e.target.value })}
                placeholder="flux-general-multi or saaras:v3"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">TTS model</label>
              <input
                type="text"
                value={String(config.tts_model || "")}
                onChange={(e) => setConfig({ ...config, tts_model: e.target.value })}
                placeholder="bulbul:v3"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">STT provider</label>
              <select
                value={String(config.stt_provider || "deepgram")}
                onChange={(e) => setConfig({ ...config, stt_provider: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              >
                <option value="deepgram">Deepgram</option>
                <option value="sarvam">Sarvam</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">TTS provider</label>
              <select
                value={String(config.tts_provider || "deepgram")}
                onChange={(e) => setConfig({ ...config, tts_provider: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              >
                <option value="deepgram">Deepgram</option>
                <option value="sarvam">Sarvam</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                {config.tts_provider === "sarvam" ? "Sarvam voice" : "Deepgram voice model"}
              </label>
              {config.tts_provider === "sarvam" ? (
                <select
                  value={String(config.tts_voice || "kavya")}
                  onChange={(e) => setConfig({ ...config, tts_voice: e.target.value })}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
                >
                  {["kavya", "amit", "rohan", "priya", "shubh", "dev", "neha", "aditya"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={String(config.tts_voice || "aura-2-thalia-en")}
                  onChange={(e) => setConfig({ ...config, tts_voice: e.target.value })}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
                >
                  {[
                    "aura-2-thalia-en",
                    "aura-2-andromeda-en",
                    "aura-2-helena-en",
                    "aura-2-apollo-en",
                    "aura-2-amalthea-en",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Endpointing delay (s)</label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="3"
                value={Number(config.stt_min_endpointing_delay ?? 0.2)}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    stt_min_endpointing_delay: parseFloat(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">EOT timeout (ms)</label>
              <input
                type="number"
                min="1000"
                max="5000"
                value={Number(config.stt_eot_timeout_ms ?? 2200)}
                onChange={(e) =>
                  setConfig({ ...config, stt_eot_timeout_ms: parseInt(e.target.value, 10) })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Eager EOT threshold (0–1)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={Number(config.stt_eager_eot_threshold ?? 0.55)}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    stt_eager_eot_threshold: parseFloat(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted">STT keyterms (comma-separated)</label>
              <input
                type="text"
                value={
                  Array.isArray(config.stt_keyterms)
                    ? config.stt_keyterms.join(", ")
                    : String(config.stt_keyterms || "")
                }
                onChange={(e) =>
                  setConfig({
                    ...config,
                    stt_keyterms: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">LLM temperature</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={Number(config.llm_temperature ?? 0.25)}
                onChange={(e) =>
                  setConfig({ ...config, llm_temperature: parseFloat(e.target.value) })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">TTS sample rate</label>
              <select
                value={String(config.tts_sample_rate ?? 24000)}
                onChange={(e) =>
                  setConfig({ ...config, tts_sample_rate: parseInt(e.target.value, 10) })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              >
                <option value="8000">8000 (narrowband)</option>
                <option value="16000">16000</option>
                <option value="24000">24000 (recommended)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">TTS pace</label>
              <input
                type="number"
                step="0.05"
                min="0.5"
                max="2"
                value={Number(config.tts_pace ?? 0.95)}
                onChange={(e) =>
                  setConfig({ ...config, tts_pace: parseFloat(e.target.value) })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={config.preemptive_generation !== false}
                  onChange={(e) =>
                    setConfig({ ...config, preemptive_generation: e.target.checked })
                  }
                />
                Preemptive generation (lower latency)
              </label>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/90"
        >
          {saved ? "Saved!" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
