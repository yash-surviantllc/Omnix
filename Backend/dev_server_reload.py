#!/usr/bin/env python3
"""
Reload-enabled development server script for Manufacturing OS
Use this if reload is needed but with better stability
"""

import uvicorn
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🔄 Starting Manufacturing OS Development Server (With Reload)")
    print("=" * 60)
    print("Note: If you experience crashes, use dev_server.py instead")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_delay=3.0,  # Longer delay
        reload_includes=["*.py"],
        reload_excludes=["__pycache__", "*.pyc", ".git", "logs", "venv", "node_modules", "*.log"],
        log_level="info"
    )
