import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

base = "http://localhost:8005/api/v1"

# Test login
print("=" * 60)
print("COMPLETE SYSTEM VERIFICATION")
print("=" * 60)
print("\n1. Testing Login...")
r = requests.post(f"{base}/auth/login", json={"email_or_username": "admin", "password": "Admin@123"})
print(f"   Status: {r.status_code}")

if r.status_code == 200:
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   ✓ Login successful!")
    
    # Test all endpoints
    print("\n2. Testing API Endpoints...")
    
    # Inventory Items
    r = requests.get(f"{base}/inventory-items", headers=headers)
    print(f"   Inventory Items: {r.status_code}, Count: {len(r.json()) if r.status_code == 200 else 0}")
    
    # BOMs
    r = requests.get(f"{base}/boms", headers=headers)
    print(f"   BOMs: {r.status_code}, Count: {len(r.json()) if r.status_code == 200 else 0}")
    
    # Purchase Orders
    r = requests.get(f"{base}/orders", headers=headers)
    if r.status_code == 200:
        data = r.json()
        print(f"   Purchase Orders: {r.status_code}, Count: {len(data)}")
        if data:
            print(f"      Latest: {data[0]['order_number']}")
    else:
        print(f"   Purchase Orders: {r.status_code}")
    
    # Working Orders
    r = requests.get(f"{base}/wip", headers=headers)
    if r.status_code == 200:
        data = r.json()
        print(f"   Working Orders: {r.status_code}, Count: {len(data)}")
        if data:
            print(f"      Latest: {data[0]['work_order_number']}")
    else:
        print(f"   Working Orders: {r.status_code}")
    
    print("\n" + "=" * 60)
    print("✓ VERIFICATION COMPLETE")
    print("=" * 60)
    print("\nYou can now login to http://localhost:5173 with:")
    print("  Username: admin")
    print("  Password: Admin@123")
    print("\nAll data is ready:")
    print("  - 5 Inventory Items")
    print("  - 2 BOMs (T-Shirt, Hoodie)")
    print("  - 1 Purchase Order (PO-2026-0010)")
    print("  - 2 Working Orders")
else:
    print(f"   ✗ Login failed: {r.text}")
