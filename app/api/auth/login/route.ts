// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw) as Array<{ id: string; name: string; code: string }>;
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!/^\d{4}$/.test(code || "")) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const users = await readUsers();
    const user = users.find((u) => u.code === code);
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set("session_user", user.id, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
