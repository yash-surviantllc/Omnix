
import asyncio
from app.services.dashboard_service import dashboard_service
from app.services.wip_service import WIPService
from app.database import get_db

async def verify():
    print("--- Verifying QC & Dashboard Fixes ---")
    
    # 1. Verify Rework Alerts Logic
    print("\n1. Testing Dashboard Rework Alerts...")
    try:
        db = get_db()
        # Ensure we have at least one inspection with rework_qty > 0 for testing
        # Check if any exist
        existing = db.table('qc_inspections').select('*').gt('rework_qty', 0).execute()
        if not existing.data:
            print("   No existing rework inspections found. Creating a dummy one...")
            # We need a dummy product and order
            prod = db.table('products').select('id').limit(1).execute()
            if prod.data:
                pid = prod.data[0]['id']
                # Create dummy inspection
                dummy = {
                    'inspection_number': 'QC-TEST-REWORK-001',
                    'product_id': pid,
                    'quantity_checked': 10,
                    'passed_qty': 5,
                    'rework_qty': 5,
                    'scrap_qty': 0,
                    'status': 'Completed',
                    'inspector_id': None, # Optional
                    'created_at': '2023-10-27T10:00:00Z' # Make sure it's recent enough or adjust query
                }
                # Actually, the query uses utcnow() - 30 days. Let's make it today.
                from datetime import datetime
                dummy['created_at'] = datetime.utcnow().isoformat()
                
                res = db.table('qc_inspections').insert(dummy).execute()
                print(f"   Created dummy inspection: {res.data[0]['id']}")
        
        # Test the service method
        alerts = await dashboard_service._get_rework_alerts(db)
        print(f"   Rework Alerts Found: {len(alerts)}")
        for a in alerts:
            print(f"   - {a.order_number}: {a.qty_in_rework} qty ({a.product_name})")
            
        if len(alerts) > 0:
            print("   ✅ Rework Alerts Logic works!")
        else:
            print("   ❌ Rework Alerts Logic returned empty list despite data.")
            
    except Exception as e:
        print(f"   ❌ Error testing rework alerts: {e}")

    # 2. Verify Working Order Fetching (Simulate Frontend Call)
    print("\n2. Testing Working Order List (No Filter)...")
    try:
        # The frontend now calls listWorkingOrders({}) which translates to list_working_orders(status=None)
        wos = await WIPService.list_working_orders(status=None, limit=5)
        print(f"   Fetched {len(wos)} Working Orders without status filter.")
        for w in wos:
            print(f"   - {w.work_order_number}: {w.status}")
            
        if len(wos) > 0:
             print("   ✅ Working Order Fetching works!")
        else:
             print("   ⚠️ No Working Orders found (might be empty DB).")
             
    except Exception as e:
        print(f"   ❌ Error testing WO fetching: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
