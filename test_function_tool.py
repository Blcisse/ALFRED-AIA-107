#!/usr/bin/env python3
"""
Test script to verify the search_documents function tool is working.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.agent107 import Assistant
from src.query_engine import search_documents

def test_search_documents():
    """Test the search_documents function directly."""
    print("Testing search_documents function directly...")
    try:
        results = search_documents("test", top_k=3)
        print(f"Direct search results: {results}")
        return True
    except Exception as e:
        print(f"Error in direct search: {e}")
        return False

def test_assistant_tool():
    """Test the Assistant class and its tool."""
    print("Testing Assistant class...")
    try:
        assistant = Assistant()
        print("Assistant created successfully")
        
        # Check if the tool method exists
        if hasattr(assistant, 'search_documents_tool'):
            print("search_documents_tool method found")
            
            # Test the tool method
            results = assistant.search_documents_tool("test", 3)
            print(f"Tool search results: {results}")
            return True
        else:
            print("search_documents_tool method not found")
            return False
    except Exception as e:
        print(f"Error in assistant test: {e}")
        return False

if __name__ == "__main__":
    print("=== Testing search_documents functionality ===\n")
    
    # Test 1: Direct function call
    print("1. Testing direct search_documents function:")
    test1_success = test_search_documents()
    print()
    
    # Test 2: Assistant tool method
    print("2. Testing Assistant search_documents_tool method:")
    test2_success = test_assistant_tool()
    print()
    
    # Summary
    print("=== Test Summary ===")
    print(f"Direct function test: {'PASS' if test1_success else 'FAIL'}")
    print(f"Assistant tool test: {'PASS' if test2_success else 'FAIL'}")
    
    if test1_success and test2_success:
        print("\n✅ All tests passed! The search_documents functionality should work in the agent.")
    else:
        print("\n❌ Some tests failed. Check the errors above.")