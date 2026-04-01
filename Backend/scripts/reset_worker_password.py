import asyncio
import os
import sys

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db
from app.core.security import get_password_hash

async def reset_password():
    db = get_db()
    email = "worker1@omnix.com"
    new_password = "Worker@123"
    hashed = get_password_hash(new_password)
    
    print(f"Resetting password for {email}...")
    result = db.table('users').update({'password_hash': hashed}).eq('email', email).execute()
    
    if result.data:
        print(f"Successfully reset password for {email} to '{new_password}'")
    else:
        print(f"User {email} not found.")

if __name__ == "__main__":
    asyncio.run(reset_password())
