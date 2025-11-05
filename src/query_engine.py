# Developed By Balla Cisse.
# Alfred AIA
# Version 1.0.7
# src/query_engine.py
# Version 1.0.7

from __future__ import annotations

import os
import re
import io
import json
import time
import math
import html
import uuid
import hashlib
import logging
import pathlib
import datetime as dt
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

import requests
from bs4 import BeautifulSoup  # pip install beautifulsoup4
from chromadb import PersistentClient

# Optional: if you don't want to add a dep, we also parse XML with stdlib
import xml.etree.ElementTree as ET

# Optional OpenAI summarization for nicer snippets
# pip install openai (>=1.0)
try:
    from openai import OpenAI  # type: ignore
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore

log = logging.getLogger("query_engine")
logging.basicConfig(level=logging.INFO)


# =============================================================================
# Paths & persistence
# =============================================================================

ROOT = pathlib.Path(__file__).resolve().parent
STORAGE_DIR = ROOT.parent / "storage" / "query_engine_store"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
VAR_DIR = ROOT.parent / "var"
VAR_DIR.mkdir(parents=True, exist_ok=True)

client = PersistentClient(path=str(STORAGE_DIR))
collection = client.get_or_create_collection("aia107_documents")

TASKS_FILE = VAR_DIR / "tasks.json"
EVENTS_FILE = VAR_DIR / "events.json"
FOLDERS_FILE = VAR_DIR / "folders.json"
NOTES_FILE = VAR_DIR / "notes.json"

def _read_json(path: pathlib.Path, default):
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return default

def _write_json(path: pathlib.Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), "utf-8")

def _now_iso() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _next_id(items: List[Dict[str, Any]]) -> int:
    return (max((it.get("id", 0) for it in items), default=0) or 0) + 1


# =============================================================================
# TASKS
# =============================================================================

def list_tasks() -> List[Dict[str, Any]]:
    data = _read_json(TASKS_FILE, [])
    return data

def add_task(text: str, importance: str = "medium", note: str = "") -> Dict[str, Any]:
    text = (text or "").strip()
    importance = (importance or "medium").lower()
    if importance not in ("low", "medium", "high"):
        importance = "medium"
    tasks = _read_json(TASKS_FILE, [])
    task = {
        "id": _next_id(tasks),
        "text": text,
        "completed": False,
        "note": note or "",
        "importance": importance,
        "createdAt": _now_iso(),
    }
    tasks.append(task)
    _write_json(TASKS_FILE, tasks)
    return task

def mark_task_complete(task_id: Optional[int] = None, text: Optional[str] = None) -> Dict[str, Any]:
    tasks = _read_json(TASKS_FILE, [])
    target = None
    if task_id is not None:
        target = next((t for t in tasks if t.get("id") == task_id), None)
    elif text:
        target = next((t for t in tasks if (t.get("text") or "").strip().lower() == text.strip().lower()), None)

    if not target:
        return {"ok": False, "error": "Task not found"}

    target["completed"] = not bool(target.get("completed"))
    target["updatedAt"] = _now_iso()
    _write_json(TASKS_FILE, tasks)
    return {"ok": True, "task": target}

def delete_task(task_id: Optional[int] = None, text: Optional[str] = None) -> bool:
    tasks = _read_json(TASKS_FILE, [])
    before = len(tasks)
    if task_id is not None:
        tasks = [t for t in tasks if t.get("id") != task_id]
    elif text:
        tasks = [t for t in tasks if (t.get("text") or "").strip().lower() != text.strip().lower()]
    else:
        return False
    _write_json(TASKS_FILE, tasks)
    return len(tasks) < before


# =============================================================================
# EVENTS
# =============================================================================

def list_events() -> List[Dict[str, Any]]:
    return _read_json(EVENTS_FILE, [])

def add_event(title: str, date: str, time_str: str = "", note: str = "") -> Dict[str, Any]:
    events = _read_json(EVENTS_FILE, [])
    ev = {
        "id": _next_id(events),
        "title": (title or "").strip(),
        "date": date,   # 'YYYY-MM-DD'
        "time": time_str or "",
        "note": note or "",
        "createdAt": _now_iso(),
    }
    events.append(ev)
    _write_json(EVENTS_FILE, events)
    return ev

