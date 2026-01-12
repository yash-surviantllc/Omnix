"""
Run with: python run_debug.py
"""
import sys
import os
from pathlib import Path

# Add the current directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.absolute()))

# Now import and run the debug script
from scripts import debug_po
import asyncio

if __name__ == "__main__":
    asyncio.run(debug_po.main())
