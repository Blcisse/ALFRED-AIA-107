import { NextResponse } from "next/server";

// ✅ Handles: GET /api/myblog?limit=25&sinceHours=36
export async function GET(request: Request) {
  try {
    // read ?limit and optional ?sinceHours (default 36)
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 25);
    const sinceHours = Number(searchParams.get("sinceHours") ?? 36);

    // load your DB (whatever helper you use)
    const all = await loadArticles(); // [{ fetchedAt: "2025-09-10T15:40:00Z", ... }]

    // filter by cutoff time
    const cutoff = Date.now() - sinceHours * 3600 * 1000;
    const fresh = all.filter(
      (a) => new Date(a.fetchedAt).getTime() >= cutoff
    );

    // sort newest first and cap
    fresh.sort(
      (a, b) =>
        new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
    );

    return NextResponse.json({ articles: fresh.slice(0, limit) });
  } catch (err) {
    console.error("GET /api/myblog error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// 🧩 Example helper (replace with your real one)
async function loadArticles() {
  // Replace with actual DB or file read logic
  // For now just return mock data
  return [
    {
      id: 1,
      title: "Sample Article",
      fetchedAt: new Date().toISOString(),
      content: "This is a placeholder article.",
    },
  ];
}
