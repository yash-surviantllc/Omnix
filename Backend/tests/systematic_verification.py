import asyncio
import os
import sys
from decimal import Decimal
from datetime import datetime, date, timedelta

# Add the app directory to the path so we can import services
sys.path.append(os.getcwd())

from app.database import get_db
from app.services.inventory_items_service import inventory_items_service
from app.services.bom_service import bom_service
from app.services.purchase_order_service import purchase_order_service
from app.services.wip_service import wip_service
from app.core.exceptions import NotFoundException, ValidationException
from app.schemas.inventory_items import InventoryItemCreate
from app.schemas.bom import BOMCreateWithProduct
from app.schemas.purchase_order_updated import PurchaseOrderMultiSKUCreate, POItemCreate
from app.schemas.wip import WorkingOrderCreate

async def setup_verification_data():
    print("--- Starting Systematic Verification Data Setup ---")
    
    # [0] Fetch a valid User ID
    db = get_db()
    user_result = db.table('users').select('id').limit(1).execute()
    if not user_result.data:
        print("   [CRITICAL] No users found in database. Cannot proceed.")
        return
    user_id = user_result.data[0]['id']
    print(f"   - Using User ID: {user_id}")
    
    # 1. Create Inventory Items
    inventory_data = [
        {"code": "V-COT-001", "name": "Organic Cotton Fabric", "unit": "kg", "cost": 15.5, "cat": "Fabric"},
        {"code": "V-THR-001", "name": "Polyester Thread (Black)", "unit": "roll", "cost": 2.75, "cat": "Thread"},
        {"code": "V-ZIP-001", "name": "YKK Metal Zipper 8 inch", "unit": "pcs", "cost": 1.2, "cat": "Accessories"},
        {"code": "V-BTN-001", "name": "Matte Plastic Button", "unit": "gross", "cost": 5.0, "cat": "Accessories"},
        {"code": "V-LAB-001", "name": "Woven Brand Label (Main)", "unit": "pcs", "cost": 0.15, "cat": "Labels"}
    ]
    
    item_ids = {}
    print("\n[1] Creating Inventory Items...")
    for item in inventory_data:
        try:
            # Check if exists
            db = get_db()
            existing = db.table('inventory_items').select('id').eq('material_code', item["code"]).execute()
            if existing.data:
                print(f"   - {item['code']} already exists, skipping.")
                item_ids[item["code"]] = existing.data[0]["id"]
            else:
                created = await inventory_items_service.create_inventory_item(
                    InventoryItemCreate(
                        material_code=item["code"],
                        material_name=item["name"],
                        category=item["cat"],
                        quantity=Decimal("1000"), # Start with some stock
                        unit=item["unit"],
                        unit_cost=Decimal(str(item["cost"])),
                        location="Main Warehouse"
                    ),
                    user_id=user_id
                )
                item_ids[item["code"]] = created.id
                print(f"   - Created {item['code']} (ID: {created.id})")
        except Exception as e:
            print(f"   [ERROR] Failed to create {item['code']}: {e}")

    # 2. Create BOMs (and Finished Goods Products)
    # BOM 1: T-Shirt
    print("\n[2] Creating BOMs...")
    t_shirt_bom_data = BOMCreateWithProduct(
        product_code="V-SKU-TS-001",
        product_name="Premium Crew Neck T-Shirt",
        batch_size=Decimal("100"),
        notes="Standard production BOM for T-Shirt",
        materials=[
            {"itemCode": "V-COT-001", "material": "Organic Cotton Fabric", "qty": Decimal("0.5"), "unit": "kg", "unitCost": Decimal("15.5")},
            {"itemCode": "V-THR-001", "material": "Polyester Thread (Black)", "qty": Decimal("0.1"), "unit": "roll", "unitCost": Decimal("2.75")},
            {"itemCode": "V-LAB-001", "material": "Woven Brand Label (Main)", "qty": Decimal("1.0"), "unit": "pcs", "unitCost": Decimal("0.15")}
        ]
    )
    
    # BOM 2: Hoodie
    hoodie_bom_data = BOMCreateWithProduct(
        product_code="V-SKU-HD-001",
        product_name="Urban Zip-Up Hoodie",
        batch_size=Decimal("100"),
        notes="Premium collection hoodie BOM",
        materials=[
            {"itemCode": "V-COT-001", "material": "Organic Cotton Fabric", "qty": Decimal("1.2"), "unit": "kg", "unitCost": Decimal("15.5")},
            {"itemCode": "V-THR-001", "material": "Polyester Thread (Black)", "qty": Decimal("0.2"), "unit": "roll", "unitCost": Decimal("2.75")},
            {"itemCode": "V-ZIP-001", "material": "YKK Metal Zipper 8 inch", "qty": Decimal("1.0"), "unit": "pcs", "unitCost": Decimal("1.2")},
            {"itemCode": "V-LAB-001", "material": "Woven Brand Label (Main)", "qty": Decimal("1.0"), "unit": "pcs", "unitCost": Decimal("0.15")}
        ]
    )

    bom_ids = []
    for bom_req in [t_shirt_bom_data, hoodie_bom_data]:
        try:
            # Check if product exists first
            db = get_db()
            existing_prod = db.table('products').select('id').eq('code', bom_req.product_code).execute()
            if existing_prod.data:
                print(f"   - Product {bom_req.product_code} already exists.")
                try:
                    existing_bom = await bom_service.get_bom_by_product_id(existing_prod.data[0]["id"])
                    if existing_bom:
                        bom_ids.append(existing_bom.id)
                        continue
                except NotFoundException:
                    print(f"   - No active BOM found for {bom_req.product_code}, creating one...")
                    pass

            created_bom = await bom_service.create_bom_with_product(bom_req, user_id=user_id)
            bom_ids.append(created_bom.id)
            print(f"   - Created BOM for {bom_req.product_code} (ID: {created_bom.id})")
        except Exception as e:
            print(f"   [ERROR] Failed to create BOM for {bom_req.product_code}: {e}")

    # 3. Create Multi-SKU Purchase Order
    print("\n[3] Creating Multi-SKU Purchase Order...")
    if not bom_ids:
        print("   [CRITICAL] No BOMs created, cannot create PO.")
        return

    # Get product IDs
    db = get_db()
    ts_product = db.table('products').select('id').eq('code', "V-SKU-TS-001").execute().data[0]["id"]
    hd_product = db.table('products').select('id').eq('code', "V-SKU-HD-001").execute().data[0]["id"]

    po_data = PurchaseOrderMultiSKUCreate(
        customer_name="Grand Verification Corp",
        due_date=(date.today() + timedelta(days=14)).isoformat(),
        priority="High",
        items=[
            POItemCreate(product_id=ts_product, quantity=Decimal("200"), unit="pcs"),
            POItemCreate(product_id=hd_product, quantity=Decimal("150"), unit="pcs")
        ]
    )

    try:
        created_po = await purchase_order_service.create_multi_sku_order(po_data, user_id=user_id)
        print(f"   - Created PO: {created_po.order_number} (ID: {created_po.id})")
        
        # 4. Create Working Orders (one for each item)
        print("\n[4] Creating Working Orders...")
        for item in created_po.items:
            wo_data = WorkingOrderCreate(
                purchase_order_id=created_po.id,
                product_id=item.product_id,
                target_qty=item.quantity,
                unit=item.unit,
                priority="High",
                operation="Cutting", # Start stage
                scheduled_start=datetime.now(),
                scheduled_end=datetime.now() + timedelta(days=7)
            )
            created_wo = await wip_service.create_working_order(wo_data, created_by=user_id)
            print(f"   - Created Working Order for {item.product_code}: {created_wo.work_order_number}")

    except Exception as e:
        print(f"   [ERROR] Failed to complete PO/WO flow: {e}")

    print("\n--- Setup Complete ---")

if __name__ == "__main__":
    asyncio.run(setup_verification_data())
