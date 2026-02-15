import asyncio
import os
import sys
from datetime import datetime

# Adjust path to include app
sys.path.append(os.getcwd())

from app.database import get_db
from app.services.qc_service import QCService
from app.schemas.qc import QCInspectionCreate, QCDefectCreate

async def verify_qc_submission():
    db = get_db()
    
    print("\n--- Verifying QC Submission & Dropdown Data ---\n")
    
    # 1. Fetch Working Orders to check for Duplicates
    print("1. Checking for duplicate Working Orders...")
    try:
        from app.services.wip_service import WIPService
        # Use UNIQUE list to avoid ghost records
        wos = await WIPService.list_unique_working_orders()
        
        seen_ids = set()
        duplicates = []
        for wo in wos:
            if wo.id in seen_ids:
                duplicates.append(wo.work_order_number)
            seen_ids.add(wo.id)
            
        if duplicates:
            print(f"❌ FAILING: Found duplicate Working Orders: {duplicates}")
        else:
            print(f"✅ SUCCESS: Fetched {len(wos)} Working Orders with NO duplicates.")
            
        # Find a valid WO (one that exists in DB)
        target_wo = None
        for candidate in wos:
            try:
                # Prove existence
                check = db.table('work_orders').select('id').eq('id', candidate.id).execute()
                if check.data:
                    target_wo = candidate
                    print(f"✅ Found valid WO: {target_wo.work_order_number} (ID: {target_wo.id})")
                    break
                else:
                    print(f"⚠️ Skipping ghost WO: {candidate.work_order_number} (ID: {candidate.id}) - Not found in direct query.")
            except Exception as e:
                print(f"⚠️ Error checking WO {candidate.id}: {e}")

        if not target_wo:
            print("❌ No valid Working Orders found in the list. Cannot test QC Submission.")
            return

        # NEW: Verify PO Linkage
        print(f"   Using WO: {target_wo.work_order_number}")
        print(f"   Linked PO ID: {target_wo.purchase_order_id}")
        
        if not target_wo.purchase_order_id:
            print("❌ FAILING: Working Order has no purchase_order_id linked!")
        else:
            print("✅ SUCCESS: Working Order is linked to a PO.")

        print(f"   Using WO ID: {target_wo.id}")
        
        # DEBUG: Check if exists in DB
        print(">>> START DEBUG DB CHECK")
        print(f"   Target Object: {target_wo}")
        try:
            # Check by Number
            check_num = db.table('work_orders').select('*').eq('work_order_number', target_wo.work_order_number).execute()
            print(f"   DEBUG: Check by Number '{target_wo.work_order_number}': {check_num.data}")
            
            # Check by ID
            check = db.table('work_orders').select('*').eq('id', target_wo.id).execute()
            print(f"   DEBUG: Direct DB Check (ID: {target_wo.id}) found: {check.data}")
        except Exception as e:
            print(f"   DEBUG: Direct DB Check failed: {e}")
        print("<<< END DEBUG DB CHECK")
        
        # 2. Simulating QC Submission...
        
        payload = QCInspectionCreate(
            work_order_id=target_wo.id,
            product_id=target_wo.product_id,
            quantity_checked=10,
            passed_qty=8,
            rework_qty=1,
            scrap_qty=1,
            status="Completed",
            defects=[
                QCDefectCreate(defect_type="Rework", reason="Surface Crack", quantity=1),
                QCDefectCreate(defect_type="Scrap", reason="Deep Gouge", quantity=1)
            ],
            notes="Automated Verification Test"
        )
        
        result = await QCService.create_inspection(data=payload, user_id="verify_script")
        
        if result:
            print(f"✅ SUCCESS: QC Inspection created! ID: {result.id}")
            print(f"   Inspection Number: {result.inspection_number}")
            
            # Verify Rework Alert created (implicitly by showing up in dashboard query)
            # We can check qc_inspections table
            res = db.table('qc_inspections').select('*').eq('id', result.id).single().execute()
            if res.data and res.data['rework_qty'] == 1:
                 print("✅ SUCCESS: Database record confirms rework_qty = 1")
            else:
                 print("❌ FAILING: Database record mismatch")
                 
        else:
            print("❌ FAILING: QC Service returned None")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_qc_submission())
