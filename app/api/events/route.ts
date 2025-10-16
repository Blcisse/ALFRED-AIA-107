// app/api/events/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "app");
const EVENTS_PATH = path.join(DATA_DIR, "events.json");

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(EVENTS_PATH);
  } catch {
    await fs.writeFile(EVENTS_PATH, "[]", "utf8");
  }
}

export async function GET() {
  await ensureFiles();
  const raw = await fs.readFile(EVENTS_PATH, "utf8");
  const events = JSON.parse(raw);
  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  await ensureFiles();
  const body = await req.json().catch(() => ({}));
  const { title, date, time = "", note = "" } = body || {};
  if (!title || !date) {
    return NextResponse.json({ error: "Missing 'title' or 'date'" }, { status: 400 });
  }
  const raw = await fs.readFile(EVENTS_PATH, "utf8");
  const events = JSON.parse(raw) as any[];
  const nextId = events.length ? events[events.length - 1].id + 1 : 1;
  const ev = { id: nextId, title, date, time, note };
  events.push(ev);
  await fs.writeFile(EVENTS_PATH, JSON.stringify(events, null, 2), "utf8");
  return NextResponse.json({ event: ev }, { status: 201 });
}
