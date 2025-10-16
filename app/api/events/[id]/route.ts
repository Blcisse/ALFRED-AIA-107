// app/api/events/[id]/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "app");
const EVENTS_PATH = path.join(DATA_DIR, "events.json");

async function loadAll() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(EVENTS_PATH);
  } catch {
    await fs.writeFile(EVENTS_PATH, "[]", "utf8");
  }
  const raw = await fs.readFile(EVENTS_PATH, "utf8");
  return JSON.parse(raw) as any[];
}

async function saveAll(events: any[]) {
  await fs.writeFile(EVENTS_PATH, JSON.stringify(events, null, 2), "utf8");
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const payload = await req.json().catch(() => ({}));
  const events = await loadAll();
  const e = events.find((x) => x.id === id);
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof payload.title === "string") e.title = payload.title;
  if (typeof payload.date === "string") e.date = payload.date;
  if (typeof payload.time === "string") e.time = payload.time;
  if (typeof payload.note === "string") e.note = payload.note;

  await saveAll(events);
  return NextResponse.json({ event: e });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const events = await loadAll();
  const next = events.filter((x) => x.id !== id);
  const deleted = next.length !== events.length;
  await saveAll(next);
  return NextResponse.json({ deleted });
}
