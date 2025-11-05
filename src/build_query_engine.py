# Developed By Balla Cisse.
# src/build_query_engine.py
# Version 1.0.7


print("\n[DEBUG] Running build_query_engine")
from pathlib import Path
print("[DEBUG] CWD:", Path.cwd())
print("[DEBUG] data/docs exists:", Path("data/docs").exists())
print("[DEBUG] data/docs contents:", list(Path("data/docs").glob('*')))

import pathlib
from pathlib import Path


import os
from tqdm import tqdm
from datetime import datetime


from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from chromadb import PersistentClient



ROOT = Path(__file__).resolve().parent
STORAGE_DIR = ROOT.parent / "storage" / "query_engine_store"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


DOCS_DIR = ROOT.parent / "data" / "docs"
COLLECTION_NAME = "aia107_documents"
MODEL_NAME = "all-MiniLM-L6-v2"


client = PersistentClient(path=str(STORAGE_DIR))
collection_name = "aia107_documents"


collection = client.get_or_create_collection(collection_name)


embed_model = SentenceTransformer("all-MiniLM-L6-v2")


def load_documents():
    """Load all .txt, .md, .json files from data/docs."""
    docs = []
    metas = []
    ids = []
    allowed_ext = {".txt", ".md", ".json"}

    print(f"\n[•] Loading source documents from: {DOCS_DIR}")

    for path in sorted(DOCS_DIR.rglob("*")):
        if path.is_file() and path.suffix.lower() in allowed_ext:
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
                if len(text.strip()) == 0:
                    continue
                docs.append(text)
                metas.append({"source": str(path.name)})
                ids.append(str(path))
            except Exception as e:
                print(f"    [!] Skipped {path}: {e}")

    print(f"[✓] Loaded {len(docs)} valid documents.\n")
    return docs, metas, ids


def chunk_text(text, chunk_size=800, overlap=100):
    """Simple overlapping chunker for long docs."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def preprocess_documents(docs, metas, ids):
    """Chunk each document and repeat metadata accordingly."""
    chunked_docs, chunked_metas, chunked_ids = [], [], []
    for doc, meta, id_ in zip(docs, metas, ids):
        chunks = chunk_text(doc)
        for i, c in enumerate(chunks):
            chunked_docs.append(c)
            chunked_metas.append(meta)
            chunked_ids.append(f"{id_}_chunk{i}")
    return chunked_docs, chunked_metas, chunked_ids




def build_query_engine():
    print("============================================")
    print("   AIA 107 Query Engine - Build Procedure   ")
    print("============================================")

    docs, metas, ids = load_documents()
    docs, metas, ids = preprocess_documents(docs, metas, ids)

    print(f"[•] Total chunks to embed: {len(docs)}")

    embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=MODEL_NAME
    )

    client = PersistentClient(path="storage/query_engine_store")


    
    existing = [c.name for c in client.list_collections()]
    if COLLECTION_NAME in existing:
        print("[•] Removing existing collection...")
        client.delete_collection(COLLECTION_NAME)

    print("[•] Creating new collection...")
    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_function,
        metadata={"built_at": datetime.now().isoformat()}
    )

    print("[•] Embedding and adding documents...")
    collection.add(documents=docs, metadatas=metas, ids=ids)

    
    print(f"\n[✓] Query engine built and stored in: {STORAGE_DIR}\n")
    print(f"[✓] Total documents embedded: {len(docs)}")
    print("[✓] Collection name:", COLLECTION_NAME)
    print("[✓] Embedding model:", MODEL_NAME)
    print("============================================")



if __name__ == "__main__":
    build_query_engine()
