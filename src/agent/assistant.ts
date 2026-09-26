import { llm, voice } from '@livekit/agents';
import {
  getIstTimeContext,
  getLanguageInstruction,
  getTelephonyReplyRules,
  type LiveConfig,
} from '../lib/config.js';

const DEFAULT_GREETING =
  'Hi! We help businesses build AI-native applications and automation workflows. May I ask what kind of project you\'re looking to build?';

export class VoiceAssistant extends voice.Agent {
  private readonly liveConfig: LiveConfig;
  private readonly deferGreeting: boolean;

  constructor(opts: {
    tools: llm.ToolContext;
    liveConfig: LiveConfig;
    deferGreeting?: boolean;
  }) {
    const base = opts.liveConfig.agent_instructions;
    const finalInstructions =
      base +
      getIstTimeContext() +
      getLanguageInstruction(opts.liveConfig.lang_preset) +
      getTelephonyReplyRules();

    const tokenEstimate = Math.ceil(finalInstructions.length / 4);
    console.log(`[PROMPT] System prompt: ~${tokenEstimate} tokens`);
    if (tokenEstimate > 600) {
      console.warn('[PROMPT] Prompt exceeds 600 tokens');
    }

    super({
      instructions: finalInstructions,
      tools: opts.tools,
    });
    this.liveConfig = opts.liveConfig;
    this.deferGreeting = opts.deferGreeting ?? false;
  }

  async onEnter() {
    if (this.deferGreeting) return;
    await this.speakGreeting();
  }

  async speakGreeting() {
    const greeting = this.liveConfig.first_line || DEFAULT_GREETING;
    await this.session.say(greeting, {
      allowInterruptions: false,
      addToChatCtx: true,
    });
  }
}
