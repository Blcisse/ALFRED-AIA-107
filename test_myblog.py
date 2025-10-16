# test_myblog.py
"""
Usage:
  # 1) Real end-to-end (agent -> fetch -> ingest -> ui)
  export MYBLOG_INGEST_URL="http://localhost:3000/api/myblog/ingest"
  export MYBLOG_INGEST_TOKEN="super-secret-long-random-token"
  python test_myblog.py --limit 25 --genres "NBA,Tech company IPO,AI"

  # 2) Dummy ingest (bypass fetch; just tests token/route/DB)
  python test_myblog.py --dummy

Notes:
- Make sure Next.js is running and the token matches on both Python & Next.
- If your code lives in src/, this script will try to import from src/query_engine.py
"""

import os, sys, json, argparse, time
from typing import List
import requests

# --- Try to import query_engine from ./src if needed
try:
    import query_engine
except ImportError:
    sys.path.append(os.path.join(os.getcwd(), "src"))
    import query_engine  # type: ignore

BASE_URL = os.getenv("MYBLOG_BASE_URL", "http://localhost:3000")
INGEST_URL = os.getenv("MYBLOG_INGEST_URL", f"{BASE_URL}/api/myblog/ingest")
INGEST_TOKEN = os.getenv("MYBLOG_INGEST_TOKEN", "")
GET_FEED_URL = f"{BASE_URL}/api/myblog"

def check_feed(limit: int = 25):
    r = requests.get(f"{GET_FEED_URL}?limit={limit}", timeout=(5, 10))
    print(f"[GET] {GET_FEED_URL}?limit={limit} -> {r.status_code}")
    try:
        data = r.json()
    except Exception:
        print(r.text[:500])
        raise
    arts = data.get("articles", [])
    print(f"Articles returned: {len(arts)}")
    for a in arts[:5]:
        print(" -", a.get("genre"), "|", a.get("title"), "|", a.get("source"), "|", a.get("url"))

def do_refresh(genres: List[str], limit: int = 25):
    print("[agent] refresh_myblog(...) starting")
    res = query_engine.refresh_myblog(
        genres=genres,
        limit=limit,
        ingest_url=INGEST_URL,
        ingest_token=INGEST_TOKEN,
    )
    print("[agent] refresh_myblog result:", res)
    if not res.get("ok"):
        print("!! Refresh failed. Check URL/token/network.")

def dummy_ingest_one():
    print("[dummy] Posting 1 test article to ingest to validate token/route")
    headers = {}
    if INGEST_TOKEN:
        headers["Authorization"] = f"Bearer {INGEST_TOKEN}"
    payload = {
        "articles": [
            {
                "id": "dummy-1",
                "genre": "NBA",
                "title": "Dummy Lakers Win Title",
                "subtitle": "Testing ingest route",
                "snippet": "This is a placeholder article to validate ingest & DB wiring.",
                "imageUrl": None,
                "source": "TEST",
                "url": "https://example.com/dummy-lakers",
                "publishedAt": "2025-09-09T12:00:00Z",
                "score": 1.0,
                "fetchedAt": "2025-09-09T12:05:00Z",
            }
        ]
    }
    r = requests.post(INGEST_URL, headers=headers, json=payload, timeout=(5, 10))
    print("[dummy] ingest status:", r.status_code, r.text[:200])

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--genres", type=str, default="NBA,Tech company IPO,AI",
                   help="Comma-separated list, ranked left->right")
    p.add_argument("--dummy", action="store_true", help="Bypass fetch; ingest one test article")
    return p.parse_args()

if __name__ == "__main__":
    args = parse_args()
    genres = [g.strip() for g in args.genres.split(",") if g.strip()]

    print("BASE_URL       :", BASE_URL)
    print("INGEST_URL     :", INGEST_URL)
    print("INGEST_TOKEN   :", "set" if INGEST_TOKEN else "(empty)")
    print("Genres (ranked):", genres)
    print("Limit          :", args.limit)

    if args.dummy:
        dummy_ingest_one()
        check_feed(limit=args.limit)
        sys.exit(0)

    # Real flow: agent fetch -> ingest -> verify
    do_refresh(genres, limit=args.limit)
    # small delay to let Next write to disk
    time.sleep(1.0)
    check_feed(limit=args.limit)
