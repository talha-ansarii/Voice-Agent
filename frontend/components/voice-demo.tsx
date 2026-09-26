"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type DemoState = "idle" | "connecting" | "live" | "error";

export function VoiceDemo({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<DemoState>("idle");
  const [status, setStatus] = useState(
    "Click start, allow the microphone, then speak."
  );
  const roomRef = useRef<Room | null>(null);
  const audioEls = useRef<HTMLMediaElement[]>([]);

  const detachAudio = useCallback(() => {
    for (const el of audioEls.current) {
      el.pause();
      el.remove();
    }
    audioEls.current = [];
  }, []);

  const hangUp = useCallback(async (opts?: { silent?: boolean }) => {
    detachAudio();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* already closed */
      }
    }
    if (opts?.silent) return;
    setState("idle");
    setStatus("Call ended. Start again whenever you want.");
  }, [detachAudio]);

  useEffect(() => {
    return () => {
      void hangUp({ silent: true });
    };
  }, [hangUp]);

  async function startCall() {
    setState("connecting");
    setStatus("Connecting to the agent…");
    try {
      const res = await api.getDemoToken();
      if (res.error || !res.token || !res.url) {
        throw new Error(res.error || "Could not get a demo token");
      }

      const room = new Room({ adaptiveStream: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach();
        el.autoplay = true;
        el.style.display = "none";
        document.body.appendChild(el);
        audioEls.current.push(el);
        void el.play().catch(() => {
          setStatus("Connected — click the page if you cannot hear audio.");
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        detachAudio();
        roomRef.current = null;
        setState("idle");
        setStatus("Call ended.");
      });

      await room.connect(res.url, res.token, { autoSubscribe: true });
      await room.localParticipant.setMicrophoneEnabled(true);

      setState("live");
      setStatus("Connected — speak now. The agent will answer in this tab.");
    } catch (e) {
      await hangUp();
      setState("error");
      setStatus(e instanceof Error ? e.message : "Failed to start demo");
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white shadow-card",
        compact ? "p-6" : "p-8"
      )}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#7209B7] to-[#4CC9F0] text-3xl text-white">
          🎙
        </div>
        <h2 className="text-xl font-bold text-navy">Talk to the agent</h2>
        <p className="mt-1 max-w-md text-sm text-muted">
          Browser voice demo — no phone number. Uses your mic over LiveKit.
        </p>

        {state !== "live" ? (
          <button
            type="button"
            onClick={() => void startCall()}
            disabled={state === "connecting"}
            className="mt-6 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#7209B7] py-3 text-sm font-semibold text-white hover:bg-[#7209B7]/90 disabled:opacity-60"
          >
            <Mic className="h-4 w-4" />
            {state === "connecting" ? "Connecting…" : "Start demo call"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void hangUp()}
            className="mt-6 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600"
          >
            <PhoneOff className="h-4 w-4" />
            End call
          </button>
        )}

        <p
          className={cn(
            "mt-4 min-h-[1.25rem] text-sm",
            state === "live" && "text-cyan",
            state === "error" && "text-red-400",
            (state === "idle" || state === "connecting") && "text-muted"
          )}
        >
          {state === "live" && (
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-cyan shadow-[0_0_8px_#4CC9F0]" />
          )}
          {status}
        </p>
      </div>
    </div>
  );
}
