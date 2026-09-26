import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { DEFAULT_AGENT_NAME } from '../src/lib/agents.js';
import { defaultAgentConfigTemplate } from '../src/lib/config.js';
import { prisma } from '../src/lib/prisma.js';

const LEGACY_AGENT_NAMES = ['Vecktrix'];

async function main() {
  const result = await prisma.agent.updateMany({
    where: { name: { in: LEGACY_AGENT_NAMES } },
    data: {
      name: DEFAULT_AGENT_NAME,
      config: defaultAgentConfigTemplate() as Prisma.InputJsonValue,
    },
  });
  console.log(`renamed ${result.count} agent(s) to ${DEFAULT_AGENT_NAME}`);
  await prisma.$disconnect();
}

void main();
