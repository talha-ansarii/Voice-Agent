import { voice } from '@livekit/agents';

const { AgentSessionEventTypes } = voice;

/** Caller signals they want to end the conversation. */
const HANGUP_INTENT_RE =
  /\b(bye|goodbye|hang\s*up|disconnect|call\s*cut|cut\s*(the\s*)?call|not\s+interested)\b|ठीक\s*है|अलविदा|बाय|काट\s*दो|कुछ\s*नहीं|call\s*cut\s*कर/i;

export interface SessionState {
  agentIsSpeaking: boolean;
  interruptCount: number;
  turnCount: number;
  maxTurns: number;
  lastFinalTranscriptAt: number | null;
  turnLatenciesMs: number[];
  sttProvider: string;
  pendingHangup: boolean;
  logTranscript: (role: string, content: string) => Promise<void>;
  onCallerHangup: () => void;
}

export function registerSessionEvents(
  session: voice.AgentSession,
  state: SessionState,
) {
  session.on(AgentSessionEventTypes.AgentStateChanged, (ev) => {
    const wasSpeaking = state.agentIsSpeaking;
    state.agentIsSpeaking = ev.newState === 'speaking';

    if (
      !wasSpeaking &&
      ev.newState === 'speaking' &&
      state.lastFinalTranscriptAt
    ) {
      const latencyMs = Date.now() - state.lastFinalTranscriptAt;
      state.turnLatenciesMs.push(latencyMs);
      console.log(
        `[LATENCY] transcript→speech: ${latencyMs}ms (turn ${state.turnCount}, avg ${avgLatency(state.turnLatenciesMs)}ms)`,
      );
      state.lastFinalTranscriptAt = null;
    }

    if (wasSpeaking && ev.newState !== 'speaking' && state.pendingHangup) {
      console.log('[END-CALL] Caller goodbye detected — hanging up after agent spoke');
      state.pendingHangup = false;
      state.onCallerHangup();
    }
  });

  session.on(AgentSessionEventTypes.AgentFalseInterruption, () => {
    state.interruptCount += 1;
    console.log(`[INTERRUPT] Total: ${state.interruptCount}`);
  });

  session.on(AgentSessionEventTypes.UserInputTranscribed, (ev) => {
    if (!ev.isFinal) return;
    const transcript = ev.transcript.trim();
    if (!transcript) return;

    // Sarvam-only: force-commit when END_OF_SPEECH arrives before text.
    // Deepgram Flux handles EOU natively — extra commit duplicates transcripts.
    if (state.sttProvider === 'sarvam') {
      session.commitUserTurn();
    }

    if (state.agentIsSpeaking) return;

    state.lastFinalTranscriptAt = Date.now();
    void state.logTranscript('user', transcript);
    state.turnCount += 1;
    console.log(
      `[TRANSCRIPT] Turn ${state.turnCount}/${state.maxTurns}: '${transcript}'`,
    );

    if (HANGUP_INTENT_RE.test(transcript)) {
      state.pendingHangup = true;
      console.log('[END-CALL] Hangup intent detected in caller speech');
    }

    if (state.turnCount >= state.maxTurns) {
      void session.generateReply({
        instructions:
          'Politely wrap up in one short sentence, say goodbye, then call end_call immediately.',
      });
    }
  });
}

function avgLatency(samples: number[]): number {
  if (!samples.length) return 0;
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

export function getAvgTurnLatencyMs(state: SessionState): number {
  return avgLatency(state.turnLatenciesMs);
}
