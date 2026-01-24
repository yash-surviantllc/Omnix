import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

base = "http://localhost:8005/api/v1"

# Login
r = requests.post(f"{base}/auth/login", json={"email_or_username": "admin", "password": "Admin@123"})
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("Testing Inventory Items endpoint...")
print("=" * 60)

# Try to get inventory items
try:
    r = requests.get(f"{base}/inventory-items", headers=headers)
    print(f"Status: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"✓ Success! Found {len(data)} items")
        if data:
            print(f"First item: {data[0].get('material_code', 'N/A')}")
    else:
        print(f"✗ Error: {r.status_code}")
        print(f"Response: {r.text}")
        
        # Try with different parameters
        print("\nTrying with page=1&limit=10...")
        r = requests.get(f"{base}/inventory-items?page=1&limit=10", headers=headers)
        print(f"Status: {r.status_code}")
        if r.status_code != 200:
            print(f"Response: {r.text}")
            
except Exception as e:
    print(f"Exception: {e}")

print("\n" + "=" * 60)
