#!/usr/bin/env python3
"""
Development server script for Manufacturing OS
Runs the server without reload for more stable development
"""

import uvicorn
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🚀 Starting Manufacturing OS Development Server (No Reload)")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disable reload for stability
        log_level="info"
    )
