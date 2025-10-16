\// app/api/folders/route.ts
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

export async function GET() {
  const folders = await readFolders();
  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name: string = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const folders = await readFolders();
    const nextId = folders.length ? folders[folders.length - 1].id + 1 : 1;

    const folder: Folder = { id: nextId, name };
    folders.push(folder);
    await writeFolders(folders);
    return NextResponse.json(folder, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Bad Request" }, { status: 400 });
  }
}
