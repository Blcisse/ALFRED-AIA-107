// app/api/myblog/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { upsertArticles, seedDefaultGenresIfEmpty } from "@/lib/myblogStore";
import { Article } from "@/lib/myblogTypes";

const TOKEN = process.env.MYBLOG_INGEST_TOKEN || ""; // set in .env.local

export async function POST(req: NextRequest) {
  // simple bearer auth
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!TOKEN || token !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const articles: Article[] = Array.isArray(body?.articles) ? body.articles : [];

  if (!articles.length) {
    return NextResponse.json({ error: "No articles" }, { status: 400 });
  }

  // Ensure defaults exist
  await seedDefaultGenresIfEmpty();

  // Normalize + guard
  const cleaned = articles
    .filter(a => !!a?.url && !!a?.title && !!a?.genre)
    .map((a) => ({
      id: a.id || "",
      genre: String(a.genre),
      title: String(a.title),
      subtitle: a.subtitle ? String(a.subtitle) : undefined,
      snippet: a.snippet ? String(a.snippet) : undefined,
      imageUrl: a.imageUrl ? String(a.imageUrl) : null,
      source: a.source ? String(a.source) : undefined,
      url: String(a.url),
      publishedAt: a.publishedAt ? String(a.publishedAt) : undefined,
      score: typeof a.score === "number" ? a.score : undefined,
      fetchedAt: a.fetchedAt ? String(a.fetchedAt) : new Date().toISOString(),
    }));


    console.log("[myblog/ingest] received", Array.isArray(body?.articles) ? body.articles.length : 0, "articles");

  await upsertArticles(cleaned);
  return NextResponse.json({ ok: true, count: cleaned.length });

 
}
