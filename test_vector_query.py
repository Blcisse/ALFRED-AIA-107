import pickle
import faiss
from sentence_transformers import SentenceTransformer
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent
VAR_DIR = ROOT / "var"
VECTORSTORE_FILE = VAR_DIR / "vectorstore.pkl"
FAISS_INDEX_FILE = VAR_DIR / "vectorstore.index"

# Load metadata and embeddings
with open(VECTORSTORE_FILE, "rb") as f:
    store = pickle.load(f)

items = store["items"]
embeddings = store["embeddings"].astype("float32")

# Load FAISS index
import faiss
index = faiss.read_index(str(FAISS_INDEX_FILE))

# Prepare embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Example query
query = "ETL Processes"
query_vec = model.encode([query]).astype("float32")

# Search top 3 similar docs
D, I = index.search(query_vec, k=3)

print(f"Query: {query}\n")
for idx, score in zip(I[0], D[0]):
    doc = items[idx]
    print(f"- Title: {doc.get('title') or doc.get('id')}")
    print(f"  Source: {doc.get('source','N/A')}")
    snippet = doc.get("content") or doc.get("text") or ""
    print(f"  Snippet: {snippet[:150]}...\n")