def delete_event(event_id: int) -> bool:
    events = _read_json(EVENTS_FILE, [])
    before = len(events)
    events = [e for e in events if e.get("id") != event_id]
    _write_json(EVENTS_FILE, events)
    return len(events) < before


# =============================================================================
# FOLDERS & NOTES
# =============================================================================

def list_folders() -> List[Dict[str, Any]]:
    return _read_json(FOLDERS_FILE, [])

def add_folder(name: str) -> Dict[str, Any]:
    folders = _read_json(FOLDERS_FILE, [])
    folder = {"id": _next_id(folders), "name": (name or "").strip(), "createdAt": _now_iso()}
    folders.append(folder)
    _write_json(FOLDERS_FILE, folders)
    return folder

def delete_folder(folder_id: int) -> bool:
    folders = _read_json(FOLDERS_FILE, [])
    notes = _read_json(NOTES_FILE, [])

    folders = [f for f in folders if f.get("id") != folder_id]
    notes = [n for n in notes if n.get("folder_id") != folder_id]

    _write_json(FOLDERS_FILE, folders)
    _write_json(NOTES_FILE, notes)
    return True

def rename_folder(folder_id: int, name: str) -> Dict[str, Any]:
    folders = _read_json(FOLDERS_FILE, [])
    f = next((x for x in folders if x.get("id") == folder_id), None)
    if not f:
        return {"ok": False, "error": "Folder not found"}
    f["name"] = (name or "").strip()
    f["updatedAt"] = _now_iso()
    _write_json(FOLDERS_FILE, folders)
    return {"ok": True, "folder": f}

def list_notes() -> List[Dict[str, Any]]:
    return _read_json(NOTES_FILE, [])

def add_note(title: str, content: str = "", folder_id: Optional[int] = None) -> Dict[str, Any]:
    notes = _read_json(NOTES_FILE, [])
    note = {
        "id": _next_id(notes),
        "title": (title or "").strip(),
        "content": content or "",
        "folder_id": folder_id,
        "createdAt": _now_iso(),
    }
    notes.append(note)
    _write_json(NOTES_FILE, notes)
    return note

def delete_note(note_id: int) -> bool:
    notes = _read_json(NOTES_FILE, [])
    before = len(notes)
    notes = [n for n in notes if n.get("id") != note_id]
    _write_json(NOTES_FILE, notes)
    return len(notes) < before

def rename_note(note_id: int, name: str) -> Dict[str, Any]:
    notes = _read_json(NOTES_FILE, [])
    n = next((x for x in notes if x.get("id") == note_id), None)
    if not n:
        return {"ok": False, "error": "Note not found"}
    n["title"] = (name or "").strip()
    n["updatedAt"] = _now_iso()
    _write_json(NOTES_FILE, notes)
    return {"ok": True, "note": n}

def update_note_content(note_id: int, content: str) -> Dict[str, Any]:
    notes = _read_json(NOTES_FILE, [])
    n = next((x for x in notes if x.get("id") == note_id), None)
    if not n:
        return {"ok": False, "error": "Note not found"}
    n["content"] = content or ""
    n["updatedAt"] = _now_iso()
    _write_json(NOTES_FILE, notes)
    return {"ok": True, "note": n}

def get_note(note_id: int) -> Dict[str, Any]:
    notes = _read_json(NOTES_FILE, [])
    n = next((x for x in notes if x.get("id") == note_id), None)
    return n or {}

def get_note_by_title(title: str) -> Dict[str, Any]:
    title_l = (title or "").strip().lower()
    notes = _read_json(NOTES_FILE, [])
    return next((n for n in notes if (n.get("title") or "").strip().lower() == title_l), {})

def get_note_by_content(content: str) -> Dict[str, Any]:
    content_l = (content or "").strip().lower()
    notes = _read_json(NOTES_FILE, [])
    return next((n for n in notes if (n.get("content") or "").strip().lower() == content_l), {})

def get_note_by_folder_id(folder_id: int) -> List[Dict[str, Any]]:
    notes = _read_json(NOTES_FILE, [])
    return [n for n in notes if n.get("folder_id") == folder_id]

