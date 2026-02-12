import asyncio
import os
import sys
from decimal import Decimal
from dotenv import load_dotenv

# Load env vars from .env file in parent directory
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path)

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db

async def fix_missing_inventory():
    print("Starting inventory repair...")
    db = get_db()

    # 1. Get Main Store Location
    print("Checking Main Store location...")
    main_store = db.table('locations').select('*').eq('code', 'MAIN-STORE').execute()
    
    if not main_store.data:
        print("MAIN-STORE location not found. Creating it...")
        main_store = db.table('locations').insert({
            'code': 'MAIN-STORE',
            'name': 'Main Warehouse',
            'type': 'store',
            'is_active': True
        }).execute()
        
    main_store_id = main_store.data[0]['id']
    print(f"Main Store ID: {main_store_id}")

    # 2. Get all Inventory Items
    print("Fetching inventory items...")
    items = db.table('inventory_items').select('*').execute()
    
    fixed_products = 0
    fixed_inventory = 0
    
    for item in items.data:
        try:
            # Check/Create Product
            product_res = db.table('products').select('*').eq('code', item['material_code']).execute()
            
            product_id = None
            if not product_res.data:
                print(f"Creating missing product for {item['material_code']}...")
                new_prod = db.table('products').insert({
                    'code': item['material_code'],
                    'name': item['material_name'],
                    'description': item.get('description'),
                    'category': 'Raw Materials', # Assuming these are raw materials
                    'unit': item['unit'],
                    'unit_cost': float(item.get('unit_cost', 0)) if item.get('unit_cost') else 0.0,
                    'is_active': True
                }).execute()
                product_id = new_prod.data[0]['id']
                fixed_products += 1
            else:
                product_id = product_res.data[0]['id']
                # Determine category for existing product to ensure it's not finished goods if we are treating as raw material
                # But let's not change existing product categories blindly.
            
            # Check/Create Inventory
            inv_res = db.table('inventory').select('*').eq('product_id', product_id).eq('location_id', main_store_id).execute()
            
            if not inv_res.data:
                print(f"Creating missing inventory record for {item['material_code']}...")
                db.table('inventory').insert({
                    'product_id': product_id,
                    'location_id': main_store_id,
                    'available_qty': float(item['quantity']),
                    'allocated_qty': 0, # Reset allocation to be safe, or we could try to calculate it
                    'updated_at': "now()"
                }).execute()
                fixed_inventory += 1
            else:
                # Optional: Sync quantity if it mismatches?
                # current_qty = float(inv_res.data[0]['quantity'])
                # if current_qty != float(item['quantity']):
                #    print(f"Mismatch for {item['material_code']}: Inventory {current_qty} vs Item {item['quantity']}")
                pass
                
        except Exception as e:
            print(f"Error processing item {item['material_code']}: {e}")

    print("-" * 30)
    print(f"Repair Complete.")
    print(f"Fixed Products: {fixed_products}")
    print(f"Fixed Inventory Records: {fixed_inventory}")

if __name__ == "__main__":
    asyncio.run(fix_missing_inventory())
