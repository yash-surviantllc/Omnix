import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db
from app.core.security import get_password_hash

db = get_db()

# Check if admin exists
existing = db.table('users').select('id').eq('username', 'admin').execute()

if existing.data:
    print("Admin user already exists!")
    user_id = existing.data[0]['id']
    print(f"ID: {user_id}")
    
    # Update password
    print("\nUpdating password to Admin@123...")
    hashed = get_password_hash("Admin@123")
    db.table('users').update({'password_hash': hashed}).eq('id', user_id).execute()
    print("✓ Password updated!")
else:
    print("Creating admin user...")
    
    # Hash the password
    hashed_password = get_password_hash("Admin@123")
    
    # Create admin user with correct column name
    user_data = {
        'username': 'admin',
        'email': 'admin@omnix.com',
        'full_name': 'System Administrator',
        'password_hash': hashed_password,  # Correct column name
        'is_active': True,
        'is_verified': True,
        'email_verified': True
    }
    
    result = db.table('users').insert(user_data).execute()
    
    if result.data:
        print("✓ Admin user created successfully!")
        print(f"Username: admin")
        print(f"Password: Admin@123")
        print(f"Email: admin@omnix.com")
    else:
        print("✗ Failed to create admin user")

# Test login
print("\n\nTesting login...")
import requests

r = requests.post(
    "http://localhost:8005/api/v1/auth/login",
    json={"email_or_username": "admin", "password": "Admin@123"}
)

print(f"Status: {r.status_code}")
if r.status_code == 200:
    print("✓ Login successful!")
    print("\nYou can now login to the UI with:")
    print("  Username: admin")
    print("  Password: Admin@123")
else:
    print(f"✗ Login failed: {r.text}")
