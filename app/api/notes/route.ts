// app/api/notes/route.ts
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

export async function GET() {
  const notes = await readNotes();
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept both "body" and "content" coming from the client
    const title: string = (body.title ?? "").toString();
    const content: string = (body.content ?? body.body ?? "").toString();
    const folderIdRaw = body.folderId;
    const folderId =
      folderIdRaw === null || folderIdRaw === undefined || folderIdRaw === ""
        ? null
        : Number(folderIdRaw);

    const notes = await readNotes();
    const nextId = notes.length ? notes[notes.length - 1].id + 1 : 1;

    const note: Note = {
      id: nextId,
      title: title || "Untitled",
      content: content || "",
      folderId: Number.isFinite(folderId as number) ? (folderId as number) : null,
    };

    notes.push(note);
    await writeNotes(notes);
    return NextResponse.json(note, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Bad Request" }, { status: 400 });
  }
}
