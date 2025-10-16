// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function readUsers(): Promise<Array<{ id: string; name: string; code: string; createdAt: string }>> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeUsers(users: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export async function POST(req: Request) {
  try {
    const { name, code } = await req.json();

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(code || "")) {
      return NextResponse.json({ error: "Code must be exactly 4 digits" }, { status: 400 });
    }

    const users = await readUsers();
    if (users.some((u) => u.code === code)) {
      return NextResponse.json({ error: "Code already in use" }, { status: 409 });
    }

    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      code,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeUsers(users);

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set("session_user", user.id, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }
}
