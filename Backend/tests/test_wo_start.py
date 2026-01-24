"""
Test Working Order Start Functionality
Verifies the fix for network error when starting Working Orders
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_wo_start():
    print("="*70)
    print("WORKING ORDER START FUNCTIONALITY TEST")
    print("="*70)
    
    # 1. Login
    print("\n1. Logging in as admin...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email_or_username": "admin",
        "password": "Admin@123"
    })
    
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code}")
        print(resp.text)
        return False
    
    token = resp.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Login successful")
    
    # 2. Get working orders
    print("\n2. Fetching working orders...")
    resp = requests.get(f"{BASE_URL}/wip/working-orders?limit=10", headers=headers)
    
    if resp.status_code != 200:
        print(f"❌ Failed to fetch working orders: {resp.status_code}")
        print(resp.text)
        return False
    
    working_orders = resp.json()
    print(f"✓ Retrieved {len(working_orders)} working orders")
    
    if not working_orders:
        print("⚠ No working orders found - cannot test Start functionality")
        print("   Create a working order first, then run this test again")
        return False
    
    # 3. Find a Pending or Planned working order
    startable_wo = None
    for wo in working_orders:
        if wo['status'] in ['Pending', 'Planned']:
            startable_wo = wo
            break
    
    if not startable_wo:
        print("⚠ No Pending/Planned working orders found")
        print("   All working orders are already started or completed")
        print("\n   Available working orders:")
        for wo in working_orders[:5]:
            print(f"   - {wo['work_order_number']}: {wo['status']}")
        return False
    
    wo_id = startable_wo['id']
    wo_number = startable_wo['work_order_number']
    print(f"\n3. Testing with Working Order: {wo_number}")
    print(f"   ID: {wo_id}")
    print(f"   Current Status: {startable_wo['status']}")
    print(f"   Operation: {startable_wo['operation']}")
    
    # 4. START the working order (this is what the Start button does)
    print(f"\n4. Starting Working Order {wo_number}...")
    update_data = {
        "status": "In Progress",
        "actual_start": datetime.now().isoformat()
    }
    
    resp = requests.put(
        f"{BASE_URL}/wip/working-orders/{wo_id}",
        json=update_data,
        headers=headers
    )
    
    if resp.status_code != 200:
        print(f"❌ FAILED to start working order: {resp.status_code}")
        print(f"Response: {resp.text}")
        print("\n🔍 This is the network error the user reported!")
        return False
    
    updated_wo = resp.json()
    print(f"✅ SUCCESS: Working Order started!")
    print(f"   New Status: {updated_wo['status']}")
    print(f"   Started At: {updated_wo.get('actual_start', 'N/A')}")
    
    # 5. Verify the change persisted
    print(f"\n5. Verifying the change persisted...")
    resp = requests.get(f"{BASE_URL}/wip/working-orders/{wo_id}", headers=headers)
    
    if resp.status_code != 200:
        print(f"❌ Failed to fetch updated WO: {resp.status_code}")
        return False
    
    verified_wo = resp.json()
    if verified_wo['status'] == 'In Progress' and verified_wo.get('actual_start'):
        print(f"✅ VERIFIED: Status change persisted in database")
        print(f"   Status: {verified_wo['status']}")
        print(f"   Actual Start: {verified_wo['actual_start']}")
    else:
        print(f"❌ Status change did NOT persist")
        print(f"   Current Status: {verified_wo['status']}")
        return False
    
    # 6. Test WIP Board update (optional)
    print(f"\n6. Checking WIP Board update...")
    resp = requests.get(f"{BASE_URL}/wip/dashboard", headers=headers)
    
    if resp.status_code == 200:
        dashboard = resp.json()
        print(f"✅ WIP Dashboard accessible")
        print(f"   Total Orders: {dashboard.get('total_orders', 'N/A')}")
        print(f"   Total Units: {dashboard.get('total_units', 'N/A')}")
    else:
        print(f"⚠ WIP Dashboard returned {resp.status_code} (non-critical)")
    
    print("\n" + "="*70)
    print("✅ ALL TESTS PASSED - Working Order Start is FIXED!")
    print("="*70)
    return True

if __name__ == "__main__":
    success = test_wo_start()
    exit(0 if success else 1)
