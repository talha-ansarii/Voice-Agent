"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { CallDialog } from "@/components/call-dialog";
import { api, type CallEvalSummary, type CallLog } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export default function CallsPage() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [evalSummary, setEvalSummary] = useState<CallEvalSummary | null>(null);
  const [selected, setSelected] = useState<CallLog | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logRows, evalData] = await Promise.all([
        api.getLogs(),
        api.getEval(50).catch(() => null),
      ]);
      setLogs(logRows);
      setEvalSummary(evalData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Call logs</h1>
          <p className="text-sm text-muted">Transcripts, recordings, and summaries</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted shadow-card hover:border-accent hover:text-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {evalSummary && evalSummary.evaluated > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-white p-4 shadow-card">
            <p className="text-xs text-muted">Lead capture rate</p>
            <p className="text-2xl font-bold text-navy">{evalSummary.lead_capture_rate}%</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-card">
            <p className="text-xs text-muted">Avg interrupts</p>
            <p className="text-2xl font-bold text-navy">{evalSummary.avg_interrupt_count}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-card">
            <p className="text-xs text-muted">PII in transcripts</p>
            <p className="text-2xl font-bold text-navy">{evalSummary.calls_with_transcript_pii}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-card">
            <p className="text-xs text-muted">Lead mismatches</p>
            <p className="text-2xl font-bold text-navy">{evalSummary.lead_mismatch_count}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase text-muted">
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Duration</th>
              <th className="px-5 py-3">Sentiment</th>
              <th className="px-5 py-3">Quality</th>
              <th className="px-5 py-3">Summary</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  No call logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const evalRow = evalSummary?.rows.find(
                  (r) => r.call_id === String(log.id),
                );
                const flags = evalRow?.quality_flags ?? [];
                return (
                <tr
                  key={String(log.id)}
                  className="border-b border-border/70 hover:bg-surface"
                >
                  <td className="whitespace-nowrap px-5 py-3 text-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 font-medium">{log.phone_number || "—"}</td>
                  <td className="px-5 py-3">{log.duration_seconds ?? 0}s</td>
                  <td className="px-5 py-3 capitalize">{log.sentiment || "—"}</td>
                  <td className="px-5 py-3 text-xs text-muted" title={flags.join(", ")}>
                    {flags.length ? flags.join(", ") : "ok"}
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-3 text-muted" title={log.summary}>
                    {log.summary || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(log)}
                        className="text-accent hover:underline"
                      >
                        View
                      </button>
                      {log.id && (
                        <a
                          href={`${API_BASE}/api/logs/${log.id}/transcript`}
                          download
                          className="flex items-center gap-1 text-muted hover:text-navy"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      <CallDialog call={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
