import type { Request } from 'express';
import { prisma } from './prisma.js';

export type TenantScope = {
  userId: string;
  agentId: string;
};

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantScope;
    }
  }
}

function headerValue(req: Request, name: string): string {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
  return String(raw ?? '').trim();
}

export async function resolveTenant(
  req: Request,
): Promise<TenantScope | null> {
  const userId = headerValue(req, 'x-user-id');
  if (!userId) return null;

  let agentId = headerValue(req, 'x-agent-id');
  if (!agentId) {
    const first = await prisma.agent.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    agentId = first?.id ?? '';
  }
  if (!agentId) return null;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId },
    select: { id: true },
  });
  if (!agent) return null;
  return { userId, agentId: agent.id };
}

export async function requireUserId(req: Request): Promise<string | null> {
  const userId = headerValue(req, 'x-user-id');
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export function tenantWhere(scope: TenantScope) {
  return { userId: scope.userId, agentId: scope.agentId };
}
