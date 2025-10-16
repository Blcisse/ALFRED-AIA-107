// app/api/myblog/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { markRefreshRequested, seedDefaultGenresIfEmpty } from "@/lib/myblogStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const genres: string[] = Array.isArray(body?.genres) ? body.genres : [];
  const limit: number = Number(body?.limit ?? 25);

  await seedDefaultGenresIfEmpty();
  await markRefreshRequested();

  const AGENT_HTTP_URL = process.env.AGENT_HTTP_URL || "http://127.0.0.1:8000";
  try {
    const r = await fetch(`${AGENT_HTTP_URL}/myblog/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genres, limit }),
      // don’t cache; fail fast-ish
      cache: "no-store",
    });
    const data = await r.json();
    return NextResponse.json({ ok: r.ok, agent: data, genres, limit });
  } catch (e) {
    // If agent is down, still return 200 with ok:false so UI doesn’t crash
    return NextResponse.json({ ok: false, error: String(e), genres, limit });
  }
}
