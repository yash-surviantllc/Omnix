"""
Delete all Working Orders from the database

This script removes all work orders to allow starting fresh from WO-0001.
Only deletes from work_orders table, does not touch other tables.
"""

from app.database import get_db

def delete_all_working_orders():
    db = get_db()
    
    print("\n=== Deleting All Working Orders ===\n")
    
    # Get count before deletion
    result = db.table('work_orders').select('id', count='exact').execute()
    count_before = result.count if hasattr(result, 'count') else len(result.data) if result.data else 0
    
    print(f"Found {count_before} working orders in database")
    
    if count_before == 0:
        print("No working orders to delete.")
        return
    
    # Delete all work orders
    print("\nDeleting all working orders...")
    delete_result = db.table('work_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    
    # Verify deletion
    result_after = db.table('work_orders').select('id', count='exact').execute()
    count_after = result_after.count if hasattr(result_after, 'count') else len(result_after.data) if result_after.data else 0
    
    print(f"\n✅ Successfully deleted {count_before - count_after} working orders")
    print(f"Remaining working orders: {count_after}")
    
    if count_after == 0:
        print("\n🎉 All working orders have been removed!")
        print("Next work order will be numbered WO-0001")
    
    print("\n=== Cleanup Complete ===\n")

if __name__ == "__main__":
    delete_all_working_orders()
