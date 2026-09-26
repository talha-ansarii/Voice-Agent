const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

const AGENT_KEY = "agentId";

export function getSelectedAgentId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(AGENT_KEY) ?? "";
}

export function setSelectedAgentId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AGENT_KEY, id);
  document.cookie = `agentId=${encodeURIComponent(id)}; Path=/; SameSite=Lax`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const agentId = getSelectedAgentId();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(agentId ? { "x-agent-id": agentId } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}

export type CallLog = {
  id: number | string;
  created_at: string;
  phone_number?: string;
  duration_seconds?: number;
  transcript?: string;
  summary?: string;
  recording_url?: string;
  caller_name?: string;
  sentiment?: string;
  call_room_id?: string;
};

export type Lead = {
  id: string;
  created_at: string;
  name?: string;
  email?: string;
  phone?: string;
  requirements?: string;
  interest_level?: string;
  source?: string;
  call_room_id?: string;
  status?: string;
};

export type Stats = {
  total_calls: number;
  total_bookings: number;
  total_leads?: number;
  avg_duration: number;
  booking_rate: number;
  lead_rate?: number;
};

export type TranscriptLine = {
  id: string;
  call_room_id: string;
  phone?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AgentConfig = Record<string, string | number | boolean | string[] | undefined>;

export type StudioAgent = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CallEvalSummary = {
  evaluated: number;
  lead_capture_rate: number;
  avg_interrupt_count: number;
  calls_with_transcript_pii: number;
  lead_mismatch_count: number;
  rows: Array<{
    call_id: string;
    created_at: string;
    phone_number: string | null;
    quality_flags: string[];
    manual_scorecard: Record<string, string>;
  }>;
};

export const api = {
  getAgents: () => apiFetch<StudioAgent[]>("/api/agents"),
  createAgent: (name: string) =>
    apiFetch<StudioAgent>("/api/agents", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  getStats: () => apiFetch<Stats>("/api/stats"),
  getEval: (limit = 50) => apiFetch<CallEvalSummary>(`/api/eval?limit=${limit}`),
  getLogs: () => apiFetch<CallLog[]>("/api/logs"),
  getLog: (id: string) => apiFetch<string>(`/api/logs/${id}/transcript`),
  getLeads: (status?: string) =>
    apiFetch<Lead[]>(status ? `/api/leads?status=${status}` : "/api/leads"),
  updateLead: (id: string, body: Partial<Lead>) =>
    apiFetch<{ status: string }>(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getTranscripts: (roomId: string) =>
    apiFetch<TranscriptLine[]>(`/api/transcripts/${encodeURIComponent(roomId)}`),
  getConfig: () => apiFetch<AgentConfig>("/api/config"),
  saveConfig: (data: Partial<AgentConfig>) =>
    apiFetch<{ status: string }>("/api/config", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getOutboundStatus: () =>
    apiFetch<{
      ready: boolean;
      has_trunk: boolean;
      has_sip_credentials: boolean;
      from_number_masked: string;
    }>("/api/outbound/status"),
  callSingle: (phone: string) =>
    apiFetch<{ status: string; message?: string; dispatch_id?: string }>(
      "/api/call/single",
      { method: "POST", body: JSON.stringify({ phone }) }
    ),
  callBulk: (numbers: string) =>
    apiFetch<{ results: { phone: string; status: string; message?: string }[] }>(
      "/api/call/bulk",
      { method: "POST", body: JSON.stringify({ numbers }) }
    ),
  getDemoToken: () =>
    apiFetch<{ token?: string; room?: string; url?: string; error?: string }>(
      "/api/demo-token"
    ),
};
