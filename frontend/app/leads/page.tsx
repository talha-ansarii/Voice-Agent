"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, type Lead } from "@/lib/api";

const STATUSES = ["", "new", "contacted", "converted"] as const;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLeads(await api.getLeads(filter || undefined));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    await api.updateLead(id, { status });
    load();
  }

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Leads</h1>
          <p className="text-sm text-muted">
            Prospects captured on outreach calls (name, email, requirements)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy shadow-card"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All statuses"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted shadow-card hover:border-accent hover:text-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase text-muted">
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Interest</th>
              <th className="px-5 py-3">Requirements</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  No leads yet. The agent saves leads via save_lead during calls.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-border/70 hover:bg-surface"
                >
                  <td className="whitespace-nowrap px-5 py-3 text-muted">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 font-medium">{lead.name || "—"}</td>
                  <td className="px-5 py-3">{lead.email || "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs">{lead.phone || "—"}</td>
                  <td className="px-5 py-3 capitalize">{lead.interest_level || "—"}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-muted" title={lead.requirements}>
                    {lead.requirements || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={lead.status || "new"}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className="rounded border border-border bg-white px-2 py-1 text-xs text-navy"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
