// app/api/myblog/genres/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { updateGenreRank, deleteGenre } from "@/lib/myblogStore";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const rank = Number(body?.rank);
  if (!Number.isFinite(rank)) {
    return NextResponse.json({ error: "Missing/invalid rank" }, { status: 400 });
  }
  const updated = await updateGenreRank(params.id, rank);
  if (!updated) return NextResponse.json({ error: "Genre not found" }, { status: 404 });
  return NextResponse.json({ ok: true, genre: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await deleteGenre(params.id);
  return NextResponse.json({ ok: true });
}
