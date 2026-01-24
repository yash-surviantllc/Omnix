import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

base = "http://localhost:8000/api/v1"

print("=" * 60)
print("TESTING ALL ENDPOINTS AFTER FIXES")
print("=" * 60)

# Login
print("\n1. Login...")
r = requests.post(f"{base}/auth/login", json={"email_or_username": "admin", "password": "Admin@123"})
if r.status_code != 200:
    print(f"✗ Login failed: {r.status_code}")
    exit(1)

token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("✓ Login successful")

# Test BOM shortage
print("\n2. Testing BOM Shortage Fix...")
r = requests.get(f"{base}/boms", headers=headers)
if r.status_code == 200 and r.json():
    bom_id = r.json()[0]['id']
    print(f"   Found BOM: {bom_id}")
    
    # Get materials with shortages
    r = requests.get(f"{base}/boms/{bom_id}/materials-with-shortages?production_qty=100", headers=headers)
    print(f"   Materials with shortages: {r.status_code}")
    if r.status_code == 200:
        materials = r.json()
        for mat in materials:
            print(f"      - {mat['material_name']}: {mat['shortage_status']} (Stock: {mat['stock_qty']}, Required: {mat['required_qty']})")
else:
    print(f"   ✗ Could not get BOMs: {r.status_code}")
    print(f"   Response: {r.text}")

# Test Inventory Items
print("\n3. Testing Inventory Items...")
r = requests.get(f"{base}/inventory-items", headers=headers)
print(f"   Status: {r.status_code}")
if r.status_code != 200:
    print(f"   Error: {r.text[:200]}")

# Test Purchase Orders
print("\n4. Testing Purchase Orders...")
r = requests.get(f"{base}/orders", headers=headers)
print(f"   Status: {r.status_code}, Count: {len(r.json()) if r.status_code == 200 else 0}")

# Test Working Orders
print("\n5. Testing Working Orders...")
r = requests.get(f"{base}/wip/working-orders", headers=headers)
print(f"   Status: {r.status_code}, Count: {len(r.json()) if r.status_code == 200 else 0}")

# Test WIP Board
print("\n6. Testing WIP Board...")
r = requests.get(f"{base}/wip-board/board", headers=headers)
print(f"   Status: {r.status_code}")

print("\n" + "=" * 60)
print("TESTING COMPLETE")
print("=" * 60)
