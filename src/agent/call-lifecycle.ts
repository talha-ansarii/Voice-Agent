import type { JobContext } from '@livekit/agents';
import type { voice } from '@livekit/agents';
import { hangupCall } from '../lib/livekit-clients.js';

export interface CallLifecycle {
  terminateCall: (reason: string) => Promise<void>;
  isEnding: () => boolean;
}

export function createCallLifecycle(opts: {
  session: voice.AgentSession;
  ctx: JobContext;
  roomName: string;
  sipIdentity: string | null;
}): CallLifecycle {
  let ending = false;

  async function terminateCall(reason: string): Promise<void> {
    if (ending) return;
    ending = true;
    console.log(`[END-CALL] Terminating (${reason})`);

    try {
      opts.session.shutdown({ drain: true });
    } catch (e) {
      console.warn('[END-CALL] session shutdown:', e);
    }

    await hangupCall(opts.roomName, opts.sipIdentity);

    try {
      opts.ctx.shutdown(reason);
    } catch (e) {
      console.warn('[END-CALL] job shutdown:', e);
    }
  }

  return {
    terminateCall,
    isEnding: () => ending,
  };
}
