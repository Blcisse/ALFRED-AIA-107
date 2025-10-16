// read ?limit and optional ?sinceHours (default 36)
const { searchParams } = new URL(req.url);
const limit = Number(searchParams.get("limit") ?? 25);
const sinceHours = Number(searchParams.get("sinceHours") ?? 36);

// load your DB (whatever helper you use)
const all = await loadArticles(); // [{ fetchedAt: "2025-09-10T15:40:00Z", ... }]

const cutoff = Date.now() - sinceHours * 3600 * 1000;
const fresh = all.filter(a => new Date(a.fetchedAt).getTime() >= cutoff);

// sort newest first and cap
fresh.sort((a,b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
return NextResponse.json({ articles: fresh.slice(0, limit) });
