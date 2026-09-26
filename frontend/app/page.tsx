"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StatsCard } from "@/components/stats-card";
import { CallDialog } from "@/components/call-dialog";
import { VoiceDemo } from "@/components/voice-demo";
import { api, type CallLog, type Stats } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [selected, setSelected] = useState<CallLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, l] = await Promise.all([api.getStats(), api.getLogs()]);
      setStats(s);
      setLogs(l.slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-sm text-muted">
            Talk to the agent in the browser — no phone number required
          </p>
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

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} — Is the API running at{" "}
          {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}?
        </p>
      )}

      <div className="mb-8">
        <VoiceDemo compact />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total calls" value={stats?.total_calls ?? "—"} sub="All time" />
        <StatsCard
          label="Leads captured"
          value={stats?.total_leads ?? "—"}
          sub={`${stats?.lead_rate ?? 0}% of calls`}
        />
        <StatsCard
          label="Avg duration"
          value={stats?.avg_duration ? `${stats.avg_duration}s` : "—"}
          sub="Per call"
        />
        <StatsCard
          label="Bookings"
          value={stats?.total_bookings ?? "—"}
          sub={`${stats?.booking_rate ?? 0}% rate`}
        />
      </div>

      <div className="rounded-xl border border-border bg-white shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-navy">Recent calls</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Summary</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    No calls yet. Start a demo call above.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={String(log.id)}
                    className="border-b border-border/70 hover:bg-surface"
                  >
                    <td className="px-5 py-3 text-muted">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-medium">{log.phone_number || "—"}</td>
                    <td className="px-5 py-3">{log.duration_seconds ?? 0}s</td>
                    <td className="max-w-xs truncate px-5 py-3 text-muted">
                      {log.summary || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(log)}
                        className="text-accent hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CallDialog call={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
