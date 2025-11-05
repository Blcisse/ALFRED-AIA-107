# Developed By Balla Cisse.
# build_faiss_index.py
# Version 1.0.7



import pickle
import faiss
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VAR_DIR = ROOT / "var"
VECTORSTORE_FILE = VAR_DIR / "vectorstore.pkl"
FAISS_INDEX_FILE = VAR_DIR / "vectorstore.index"

with open(VECTORSTORE_FILE, "rb") as f:
    store = pickle.load(f)

embeddings = store["embeddings"]
items = store["items"]

emb_matrix = embeddings.astype("float32")

index = faiss.IndexFlatL2(emb_matrix.shape[1])  
index.add(emb_matrix)

faiss.write_index(index, str(FAISS_INDEX_FILE))

print(f"✅ FAISS vector index created at {FAISS_INDEX_FILE}")
print(f"- Total vectors indexed: {index.ntotal}")
