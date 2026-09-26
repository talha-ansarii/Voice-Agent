import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EXPRESS =
  process.env.EXPRESS_INTERNAL_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

async function proxy(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const segments = ctx.params.path ?? [];
  if (segments[0] === "auth" || segments[0] === "health") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const target = `${EXPRESS}/api/${segments.join("/")}${req.nextUrl.search}`;
  const agentId =
    req.headers.get("x-agent-id") ||
    req.cookies.get("agentId")?.value ||
    session.user.defaultAgentId ||
    "";

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("x-user-id", userId);
  if (agentId) headers.set("x-agent-id", agentId);

  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const body = await upstream.arrayBuffer();
  const out = new NextResponse(body, { status: upstream.status });
  const ct = upstream.headers.get("content-type");
  if (ct) out.headers.set("content-type", ct);
  const cd = upstream.headers.get("content-disposition");
  if (cd) out.headers.set("content-disposition", cd);
  return out;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return proxy(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return proxy(req, ctx);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return proxy(req, ctx);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return proxy(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  return proxy(req, ctx);
}
