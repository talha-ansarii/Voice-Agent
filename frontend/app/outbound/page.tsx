"use client";

import { useEffect, useState } from "react";
import { PhoneOutgoing } from "lucide-react";
import { VoiceDemo } from "@/components/voice-demo";
import { api } from "@/lib/api";

type PstnStatus = {
  ready: boolean;
  has_trunk: boolean;
  has_sip_credentials: boolean;
  from_number_masked: string;
};

export default function OutboundPage() {
  const [phone, setPhone] = useState("+91");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PstnStatus | null>(null);

  useEffect(() => {
    api
      .getOutboundStatus()
      .then(setStatus)
      .catch(() =>
        setStatus({
          ready: false,
          has_trunk: false,
          has_sip_credentials: false,
          from_number_masked: "",
        })
      );
  }, []);

  async function callOne(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.callSingle(phone.trim());
      if (res.status === "ok") {
        setMessage(`Calling ${phone.trim()} — dispatch ${res.dispatch_id ?? "started"}`);
      } else {
        setError(res.message || "Call failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Call failed");
    } finally {
      setBusy(false);
    }
  }

  async function callBulk(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.callBulk(bulk);
      const ok = res.results?.filter((r) => r.status === "ok").length ?? 0;
      const fail = (res.results?.length ?? 0) - ok;
      setMessage(`Queued ${ok} call(s)${fail ? `, ${fail} failed` : ""}`);
      const firstError = res.results?.find((r) => r.status !== "ok");
      if (firstError?.message) setError(firstError.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk call failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-8">
          <h1 className="text-2xl font-bold text-navy">Outbound calls</h1>
        <p className="text-sm text-muted">
          Place a real PSTN call through Vobiz. Number must include country code.
        </p>
      </header>

      <div className="space-y-6">
        {status && !status.ready && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Vobiz trunk is not fully configured. Set OUTBOUND_TRUNK_ID and VOBIZ_*
            in .env, then restart the API and agent.
          </p>
        )}
        {status?.ready && (
          <p className="rounded-lg border border-cyan/40 bg-cyan/10 px-4 py-3 text-sm text-navy">
            Ready to dial
            {status.from_number_masked
              ? ` from ${status.from_number_masked}`
              : ""}
            .
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={(e) => void callOne(e)}
          className="rounded-xl border border-border bg-white p-6 shadow-card"
        >
          <label className="mb-1 block text-xs text-muted">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91XXXXXXXXXX"
            className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-navy"
          />
          <button
            type="submit"
            disabled={busy || !status?.ready}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <PhoneOutgoing className="h-4 w-4" />
            {busy ? "Dialing…" : "Place real call"}
          </button>
          {message && (
            <p className="mt-3 text-sm text-emerald-600">{message}</p>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </form>

        <form
          onSubmit={(e) => void callBulk(e)}
          className="rounded-xl border border-border bg-white p-6 shadow-card"
        >
          <label className="mb-1 block text-xs text-muted">
            Bulk (one E.164 number per line)
          </label>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={4}
            placeholder={"+9198XXXXXXXX\n+9199XXXXXXXX"}
            className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-navy"
          />
          <button
            type="submit"
            disabled={busy || !status?.ready || !bulk.trim()}
            className="mt-4 rounded-xl border border-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Queue bulk calls
          </button>
        </form>
        </div>

        <div>
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">
            Browser demo (no PSTN)
          </p>
          <VoiceDemo compact />
        </div>
      </div>
    </div>
  );
}
