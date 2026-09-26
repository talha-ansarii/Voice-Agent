import 'dotenv/config';
import { cli, ServerOptions } from '@livekit/agents';
import { fileURLToPath } from 'node:url';
import { AGENT_NAME } from '../lib/dispatch.js';
import { logEnvCheckWithDb } from '../lib/env-check.js';

const agentPath = fileURLToPath(new URL('./entrypoint.js', import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void logEnvCheckWithDb('AGENT').then(() => {
    cli.runApp(
      new ServerOptions({
        agent: agentPath,
        agentName: process.env.LIVEKIT_AGENT_NAME ?? AGENT_NAME,
      }),
    );
  });
}
