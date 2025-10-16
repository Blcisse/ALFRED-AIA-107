# Developed By Balla Cisse.
# scripts/build_query_engine.py
# Version 1.0.7


"""
Build script for query engine RAG index.
This script builds the document index using the existing query_engine.py functionality.
"""

import os
import sys
import traceback
from pathlib import Path

# Add project root to path so we can import src modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

def main():
    print("=== Query Engine Build Script ===")
    print(f"Project root: {PROJECT_ROOT}")
    
    try:
        # Import the query engine module
        from src.query_engine import (
            PERSIST_DIR, 
            DOCS_DIR, 
            _build_index_if_missing, 
            LLAMA_INDEX_AVAILABLE,
            logger
        )
        
        print(f"Docs directory: {DOCS_DIR}")
        print(f"Persist directory: {PERSIST_DIR}")
        print(f"LlamaIndex available: {LLAMA_INDEX_AVAILABLE}")
        
        # Check if docs directory exists
        if not DOCS_DIR.exists():
            print(f"❌ Docs directory does not exist: {DOCS_DIR}")
            print("Please ensure you have documents in the data/docs directory.")
            return 1
        
        # Check if docs directory has files
        doc_files = list(DOCS_DIR.glob("*"))
        if not doc_files:
            print(f"❌ No files found in docs directory: {DOCS_DIR}")
            print("Please add some documents to build the index.")
            return 1
        
        print(f"📁 Found {len(doc_files)} files in docs directory:")
        for file in doc_files:
            print(f"  - {file.name}")
        
        # Check if LlamaIndex is available
        if not LLAMA_INDEX_AVAILABLE:
            print("❌ LlamaIndex is not available.")
            print("Please install llama-index: pip install llama-index")
            return 1
        
        # Build the index
        print("\n🔨 Building query engine index...")
        index = _build_index_if_missing()
        
        if index is not None:
            print("✅ Index built successfully!")
            print(f"📁 Index stored in: {PERSIST_DIR}")
            
            # Test the index with a simple query
            print("\n🧪 Testing index with sample query...")
            try:
                from src.query_engine import run_rag_query
                result = run_rag_query("test")
                print("✅ Index test successful!")
                print(f"Sample result: {result.get('reply', 'No reply')[:100]}...")
            except Exception as e:
                print(f"⚠️  Index test failed: {e}")
                print("Index was built but may have issues.")
            
            return 0
        else:
            print("❌ Failed to build index.")
            return 1
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're running this from the project root directory.")
        return 1
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
