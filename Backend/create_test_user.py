#!/usr/bin/env python3
"""
Script to create a test user for development and testing purposes.
Run this script to create a test user that can be used to log into the application.
"""

import asyncio
import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import get_db
from app.services.auth_service import auth_service
from app.schemas.user import UserCreate

async def create_test_user():
    """Create a test user with known credentials."""
    try:
        db = get_db()

        # Test user data
        test_user = UserCreate(
            email="test@example.com",
            username="testuser",
            password="Test12345!",
            full_name="Test User",
            phone="1234567890",
            roles=["Planner", "Supervisor"]
        )

        # Check if user already exists
        existing = db.table("users").select("*").eq("email", test_user.email).execute()
        if existing.data:
            print("✅ Test user already exists!")
            print(f"Email: {test_user.email}")
            print(f"Username: {test_user.username}")
            print(f"Password: {test_user.password}")
            return

        # Create the user
        result = await auth_service.register(test_user)

        if result:
            print("✅ Test user created successfully!")
            print(f"Email: {test_user.email}")
            print(f"Username: {test_user.username}")
            print(f"Password: {test_user.password}")
            print("\nUse these credentials to log into the application.")
        else:
            print("❌ Failed to create test user")

    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Creating test user for OMNIX Manufacturing OS...")
    asyncio.run(create_test_user())
