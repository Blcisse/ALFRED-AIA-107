#!/usr/bin/env python3
"""
Simple runner script for the Alfred agent.
This ensures proper Python path handling.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the agent
from src.agent107 import cli, WorkerOptions, entrypoint, prewarm

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
