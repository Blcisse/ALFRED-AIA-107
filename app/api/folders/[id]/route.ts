// app/api/folders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type Folder = { id: number; name: string };

const DATA_DIR = path.join(process.cwd(), "data", "app");
const FOLDERS_PATH = path.join(DATA_DIR, "folders.json");

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FOLDERS_PATH);
  } catch {
    await fs.writeFile(FOLDERS_PATH, "[]", "utf-8");
  }
}

async function readFolders(): Promise<Folder[]> {
  await ensureDataFiles();
  const raw = await fs.readFile(FOLDERS_PATH, "utf-8");
  try {
    return JSON.parse(raw) as Folder[];
  } catch {
    return [];
  }
}

async function writeFolders(folders: Folder[]) {
  await ensureDataFiles();
  await fs.writeFile(FOLDERS_PATH, JSON.stringify(folders, null, 2), "utf-8");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const folders = await readFolders();
  const folder = folders.find((f) => f.id === id);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(folder);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const name: string | undefined = body.name !== undefined ? String(body.name) : undefined;

    const folders = await readFolders();
    const idx = folders.findIndex((f) => f.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const next = { ...folders[idx], ...(name !== undefined ? { name } : {}) };
    folders[idx] = next;
    await writeFolders(folders);
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
  const folders = await readFolders();
  const next = folders.filter((f) => f.id !== id);
  if (next.length === folders.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeFolders(next);
  return NextResponse.json({ ok: true });
}
