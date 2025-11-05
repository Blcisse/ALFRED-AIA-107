# Developed By Balla Cisse.
# src/test_query_engine.py
# Version 1.0.7


import sys
from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer

def main():
    if len(sys.argv) < 2:
        print("Usage: python -m src.test_query_engine 'your question here'")
        sys.exit(1)

    query = sys.argv[1]
    print(f"\n🔍 Querying local AIA 107 vector store for:\n→ {query}\n")

    
    client = PersistentClient(path="storage/query_engine_store")
    collection = client.get_or_create_collection("aia107_documents")

    
    embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    query_embedding = embed_model.encode(query).tolist()

   
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3
    )

    if not results["documents"] or len(results["documents"][0]) == 0:
        print("⚠️ No results found — check if collection is populated.")
        return

   
    for i, doc in enumerate(results["documents"][0], start=1):
        print(f"\nResult {i}:")
        print("-" * 80)
        print(doc[:800])  
        print("\n...")

    print("\n✅ Query completed successfully.\n")

if __name__ == "__main__":
    main()
