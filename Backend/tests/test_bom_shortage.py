import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

base = "http://localhost:8005/api/v1"

# Login
r = requests.post(f"{base}/auth/login", json={"email_or_username": "admin", "password": "Admin@123"})
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("Testing BOM Shortage with correct BOM...")
print("=" * 60)

# Get all BOMs
r = requests.get(f"{base}/boms", headers=headers)
boms = r.json()

print(f"\nFound {len(boms)} BOMs:")
for bom in boms:
    print(f"  - {bom['product_code']}: {bom['product_name']}")

# Test with T-Shirt BOM (V-SKU-TS-001)
ts_bom = next((b for b in boms if b['product_code'] == 'V-SKU-TS-001'), None)
if ts_bom:
    print(f"\nTesting T-Shirt BOM: {ts_bom['id']}")
    r = requests.get(f"{base}/boms/{ts_bom['id']}/materials-with-shortages?production_qty=100", headers=headers)
    if r.status_code == 200:
        materials = r.json()
        print(f"Materials ({len(materials)}):")
        for mat in materials:
            status_icon = "✓" if mat['shortage_status'] == "Sufficient" else "✗"
            print(f"  {status_icon} {mat['material_name']}: {mat['shortage_status']}")
            print(f"      Stock: {mat['stock_qty']}, Required: {mat['required_qty']}, Shortage: {mat['shortage_qty']}")
    else:
        print(f"Error: {r.status_code} - {r.text}")
else:
    print("T-Shirt BOM not found!")

print("\n" + "=" * 60)
