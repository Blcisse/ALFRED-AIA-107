// app/myblog/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@/components/QueryProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CaretLeft, CaretRight, PlusCircle, Trash, ArrowsDownUp } from "@phosphor-icons/react";
import Link from "next/link";

type Article = {
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  imageUrl?: string | null;
  source?: string;           // e.g., "ESPN"
  publishedAt?: string;      // ISO
  url: string;               // original link
  genre: string;             // which genre used to fetch
  score?: number;            // optional popularity/importance score
};

type Genre = {
  id: string;
  name: string;
  rank: number; // lower = higher priority
};

const DAILY_REFRESH_HOURS = 24;

export default function MyBlogPage() {
  const { sendQuery, isProcessing } = useQuery();
  const [articles, setArticles] = useState<Article[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [newGenre, setNewGenre] = useState("");
  const [limit, setLimit] = useState(25);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState(""); // quick notepad for the feed if you want

  // Initial genres (NBA, Tech company IPO, AI) will be seeded by backend on first run.
  // If not present, we’ll add them optimistically for UX.
  const ensureSeedGenres = useCallback((loaded: Genre[]) => {
    if (!loaded.length) {
      const seed: Genre[] = [
        { id: cryptoRandomId(), name: "NBA", rank: 1 },
        { id: cryptoRandomId(), name: "Tech company IPO", rank: 2 },
        { id: cryptoRandomId(), name: "AI", rank: 3 },
      ];
      setGenres(seed);
    }
  }, []);

  async function fetchGenres() {
    const res = await fetch("/api/myblog/genres", { cache: "no-store" });
    if (!res.ok) {
      // optimistic fallback
      ensureSeedGenres([]);
      return;
    }
    const data = await res.json();
    const list: Genre[] = (data?.genres ?? []).sort((a: Genre, b: Genre) => a.rank - b.rank);
    setGenres(list);
    if (!list.length) ensureSeedGenres(list);
  }

  async function fetchArticles(limitVal = limit) {
    const res = await fetch(`/api/myblog?limit=${encodeURIComponent(limitVal)}`, { cache: "no-store" });
    if (!res.ok) {
      setArticles([]);
      return;
    }
    const data = await res.json();
    setArticles(Array.isArray(data?.articles) ? data.articles : []);
  }

  // daily refresh check (localStorage)
  const maybeDailyRefresh = useCallback(async () => {
    const key = "myblog:lastRefresh";
    const last = localStorage.getItem(key);
    const now = Date.now();
    const needsRefresh =
      !last || now - Number(last) > DAILY_REFRESH_HOURS * 60 * 60 * 1000;

    if (!needsRefresh) return;

    try {
      setBusy(true);
      // Ask our agent to refresh content for current genres (LLM chooses sources/articles).
      const genreNames = genres.sort((a, b) => a.rank - b.rank).map((g) => g.name);
      await fetch("/api/myblog/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres: genreNames, limit }),
      }).catch(() => { /* fallback to agent action if needed */ });

      // Optional: trigger via sendQuery (if you prefer unified agent entry)
      // await sendQuery("myblog.refresh", "Refresh myBlog articles", { genres: genreNames, limit });

      // Re-fetch the feed after refresh completes server-side.
      await fetchArticles(limit);
      localStorage.setItem(key, String(now));
    } finally {
      setBusy(false);
    }
  }, [genres, limit]);

  useEffect(() => {
    (async () => {
      await fetchGenres();
      await fetchArticles(limit);
    })();
  }, []);

  useEffect(() => {
    // after genres load, attempt daily refresh
    if (genres.length) {
      void maybeDailyRefresh();
    }
  }, [genres, maybeDailyRefresh]);

  function cryptoRandomId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return Math.random().toString(16).slice(2);
  }

  async function addGenre() {
    const val = newGenre.trim();
    if (!val) return;
    setAdding(true);
    try {
      const newG: Genre = {
        id: cryptoRandomId(),
        name: val,
        rank: (genres[genres.length - 1]?.rank ?? genres.length) + 1,
      };
      setGenres((prev) => [...prev, newG]);

      await fetch("/api/myblog/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newG),
      }).catch(() => {});
      setNewGenre("");
    } finally {
      setAdding(false);
    }
  }

  async function deleteGenre(id: string) {
    setGenres((prev) => prev.filter((g) => g.id !== id));
    await fetch(`/api/myblog/genres/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function updateGenreRank(id: string, nextRank: number) {
    if (!Number.isFinite(nextRank) || nextRank < 1) return;
    setGenres((prev) => {
      const copy = prev.map((g) => (g.id === id ? { ...g, rank: nextRank } : g));
      return copy.sort((a, b) => a.rank - b.rank);
    });
    await fetch(`/api/myblog/genres/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rank: nextRank }),
    }).catch(() => {});
  }

  async function manualRefresh() {
    setBusy(true);
    try {
      const genreNames = genres.slice().sort((a,b)=>a.rank-b.rank).map(g=>g.name);
      await fetch("/api/myblog/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres: genreNames, limit }),
      });
      await fetchArticles(limit);
      localStorage.setItem("myblog:lastRefresh", String(Date.now()));
    } finally {
      setBusy(false);
    }
  }
  
  

  // A super-light month/page navigator for fun (optional)
  const [page, setPage] = useState(0);
  const pagedArticles = useMemo(() => {
    // simple virtual paging groups of ~10
    const pageSize = 10;
    const start = page * pageSize;
    return articles.slice(start, start + pageSize);
  }, [articles, page]);

  return (
    <main className="flex flex-col items-center justify-start min-h-screen pt-16 bg-transparent">
      {/* Top Section */}
      <header className="w-full max-w-6xl px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">myBlog</h1>
            <p className="text-white/70 text-sm">
              Your personal, genre-driven newsfeed. Refreshed daily via AI.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={manualRefresh}
              disabled={busy || isProcessing}
              className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white"
            >
              {busy ? "Refreshing..." : "Refresh now"}
            </Button>
            <div className="flex items-center gap-2">
              <label className="text-white/80 text-sm">Daily cap</label>
              <Input
                type="number"
                min={5}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Math.max(5, Math.min(50, Number(e.target.value) || 25)))}
                className="w-20 bg-transparent text-white placeholder-white"
              />
            </div>
          </div>
        </div>

        {/* Genre Manager */}
        <section
          aria-label="myBlog genres"
          className="mt-6 rounded-2xl border border-white/20 p-4 bg-black/30 backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-white font-semibold text-lg">Your genres (priority rank ↑)</h2>

            <div className="flex items-center gap-2">
              <Input
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                placeholder="Add a genre (e.g., ‘Rugby’)"
                className="bg-transparent text-white placeholder-white"
              />
              <Button
                onClick={addGenre}
                disabled={adding || !newGenre.trim()}
                className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white"
              >
                <PlusCircle size={18} />
              </Button>
            </div>
          </div>

          <ul className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {genres
              .slice()
              .sort((a, b) => a.rank - b.rank)
              .map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/20 p-3 bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-white"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                        border: "1px solid rgba(255,255,255,0.18)",
                      }}
                      title="Rank (1 = highest priority)"
                    >
                      {g.rank}
                    </span>
                    <span className="text-white font-medium">{g.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowsDownUp className="text-white/70" size={18} />
                    <Input
                      type="number"
                      min={1}
                      value={g.rank}
                      onChange={(e) => updateGenreRank(g.id, Math.max(1, Number(e.target.value) || g.rank))}
                      className="w-20 bg-transparent text-white placeholder-white"
                      title="Set rank (1 = highest)"
                    />
                    <Button
                      variant="destructive"
                      onClick={() => deleteGenre(g.id)}
                      className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white"
                      title="Delete genre"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </li>
              ))}
          </ul>

          <p className="mt-2 text-xs text-white/60">
            myBlog fetches up to <strong>{limit}</strong> articles/day, from highest to lowest ranked genre.
            We also surface the top two cards per genre above the list of titles.
          </p>
        </section>
      </header>

      {/* Feed */}
      <section className="w-full max-w-6xl px-4 mt-8">
        {/* Featured cards (top 2 per genre, preserving genre priority) */}
        <div className="space-y-6">
          {groupTopTwoByGenre(articles, genres).map((block) => (
            <div key={block.genre} className="space-y-3">
              <h3 className="text-white/90 font-semibold">{block.genre}</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {block.articles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Paginated scroll for the rest (stack list) */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white/80 font-semibold">All titles today</h4>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white"
              >
                <CaretLeft />
              </Button>
              <Button
                onClick={() => setPage((p) => p + 1)}
                className="bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] text-white"
              >
                <CaretRight />
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-white/10 rounded-2xl border border-white/20 bg-black/30 backdrop-blur-md overflow-hidden">
            {pagedArticles.map((a) => (
              <li key={a.id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex flex-row gap-3 items-start">
                  {/* small thumbnail on list view */}
                  <div
                    className="flex-shrink-0 rounded-lg overflow-hidden"
                    style={{ width: 64, height: 64, border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {a.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.imageUrl}
                        alt={a.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold truncate">{a.title}</span>
                      {a.source && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/70">
                          {a.source}
                        </span>
                      )}
                      {a.publishedAt && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/60">
                          {new Date(a.publishedAt).toLocaleString()}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/60">
                        {a.genre}
                      </span>
                    </div>
                    {a.subtitle && <p className="text-white/80 text-sm mt-1">{a.subtitle}</p>}
                  </div>

                  <Link
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10"
                    title="Open original article"
                  >
                    Go to article
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Optional quick notes attached to feed (just local for now) */}
        <div className="mt-8">
          <h4 className="text-white/80 font-semibold mb-2">Quick notes</h4>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jot down ideas, to-dos, or angles to explore from today’s feed…"
            className="w-full min-h-[120px] bg-transparent text-white placeholder-white border border-white/20"
          />
        </div>
      </section>

      <style jsx>{`
        /* Cards keep our “notes-like” modern look */
      `}</style>
    </main>
  );
}

/** Helpers */

function groupTopTwoByGenre(articles: Article[], genres: Genre[]) {
  // Respect rank order; take top 2 per genre in that order
  const order = genres.slice().sort((a, b) => a.rank - b.rank).map((g) => g.name);
  const map: Record<string, Article[]> = {};
  for (const g of order) {
    map[g] = [];
  }
  for (const a of articles) {
    if (!map[a.genre]) continue;
    if (map[a.genre].length < 2) map[a.genre].push(a);
  }
  return order
    .filter((g) => map[g].length)
    .map((g) => ({ genre: g, articles: map[g] }));
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-black/30 backdrop-blur-md p-3 overflow-hidden">
      <div className="flex gap-3">
        <div
          className="flex-shrink-0 rounded-xl overflow-hidden"
          style={{
            width: 120,
            minWidth: 120,
            height: 90,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-white/5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-white font-semibold truncate">{article.title}</h5>
            {article.source && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/70">
                {article.source}
              </span>
            )}
            {article.publishedAt && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/60">
                {new Date(article.publishedAt).toLocaleString()}
              </span>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/60">
              {article.genre}
            </span>
          </div>
          {article.subtitle && <p className="text-white/80 text-sm mt-1">{article.subtitle}</p>}
          {article.snippet && (
            <p className="text-white/70 text-[13px] mt-1 line-clamp-3">{article.snippet}</p>
          )}
          <div className="mt-2">
            <Link
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10"
              title="Open original article"
            >
              Go to article
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
