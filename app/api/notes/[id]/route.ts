// app/api/notes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type Note = {
  id: number;
  title: string;
  content: string;
  folderId: number | null;
};

const DATA_DIR = path.join(process.cwd(), "data", "app");
const NOTES_PATH = path.join(DATA_DIR, "notes.json");

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(NOTES_PATH);
  } catch {
    await fs.writeFile(NOTES_PATH, "[]", "utf-8");
  }
}

async function readNotes(): Promise<Note[]> {
  await ensureDataFiles();
  const raw = await fs.readFile(NOTES_PATH, "utf-8");
  try {
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

async function writeNotes(notes: Note[]) {
  await ensureDataFiles();
  await fs.writeFile(NOTES_PATH, JSON.stringify(notes, null, 2), "utf-8");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const notes = await readNotes();
  const note = notes.find((n) => n.id === id);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const notes = await readNotes();
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const current = notes[idx];
    const next: Note = {
      ...current,
      title: body.title !== undefined ? String(body.title) : current.title,
      content:
        body.content !== undefined
          ? String(body.content)
          : body.body !== undefined
          ? String(body.body)
          : current.content,
      folderId:
        body.folderId === undefined || body.folderId === ""
          ? current.folderId
          : body.folderId === null
          ? null
          : Number(body.folderId),
    };

    notes[idx] = next;
    await writeNotes(notes);
    return NextResponse.json(next);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Bad Request" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const notes = await readNotes();
  const next = notes.filter((n) => n.id !== id);
  if (next.length === notes.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await writeNotes(next);
  return NextResponse.json({ ok: true });
}
