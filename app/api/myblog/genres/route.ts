// app/api/myblog/genres/route.ts
import { NextRequest, NextResponse } from "next/server";
import { addGenre, getGenres, seedDefaultGenresIfEmpty } from "@/lib/myblogStore";
import { Genre } from "@/lib/myblogTypes";

export async function GET() {
  const seeded = await seedDefaultGenresIfEmpty();
  return NextResponse.json({ genres: await getGenres() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<Genre>;
  if (!body || !body.id || !body.name || typeof body.rank !== "number") {
    return NextResponse.json({ error: "Invalid genre payload" }, { status: 400 });
  }
  await addGenre({ id: body.id, name: body.name.trim(), rank: Math.max(1, Math.floor(body.rank)) });
  return NextResponse.json({ ok: true });
}
