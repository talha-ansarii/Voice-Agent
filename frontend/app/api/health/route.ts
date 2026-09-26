import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base =
    process.env.EXPRESS_INTERNAL_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      {
        status: "degraded",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503 }
    );
  }
}