def get_note_by_title_and_content(title: str, content: str) -> Dict[str, Any]:
    title_l = (title or "").strip().lower()
    content_l = (content or "").strip().lower()
    notes = _read_json(NOTES_FILE, [])
    return next((n for n in notes
                 if (n.get("title") or "").strip().lower() == title_l
                 and (n.get("content") or "").strip().lower() == content_l), {})

def get_note_by_title_and_folder_id(title: str, folder_id: int) -> Dict[str, Any]:
    title_l = (title or "").strip().lower()
    notes = _read_json(NOTES_FILE, [])
    return next((n for n in notes
                 if (n.get("title") or "").strip().lower() == title_l
                 and n.get("folder_id") == folder_id), {})


# =============================================================================
# Lightweight RAG over ChromaDB collection
# =============================================================================

def run_rag_query(query: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Query the local ChromaDB collection and return top_k sources with scores.
    """
    try:
        t0 = time.perf_counter()
        log.info("[RAG] run_rag_query start query=%r top_k=%d", query, top_k)
        res = collection.query(query_texts=[query], n_results=max(1, int(top_k)))
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        ids = (res.get("ids") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        sources: List[Dict[str, Any]] = []
        for i, text in enumerate(docs):
            sources.append({
                "id": ids[i] if i < len(ids) else None,
                "text": text,
                "metadata": metas[i] if i < len(metas) else {},
                "score": (1.0 - float(dists[i])) if i < len(dists) and dists[i] is not None else None,
            })
        out = {"query": query, "sources": sources[: max(1, int(top_k))]}
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        log.info("[RAG] run_rag_query end results=%d elapsed_ms=%.1f", len(out["sources"]), elapsed_ms)
        return out
    except Exception as e:
        log.exception("run_rag_query error: %s", e)
        return {"query": query, "sources": []}

async def search_documents(query: str, top_k: int = 5):
    # Simple async wrapper
    try:
        log.info("[RAG] search_documents async wrapper query=%r top_k=%d", query, top_k)
        sources = run_rag_query(query, top_k=top_k).get("sources", [])[: max(1, int(top_k))]
        log.info("[RAG] search_documents async wrapper results=%d", len(sources))
        return sources
    except Exception:
        return []


# =============================================================================
# myBlog helpers: fetch → enrich → summarize → score → ingest
# =============================================================================

DEFAULT_INGEST_URL = os.getenv("MYBLOG_INGEST_URL") or "http://localhost:3000/api/myblog/ingest"
DEFAULT_INGEST_TOKEN = os.getenv("MYBLOG_INGEST_TOKEN") or ""

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36"
)

# Some reasonable default RSS queries (no paid API needed)
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"

DEFAULT_TIMEOUT = (6, 12)  # connect, read


def normalize_url(u: str) -> str:
    try:
        parsed = urlparse(u)
        # strip tracking params
        qs = [(k, v) for k, v in parse_qsl(parsed.query) if not k.lower().startswith("utm_")]
        parsed = parsed._replace(query=urlencode(qs, doseq=True), fragment="")
        return urlunparse(parsed)
    except Exception:
        return u


def http_get(url: str, headers: Optional[Dict[str, str]] = None, timeout=DEFAULT_TIMEOUT) -> Optional[requests.Response]:
    try:
        h = {"User-Agent": UA}
        if headers:
            h.update(headers)
        resp = requests.get(url, headers=h, timeout=timeout, allow_redirects=True)
        if 200 <= resp.status_code < 400:
            return resp
        return None
    except Exception:
        return None


def parse_google_news_rss(xml_text: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    try:
        root = ET.fromstring(xml_text)
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pubdate = (item.findtext("pubDate") or "").strip()
            description = (item.findtext("description") or "").strip()
            out.append({"title": title, "link": link, "pubDate": pubdate, "description": description})
    except Exception:
        pass
    return out


def fetch_news_items_for_query(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    url = GOOGLE_NEWS_RSS.format(query=requests.utils.quote(query))
    resp = http_get(url)
    if not resp:
        return []
    items = parse_google_news_rss(resp.text)
    return items[:limit]


def extract_og_metadata(url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Returns (og_title, og_description, og_image)
    """
    resp = http_get(url)
    if not resp:
        return (None, None, None)
    try:
        soup = BeautifulSoup(resp.text, "html.parser")
        def _meta(name: str):
            tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
            return (tag.get("content") or tag.get("value")) if tag else None

        og_title = _meta("og:title")
        og_desc = _meta("og:description") or _meta("twitter:description")
        og_img = _meta("og:image") or _meta("twitter:image")
        return (og_title, og_desc, og_img)
    except Exception:
        return (None, None, None)


def domain_of(u: str) -> str:
    try:
        return urlparse(u).netloc.lower()
    except Exception:
        return ""


def source_name_from_url(u: str) -> Optional[str]:
    d = domain_of(u)
    if not d:
        return None
    # strip common prefixes
    d = re.sub(r"^www\.", "", d)
    parts = d.split(".")
    # Take the registrable portion if possible (simple heuristic)
    if len(parts) >= 2:
        return parts[-2].upper() if parts[-1] in ("com", "net", "org", "io", "ai") else parts[-1].upper()
    return d.upper()


def sha_id(*pieces: str) -> str:
    h = hashlib.sha256()
    for p in pieces:
        h.update(p.encode("utf-8"))
    return h.hexdigest()[:16]


def openai_summarize(title: str, raw: str, max_words: int = 60) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (subtitle, snippet). If OpenAI not available, returns (None, trimmed).
    """
    text = (raw or "").strip()
    if not text:
        return (None, None)

    fallback = " ".join(text.split())[: max(140, max_words * 6)]
    if OpenAI is None:
        return (None, fallback)

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        prompt = (
            "You are a copy editor. Create:\n"
            "1) A concise subtitle (<= 14 words) that complements the title.\n"
            "2) A short snippet (<= 60 words) that previews the article without spoilers.\n"
            f"Title: {title}\n"
            f"Article text (may be truncated): {text}\n"
            "Respond as JSON: {\"subtitle\":\"...\",\"snippet\":\"...\"}"
        )
        resp = client.chat.completions.create(
            model=os.getenv("MYBLOG_SUMMARY_MODEL", "gpt-4o-mini"),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        content = resp.choices[0].message.content  # type: ignore
        data = json.loads(content) if content else {}
        sub = (data.get("subtitle") or "").strip() or None
        snip = (data.get("snippet") or "").strip() or None
        return (sub, snip or fallback)
    except Exception as e:
        log.warning("Summarize failed, using fallback: %s", e)
        return (None, fallback)


def recency_score(published_at_iso: Optional[str]) -> float:
    if not published_at_iso:
        return 0.3
    try:
        ts = dt.datetime.fromisoformat(published_at_iso.replace("Z", "+00:00")).timestamp()
        age_h = max(1.0, (time.time() - ts) / 3600.0)
        # newer is better; within 24h gets strong boost
        return 1.0 / math.log10(age_h + 10.0)
    except Exception:
        return 0.5


DOMAIN_WEIGHTS = {
    # A light authority prior (tune freely)
    "espn.com": 1.2,
    "nba.com": 1.1,
    "theverge.com": 1.1,
    "wsj.com": 1.15,
    "bloomberg.com": 1.2,
    "techcrunch.com": 1.1,
    "nytimes.com": 1.15,
    "mit.edu": 1.15,
    "nature.com": 1.15,
}

def authority_weight(u: str) -> float:
    d = domain_of(u)
    return DOMAIN_WEIGHTS.get(d, 1.0)


def best_guess_published_at(pub_date_str: str) -> Optional[str]:
    # Try RFC822 (common in RSS)
    try:
        from email.utils import parsedate_to_datetime
        dtv = parsedate_to_datetime(pub_date_str)
        if dtv:
            return dtv.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except Exception:
        pass
    return None


def build_article_from_item(item: Dict[str, Any], genre: str) -> Dict[str, Any]:
    title = html.unescape(item.get("title") or "").strip()
    url = normalize_url(item.get("link") or "")
    pub_iso = best_guess_published_at(item.get("pubDate") or "") or _now_iso()

    og_title, og_desc, og_img = extract_og_metadata(url)
    subtitle, snippet = openai_summarize(title, og_desc or item.get("description") or "")

    source = source_name_from_url(url)
    score = recency_score(pub_iso) * authority_weight(url)

    return {
        "id": sha_id(title, url),
        "genre": genre,
        "title": og_title or title,
        "subtitle": subtitle,
        "snippet": snippet,
        "imageUrl": og_img,
        "source": source,
        "url": url,
        "publishedAt": pub_iso,
        "score": float(f"{score:.5f}"),
        "fetchedAt": _now_iso(),
    }


def collect_articles_for_genre(genre: str, per_genre_limit: int = 8) -> List[Dict[str, Any]]:
    """
    Pull a handful of candidate items for a genre using Google News RSS;
    later you can specialize per-genre feeds.
    """
    q = genre
    # Specialize a few common ones to be more precise
    if genre.strip().lower() == "nba":
        q = "NBA basketball"
    elif genre.strip().lower() == "tech company ipo":
        q = "tech company IPO"
    elif genre.strip().lower() == "ai":
        q = "artificial intelligence OR AI model"

    items = fetch_news_items_for_query(q, limit=per_genre_limit)
    articles = []
    for it in items:
        try:
            art = build_article_from_item(it, genre=genre)
            articles.append(art)
        except Exception as e:
            log.debug("build_article_from_item failed: %s", e)
    # Keep the top few by score
    articles.sort(key=lambda a: (-(a.get("score") or 0), a.get("publishedAt") or ""), reverse=False)
    return articles[:per_genre_limit]


def refresh_myblog(
    genres: List[str],
    limit: int = 25,
    ingest_url: Optional[str] = None,
    ingest_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Orchestrates a full refresh:
      - For each genre (in given order), fetch candidates
      - Pick top 2 per genre for featured cards
      - Aggregate titles up to global 'limit'
      - POST to Next.js /api/myblog/ingest with bearer token
    """
    ingest_url = ingest_url or DEFAULT_INGEST_URL
    ingest_token = (ingest_token or DEFAULT_INGEST_TOKEN or "").strip()

    per_genre_cards = 2
    per_genre_candidates = 8

    all_articles: List[Dict[str, Any]] = []

    for g in genres:
        candidates = collect_articles_for_genre(g, per_genre_limit=per_genre_candidates)
        # Safety de-dupe by URL
        seen = set()
        deduped = []
        for c in candidates:
            key = normalize_url(c["url"])
            if key in seen:
                continue
            seen.add(key)
            deduped.append(c)

        # take 2 "feature cards"
        top_cards = deduped[:per_genre_cards]
        all_articles.extend(top_cards)

    # Fill remaining slots by walking genres in order again, adding more titles
    # from their remaining candidates until we reach the global limit.
    if len(all_articles) < limit:
        # Build a map genre -> remaining candidates
        per_genre_map: Dict[str, List[Dict[str, Any]]] = {}
        for g in genres:
            per_genre_map[g] = collect_articles_for_genre(g, per_genre_limit=per_genre_candidates)[per_genre_cards:]

        idx = 0
        while len(all_articles) < limit and any(per_genre_map.values()):
            g = genres[idx % len(genres)]
            bucket = per_genre_map.get(g) or []
            if bucket:
                all_articles.append(bucket.pop(0))
                per_genre_map[g] = bucket
            idx += 1

    # Cap to limit
    all_articles = all_articles[: max(5, min(50, limit))]

    # POST to ingest
    headers = {"Authorization": f"Bearer {ingest_token}"} if ingest_token else {}
    try:
        resp = requests.post(
            ingest_url,
            json={"articles": all_articles},
            headers=headers,
            timeout=DEFAULT_TIMEOUT,
        )
        ok = resp.status_code < 400
        if not ok:
            log.warning("Ingest failed (%s): %s", resp.status_code, resp.text[:300])
        return {"ok": ok, "count": len(all_articles), "status": getattr(resp, "status_code", None)}
    except Exception as e:
        log.exception("Ingest error: %s", e)
        return {"ok": False, "error": str(e), "count": len(all_articles)}
