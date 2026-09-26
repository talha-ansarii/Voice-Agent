import { llm, type JobContext } from '@livekit/agents';
import { createBooking } from '../lib/calendar.js';
import { classifyCallSentiment } from '../lib/gemini.js';
import { saveCallLog, upsertActiveCall } from '../lib/db.js';
import { stopRoomRecording } from '../lib/livekit-clients.js';
import {
  notifyBookingConfirmed,
  notifyCallNoBooking,
} from '../lib/notify.js';
import type { VoiceAssistant } from './assistant.js';
import type { AgentToolsState } from './tools.js';

export interface ShutdownState {
  ctx: JobContext;
  agent: VoiceAssistant;
  toolsState: AgentToolsState;
  callerPhone: string;
  callStartTime: Date;
  egressId: string | null;
  interruptCount: number;
  avgTurnLatencyMs: number;
  ttsVoice: string;
  callType: string;
  shutdownDone: boolean;
}

export function makeShutdownHook(state: ShutdownState) {
  return async () => {
    if (state.shutdownDone) {
      console.log('[SHUTDOWN] Already ran — skipping duplicate');
      return;
    }
    state.shutdownDone = true;
    console.log('[SHUTDOWN] Sequence started.');

    const duration = Math.floor(
      (Date.now() - state.callStartTime.getTime()) / 1000,
    );

    let bookingStatusMsg = 'No booking';
    if (state.avgTurnLatencyMs > 0) {
      console.log(`[SHUTDOWN] Avg turn latency: ${state.avgTurnLatencyMs}ms`);
    }
    if (state.toolsState.leadSaved) {
      const lead = state.toolsState.leadSaved;
      bookingStatusMsg = `Lead captured: ${lead.name} | ${lead.email} | ${lead.requirements.slice(0, 120)}`;
    } else if (state.toolsState.bookingIntent) {
      const intent = state.toolsState.bookingIntent;
      const result = await createBooking(
        intent.start_time,
        intent.caller_name || 'Unknown Caller',
        intent.caller_phone,
        intent.notes,
      );
      if (result.success) {
        notifyBookingConfirmed({
          callerName: intent.caller_name,
          callerPhone: intent.caller_phone,
          bookingTimeIso: intent.start_time,
          bookingId: result.booking_id ?? 'unknown',
          notes: intent.notes,
          ttsVoice: state.ttsVoice,
        });
        bookingStatusMsg = `Booking Confirmed: ${result.booking_id}`;
      } else {
        bookingStatusMsg = `Booking Failed: ${result.message}`;
      }
    } else if (!state.toolsState.leadSaved) {
      notifyCallNoBooking({
        callerName: state.toolsState.callerName,
        callerPhone: state.toolsState.callerPhone,
        callSummary: 'Caller did not schedule during this call.',
        ttsVoice: state.ttsVoice,
        durationSeconds: duration,
      });
    }

    const transcriptText = buildTranscript(state.agent);
    const sentiment = await analyzeSentiment(transcriptText);
    const estimatedCost = estimateCost(duration, transcriptText.length);
    const ist = new Date(
      state.callStartTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    );

    const recordingUrl = state.egressId
      ? await stopRoomRecording(state.egressId, state.ctx.room.name ?? '')
      : '';

    await upsertActiveCall({
      roomId: state.ctx.room.name ?? '',
      phone: state.callerPhone,
      callerName: state.toolsState.callerName,
      status: 'completed',
      callType: state.callType,
      userId: state.toolsState.userId ?? null,
      agentId: state.toolsState.agentId ?? null,
    });

    await n8nWebhook({
      phone: state.callerPhone,
      toolsState: state.toolsState,
      duration,
      summary: bookingStatusMsg,
      sentiment,
      recordingUrl,
      interruptCount: state.interruptCount,
    });

    await saveCallLog({
      phone: state.callerPhone,
      duration,
      transcript: transcriptText,
      summary:
        bookingStatusMsg +
        (state.avgTurnLatencyMs > 0
          ? ` | Avg turn latency: ${state.avgTurnLatencyMs}ms`
          : ''),
      recordingUrl,
      callerName: state.toolsState.callerName || '',
      sentiment,
      estimatedCostUsd: estimatedCost,
      callDate: ist,
      callHour: ist.getHours(),
      callDayOfWeek: ist.toLocaleDateString('en-US', { weekday: 'long' }),
      wasBooked: Boolean(
        state.toolsState.bookingIntent || state.toolsState.leadSaved,
      ),
      interruptCount: state.interruptCount,
      callType: state.callType,
      userId: state.toolsState.userId ?? null,
      agentId: state.toolsState.agentId ?? null,
    });

    await recordPrometheus(
      duration,
      Boolean(state.toolsState.bookingIntent || state.toolsState.leadSaved),
    );
  };
}

function buildTranscript(agent: VoiceAssistant): string {
  try {
    const lines: string[] = [];
    for (const item of agent.chatCtx.items) {
      if (!(item instanceof llm.ChatMessage)) continue;
      if (item.role !== 'user' && item.role !== 'assistant') continue;
      const text = item.textContent;
      if (text) lines.push(`[${item.role.toUpperCase()}] ${text}`);
    }
    return lines.join('\n') || 'unavailable';
  } catch (e) {
    console.error('[SHUTDOWN] Transcript read failed:', e);
    return 'unavailable';
  }
}

async function analyzeSentiment(transcriptText: string): Promise<string> {
  return classifyCallSentiment(transcriptText);
}

function estimateCost(dur: number, chars: number): number {
  return Number(
    (
      (dur / 60) * 0.002 +
      (dur / 60) * 0.006 +
      (chars / 1000) * 0.003 +
      (chars / 4000) * 0.0001
    ).toFixed(5),
  );
}

async function n8nWebhook(data: {
  phone: string;
  toolsState: AgentToolsState;
  duration: number;
  summary: string;
  sentiment: string;
  recordingUrl: string;
  interruptCount: number;
}) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'call_completed',
        phone: data.phone,
        caller_name: data.toolsState.callerName,
        duration: data.duration,
        booked: Boolean(
          data.toolsState.bookingIntent || data.toolsState.leadSaved,
        ),
        sentiment: data.sentiment,
        summary: data.summary,
        recording_url: data.recordingUrl,
        interrupt_count: data.interruptCount,
      }),
      signal: AbortSignal.timeout(5000),
    });
    console.log('[N8N] Webhook triggered');
  } catch (e) {
    console.warn('[N8N] Webhook failed:', e);
  }
}

async function recordPrometheus(duration: number, booked: boolean) {
  const metricsUrl =
    process.env.UI_METRICS_URL ?? 'http://127.0.0.1:8000/internal/record-call';
  try {
    await fetch(metricsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration, booked }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* optional */
  }
}
