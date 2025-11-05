# Developed By Balla Cisse.
# build_vectorstore.py
# Version 1.0.7


from pathlib import Path
import json
import pickle
from sentence_transformers import SentenceTransformer
import numpy as np


ROOT = Path(__file__).resolve().parent
VAR_DIR = ROOT / "var"  
DATA_DIR = ROOT / "data" / "docs" 
VAR_DIR.mkdir(exist_ok=True)

VECTORSTORE_FILE = VAR_DIR / "vectorstore.pkl"
JSON_FILES = ["tasks.json", "events.json", "folders.json", "notes.json", "features.json"]

for f in JSON_FILES:
    path = VAR_DIR / f
    if not path.exists():
        path.write_text("[]", encoding="utf-8")


items = []
texts = []

for f in JSON_FILES:
    path = VAR_DIR / f
    with open(path, "r", encoding="utf-8") as fp:
        data = json.load(fp)
        items.extend(data)
        for item in data:
            texts.append(item.get("text") or item.get("title") or item.get("content") or "")

if DATA_DIR.exists():
    for file_path in DATA_DIR.glob("**/*"):
        if file_path.suffix.lower() in ['.txt', '.md']:
            with open(file_path, "r", encoding="utf-8") as fp:
                content = fp.read().strip()
                if content:
                    items.append({"id": file_path.stem, "title": file_path.stem, "content": content, "source": str(file_path)})
                    texts.append(content)

model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(texts, show_progress_bar=True)


with open(VECTORSTORE_FILE, "wb") as f:
    pickle.dump({"items": items, "embeddings": embeddings}, f)

print(f"✅ Vectorstore created at {VECTORSTORE_FILE}")
print(f"- Total documents embedded: {len(items)}")
print(f"- Default JSON tool files initialized in {VAR_DIR}")
