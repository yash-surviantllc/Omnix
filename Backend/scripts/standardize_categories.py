import asyncio
import os
import sys
from typing import List

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db

async def standardize_categories():
    """
    Standardize categories across products and inventory_items tables.
    - 'Raw Materials' -> 'Raw Material' (Singular)
    - 'Finished Good' -> 'Finished Goods' (Plural)
    """
    db = get_db()
    
    print("Starting category standardization...")
    
    updates = [
        # Normalizing Raw Material (Standardize to Singular)
        ('products', 'Raw Materials', 'Raw Material'),
        ('inventory_items', 'Raw Materials', 'Raw Material'),
        
        # Normalizing Finished Goods (Standardize to Plural)
        ('products', 'Finished Good', 'Finished Goods'),
        ('inventory_items', 'Finished Good', 'Finished Goods'),
        
        # Normalizing Trim (Standardize to Singular)
        ('products', 'Trims', 'Trim'),
        ('inventory_items', 'Trims', 'Trim'),
    ]
    
    for table, old_val, new_val in updates:
        # Check count before update
        count_res = db.table(table).select('id', count='exact').eq('category', old_val).execute()
        count = count_res.count if hasattr(count_res, 'count') else len(count_res.data)
        
        if count > 0:
            print(f"Updating {count} records in {table}: '{old_val}' -> '{new_val}'")
            update_res = db.table(table).update({'category': new_val}).eq('category', old_val).execute()
            if update_res.data:
                print(f"Successfully updated {len(update_res.data)} records in {table}.")
        else:
            print(f"No records found in {table} with category '{old_val}'.")

    print("\nVerification of current categories in 'products' table:")
    cat_res = db.table('products').select('category').execute()
    unique_cats = sorted(list(set(item['category'] for item in cat_res.data if item.get('category'))))
    print(f"Unique categories: {unique_cats}")
    
    print("\nStandardization complete.")

if __name__ == "__main__":
    asyncio.run(standardize_categories())
