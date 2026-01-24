#!/usr/bin/env python3
"""
Script to create an admin user with specific credentials.
"""

import asyncio
import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import get_db
from app.core.security import get_password_hash

async def create_admin_user():
    """Create an admin user with known credentials."""
    try:
        db = get_db()

        # Admin credentials
        username = "admin"
        password = "Admin@123"
        email = "admin@omnix.com"
        full_name = "Administrator"

        # Check if user already exists
        existing = db.table("users").select("*").eq("username", username).execute()
        if existing.data:
            print("✅ Admin user already exists!")
            print(f"Username: {username}")
            print(f"Password: {password}")
            return

        # Hash password
        password_hash = get_password_hash(password)

        # Create the user
        user_result = db.table("users").insert({
            "email": email,
            "username": username,
            "password_hash": password_hash,
            "full_name": full_name,
            "is_active": True,
            "is_verified": True,
        }).execute()

        if user_result.data:
            user_id = user_result.data[0]['id']
            
            # Get admin role
            admin_role = db.table('roles').select('id').eq('name', 'admin').execute()
            
            if admin_role.data:
                # Assign admin role
                db.table('user_roles').insert({
                    'user_id': user_id,
                    'role_id': admin_role.data[0]['id']
                }).execute()
                
                print("✅ Admin user created successfully!")
                print(f"Username: {username}")
                print(f"Password: {password}")
                print("\nUse these credentials to log into the application.")
            else:
                print("⚠️ Admin role not found in database")
        else:
            print("❌ Failed to create admin user")

    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Creating admin user for OMNIX Manufacturing OS...")
    asyncio.run(create_admin_user())
