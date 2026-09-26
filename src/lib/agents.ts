import { Prisma } from '@prisma/client';
import { defaultAgentConfigTemplate, readConfig } from './config.js';
import { prisma } from './prisma.js';

export const DEFAULT_AGENT_NAME = 'Demo agent';

/** Renamed on login for installs created before white-label defaults. */
const LEGACY_AGENT_NAMES = new Set(['Vecktrix']);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function publicConfig(agentConfig: unknown): Record<string, unknown> {
  const template = readConfig();
  const stored = asRecord(agentConfig);
  return {
    ...template,
    ...stored,
    livekit_url:
      process.env.LIVEKIT_URL ||
      String(template.livekit_url ?? stored.livekit_url ?? ''),
  };
}

export async function upsertGoogleUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  googleId: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.googleId) {
    throw new Error('email and googleId are required');
  }

  const existingByGoogle = await prisma.user.findUnique({
    where: { googleId: input.googleId },
  });
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  const user = existingByGoogle
    ? await prisma.user.update({
        where: { id: existingByGoogle.id },
        data: {
          email,
          name: input.name ?? null,
          image: input.image ?? null,
        },
      })
    : existingByEmail
      ? await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: input.googleId,
            name: input.name ?? null,
            image: input.image ?? null,
          },
        })
      : await prisma.user.create({
          data: {
            email,
            name: input.name ?? null,
            image: input.image ?? null,
            googleId: input.googleId,
          },
        });

  const defaultConfig = defaultAgentConfigTemplate() as Prisma.InputJsonValue;
  let agent = await prisma.agent.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: DEFAULT_AGENT_NAME,
        config: defaultConfig,
      },
    });
  } else if (LEGACY_AGENT_NAMES.has(agent.name)) {
    agent = await prisma.agent.update({
      where: { id: agent.id },
      data: { name: DEFAULT_AGENT_NAME, config: defaultConfig },
    });
  }

  return { user, agent };
}

export async function listAgents(userId: string) {
  return prisma.agent.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
}

export async function createAgent(userId: string, name: string) {
  const trimmed = name.trim() || 'New agent';
  return prisma.agent.create({
    data: {
      userId,
      name: trimmed,
      config: defaultAgentConfigTemplate() as Prisma.InputJsonValue,
    },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
}

export async function updateAgent(
  userId: string,
  agentId: string,
  data: { name?: string },
) {
  const existing = await prisma.agent.findFirst({
    where: { id: agentId, userId },
  });
  if (!existing) return null;
  return prisma.agent.update({
    where: { id: agentId },
    data: { name: data.name?.trim() || existing.name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
}

export async function deleteAgent(userId: string, agentId: string) {
  const count = await prisma.agent.count({ where: { userId } });
  if (count <= 1) {
    return { ok: false as const, message: 'Keep at least one agent' };
  }
  const existing = await prisma.agent.findFirst({
    where: { id: agentId, userId },
  });
  if (!existing) return { ok: false as const, message: 'Agent not found' };
  await prisma.agent.delete({ where: { id: agentId } });
  return { ok: true as const };
}

export async function getAgentForUser(userId: string, agentId: string) {
  return prisma.agent.findFirst({ where: { id: agentId, userId } });
}

export async function getAgentConfigForUser(userId: string, agentId: string) {
  const agent = await getAgentForUser(userId, agentId);
  if (!agent) return null;
  return publicConfig(agent.config);
}

export async function mergeAgentConfig(
  userId: string,
  agentId: string,
  patch: Record<string, unknown>,
) {
  const agent = await getAgentForUser(userId, agentId);
  if (!agent) return null;
  const next = { ...asRecord(agent.config) };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'livekit_api_key' || k === 'livekit_api_secret') continue;
    next[k] = v;
  }
  await prisma.agent.update({
    where: { id: agentId },
    data: { config: next as Prisma.InputJsonValue },
  });
  return publicConfig(next);
}

export async function loadAgentConfigRecord(
  agentId: string,
  userId?: string,
): Promise<Record<string, unknown> | null> {
  const agent = await prisma.agent.findFirst({
    where: userId ? { id: agentId, userId } : { id: agentId },
  });
  if (!agent) return null;
  return asRecord(agent.config);
}
