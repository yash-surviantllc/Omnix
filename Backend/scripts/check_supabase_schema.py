import asyncio
from app.database import get_db

async def check_schema():
    print("--- Starting Detailed Schema Verification ---")
    db = get_db()
    
    # Tables to check
    tables = {
        'gate_entries': ['vendor', 'destination_department', 'remarks', 'vehicle_number', 'driver_name', 'reference_document_number'],
        'gate_entry_items': ['gate_entry_id', 'product_id', 'quantity', 'unit'],
        'gate_exits': ['destination', 'vehicle_no', 'remarks'],
        'qc_inspections': ['scrap_qty', 'passed_qty', 'work_order_id', 'purchase_order_id']
    }
    
    for table, columns in tables.items():
        print(f"\nChecking table: {table}")
        try:
            # Check table existence and column existence by attempting to select them
            col_list = ", ".join(columns)
            res = db.table(table).select(col_list).limit(1).execute()
            print(f"  Result: Table and all probed columns EXIST.")
        except Exception as e:
            err_msg = str(e)
            if "does not exist" in err_msg.lower():
                # Try selecting just * to see if table exists
                try:
                    db.table(table).select("*").limit(1).execute()
                    print(f"  Result: Table EXISTS, but some columns are MISSING.")
                    # Narrow down columns
                    for col in columns:
                        try:
                            db.table(table).select(col).limit(1).execute()
                        except:
                            print(f"    - Column '{col}' is MISSING")
                except:
                    print(f"  Result: Table MISSING")
            else:
                print(f"  Result: ERROR - {err_msg}")
    
    print("\n--- Schema Verification Finished ---")

if __name__ == "__main__":
    asyncio.run(check_schema())
