# test_myblog_live.py
import os, requests, time, sys, json

BASE = os.getenv("MYBLOG_BASE_URL", "http://127.0.0.1:3000")
REFRESH = f"{BASE}/api/myblog/refresh"
FEED = f"{BASE}/api/myblog?limit=50"

genres = os.getenv("MYBLOG_GENRES", "NBA,Tech company IPO,AI").split(",")

def get_count():
    r = requests.get(FEED, timeout=(5,10))
    r.raise_for_status()
    return len(r.json().get("articles", []))

before = get_count()
print("Before:", before)

r = requests.post(REFRESH, json={"genres":[g.strip() for g in genres], "limit": 25}, timeout=(5,15))
print("Refresh ->", r.status_code, r.text[:200])

time.sleep(1.0)
after = get_count()
print("After :", after)

if after > before:
    print("✅ Live refresh worked.")
    sys.exit(0)
else:
    print("⚠️  No increase. Check agent HTTP, tokens, or cap/rank.")
    sys.exit(1)
