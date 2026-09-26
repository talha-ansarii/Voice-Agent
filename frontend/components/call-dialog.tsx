"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, type CallLog, type TranscriptLine } from "@/lib/api";

type CallDialogProps = {
  call: CallLog | null;
  onClose: () => void;
};

export function CallDialog({ call, onClose }: CallDialogProps) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!call) return;
    const roomId =
      call.call_room_id ||
      call.summary?.match(/call-\d+-\d+/)?.[0] ||
      "";
    if (!roomId) {
      setLines([]);
      return;
    }
    setLoading(true);
    api
      .getTranscripts(roomId)
      .then(setLines)
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [call]);

  if (!call) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-white shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy">Call details</h2>
            <p className="text-sm text-muted">
              {call.phone_number || "Unknown"} ·{" "}
              {new Date(call.created_at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface hover:text-navy"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted">Duration</span>
              <p className="font-medium">{call.duration_seconds ?? 0}s</p>
            </div>
            <div>
              <span className="text-muted">Sentiment</span>
              <p className="font-medium capitalize">{call.sentiment || "—"}</p>
            </div>
          </div>
          {call.summary && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted">Summary</p>
              <p className="rounded-lg bg-surface p-3 text-sm">{call.summary}</p>
            </div>
          )}
          {call.recording_url && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted">Recording</p>
              <audio controls className="w-full" src={call.recording_url}>
                Your browser does not support audio.
              </audio>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Transcript</p>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : lines.length > 0 ? (
              <div className="space-y-2 rounded-lg bg-surface p-3">
                {lines.map((l) => (
                  <p key={l.id} className="text-sm">
                    <span
                      className={
                        l.role === "user"
                          ? "font-semibold text-accent"
                          : "font-semibold text-cyan"
                      }
                    >
                      {l.role === "user" ? "Caller" : "Agent"}:
                    </span>{" "}
                    {l.content}
                  </p>
                ))}
              </div>
            ) : (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs text-navy">
                {call.transcript || "No transcript available."}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
