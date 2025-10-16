export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "app");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");

async function loadAll() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(TASKS_PATH);
  } catch {
    await fs.writeFile(TASKS_PATH, "[]", "utf8");
  }
  const raw = await fs.readFile(TASKS_PATH, "utf8");
  return JSON.parse(raw) as any[];
}

async function saveAll(tasks: any[]) {
  await fs.writeFile(TASKS_PATH, JSON.stringify(tasks, null, 2), "utf8");
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const payload = await req.json().catch(() => ({}));
  const tasks = await loadAll();
  const t = tasks.find((x) => x.id === id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof payload.text === "string") t.text = payload.text;
  if (typeof payload.importance === "string") t.importance = payload.importance;
  if (typeof payload.note === "string") t.note = payload.note;
  if (typeof payload.completed === "boolean") t.completed = payload.completed;

  await saveAll(tasks);
  return NextResponse.json({ task: t });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const tasks = await loadAll();
  const next = tasks.filter((x) => x.id !== id);
  const deleted = next.length !== tasks.length;
  await saveAll(next);
  return NextResponse.json({ deleted });
}
