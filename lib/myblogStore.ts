// lib/myblogStore.ts
import fs from "fs/promises";
import path from "path";
import { Article, Genre, MyBlogDB } from "./myblogTypes";

const DB_PATH = path.join(process.cwd(), "var", "myblog-db.json");

// Ensure directory exists
async function ensureDir() {
  const dir = path.dirname(DB_PATH);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function readDB(): Promise<MyBlogDB> {
  await ensureDir();
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as MyBlogDB;
    // Safety defaults
    parsed.genres ||= [];
    parsed.articles ||= [];
    return parsed;
  } catch {
    return { genres: [], articles: [] };
  }
}

async function writeDB(db: MyBlogDB) {
  await ensureDir();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function getGenres(): Promise<Genre[]> {
  const db = await readDB();
  return db.genres.sort((a, b) => a.rank - b.rank);
}

export async function seedDefaultGenresIfEmpty() {
  const db = await readDB();
  if (db.genres.length) return db.genres;
  db.genres = [
    { id: cryptoId(), name: "NBA", rank: 1 },
    { id: cryptoId(), name: "Tech company IPO", rank: 2 },
    { id: cryptoId(), name: "AI", rank: 3 },
  ];
  await writeDB(db);
  return db.genres;
}

export async function addGenre(g: Genre) {
  const db = await readDB();
  // Avoid duplicates by name (case-insensitive)
  if (!db.genres.some(x => x.name.toLowerCase() === g.name.toLowerCase())) {
    db.genres.push(g);
    db.genres.sort((a, b) => a.rank - b.rank);
    await writeDB(db);
  }
  return g;
}

export async function updateGenreRank(id: string, rank: number) {
  const db = await readDB();
  const g = db.genres.find(x => x.id === id);
  if (!g) return null;
  g.rank = Math.max(1, Math.floor(rank));
  db.genres.sort((a, b) => a.rank - b.rank);
  await writeDB(db);
  return g;
}

export async function deleteGenre(id: string) {
  const db = await readDB();
  db.genres = db.genres.filter(g => g.id !== id);
  await writeDB(db);
}

export async function listArticles(limit = 25): Promise<Article[]> {
  const db = await readDB();
  // We’ll show “today’s best” (by fetchedAt desc & genre priority, then score)
  const genres = db.genres.sort((a, b) => a.rank - b.rank).map(g => g.name);
  const today = new Date();
  const isSameDay = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getUTCFullYear() === today.getUTCFullYear() &&
           d.getUTCMonth() === today.getUTCMonth() &&
           d.getUTCDate() === today.getUTCDate();
  };

  const todays = db.articles.filter(a => isSameDay(a.fetchedAt));
  // Sort by genre priority, then score desc, then publishedAt desc
  todays.sort((a, b) => {
    const pa = genres.indexOf(a.genre);
    const pb = genres.indexOf(b.genre);
    const gCmp = (pa === -1 ? 1e9 : pa) - (pb === -1 ? 1e9 : pb);
    if (gCmp !== 0) return gCmp;
    const sCmp = (b.score ?? 0) - (a.score ?? 0);
    if (sCmp !== 0) return sCmp;
    const ta = a.publishedAt ? +new Date(a.publishedAt) : 0;
    const tb = b.publishedAt ? +new Date(b.publishedAt) : 0;
    return tb - ta;
  });

  return todays.slice(0, Math.max(5, Math.min(50, limit)));
}

export async function upsertArticles(payload: Article[]) {
  const db = await readDB();
  const mapByUrl = new Map(db.articles.map(a => [normalizeUrl(a.url), a]));
  for (const a of payload) {
    const key = normalizeUrl(a.url);
    const existing = mapByUrl.get(key);
    if (existing) {
      // Update important fields
      existing.title = a.title || existing.title;
      existing.subtitle = a.subtitle ?? existing.subtitle;
      existing.snippet = a.snippet ?? existing.snippet;
      existing.imageUrl = a.imageUrl ?? existing.imageUrl;
      existing.source = a.source ?? existing.source;
      existing.genre = a.genre ?? existing.genre;
      existing.publishedAt = a.publishedAt ?? existing.publishedAt;
      existing.score = a.score ?? existing.score;
      existing.fetchedAt = a.fetchedAt || new Date().toISOString();
    } else {
      db.articles.push({
        ...a,
        id: a.id || cryptoId(),
        fetchedAt: a.fetchedAt || new Date().toISOString(),
      });
    }
  }
  await writeDB(db);
}

export async function markRefreshRequested() {
  const db = await readDB();
  db.lastRefreshRequestedAt = new Date().toISOString();
  await writeDB(db);
}

function normalizeUrl(u: string) {
  try {
    const url = new URL(u);
    url.hash = "";
    // Strip common tracking params
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","si"].forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch {
    return u;
  }
}

function cryptoId() {
  // Node 18+ has crypto.randomUUID via global; fallback:
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
