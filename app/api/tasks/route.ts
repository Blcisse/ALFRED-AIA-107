export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "app");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TASKS_PATH);
  } catch {
    await fs.writeFile(TASKS_PATH, "[]", "utf8");
  }
}

export async function GET() {
  await ensureFiles();
  const raw = await fs.readFile(TASKS_PATH, "utf8");
  const tasks = JSON.parse(raw);
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  await ensureFiles();
  const body = await req.json().catch(() => ({}));
  const { text, importance = "medium", note = "" } = body || {};
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });
  }
  const raw = await fs.readFile(TASKS_PATH, "utf8");
  const tasks = JSON.parse(raw) as any[];
  const nextId = tasks.length ? tasks[tasks.length - 1].id + 1 : 1;
  const task = { id: nextId, text, completed: false, note, importance };
  tasks.push(task);
  await fs.writeFile(TASKS_PATH, JSON.stringify(tasks, null, 2), "utf8");
  return NextResponse.json({ task }, { status: 201 });
}
