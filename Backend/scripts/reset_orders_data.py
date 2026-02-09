"""
Reset Purchase Orders and Working Orders Data
==============================================
This script clears all Purchase Order and Working Order data
and resets numbering sequences to start fresh.

WARNING: This will DELETE ALL data! Backup before running!
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def confirm_reset():
    """Ask user for confirmation before proceeding"""
    print("\n" + "="*60)
    print("⚠️  WARNING: DATA DELETION OPERATION")
    print("="*60)
    print("\nThis will DELETE ALL:")
    print("  • Purchase Orders")
    print("  • Working Orders")
    print("  • WIP Stage Transfers")
    print("  • Material Requisitions")
    print("  • Order Stage Tracking")
    print("  • Work Order Operations & Materials")
    print("\nSequences will be reset to 1:")
    print("  • working_order_seq")
    print("  • wip_transfer_seq")
    print("  • material_requisition_seq")
    print("\n" + "="*60)
    
    response = input("\nType 'DELETE ALL DATA' to confirm: ")
    return response == "DELETE ALL DATA"

def reset_data():
    """Execute the reset operation"""
    print("\n🔄 Starting data reset...\n")
    
    # Read the SQL script
    script_path = os.path.join(os.path.dirname(__file__), 'reset_orders_data.sql')
    
    if not os.path.exists(script_path):
        print(f"❌ Error: SQL script not found at {script_path}")
        return False
    
    with open(script_path, 'r', encoding='utf-8') as f:
        sql_script = f.read()
    
    try:
        # Execute the SQL script
        print("📝 Executing SQL script...")
        result = supabase.rpc('exec_sql', {'sql': sql_script}).execute()
        
        print("\n✅ SQL script executed successfully!")
        
        # Verify deletion
        print("\n🔍 Verifying deletion...")
        
        po_count = supabase.table('purchase_orders').select('id', count='exact').execute()
        wo_count = supabase.table('work_orders').select('id', count='exact').execute()
        wip_count = supabase.table('wip_stage_transfers').select('id', count='exact').execute()
        
        print(f"\n📊 Verification Results:")
        print(f"  • Purchase Orders: {po_count.count}")
        print(f"  • Work Orders: {wo_count.count}")
        print(f"  • WIP Stage Transfers: {wip_count.count}")
        
        if po_count.count == 0 and wo_count.count == 0:
            print("\n✅ SUCCESS: All data cleared successfully!")
            print("\n📌 Next order numbers will be:")
            print("  • Purchase Orders: PO-2026-0001")
            print("  • Working Orders: WO-2026-0001")
            return True
        else:
            print("\n⚠️  Warning: Some data still remains. Check foreign key constraints.")
            return False
            
    except Exception as e:
        print(f"\n❌ Error executing script: {str(e)}")
        print("\nTry running the SQL script directly in Supabase SQL Editor instead.")
        return False

def main():
    """Main execution function"""
    print("\n" + "="*60)
    print("🔧 OMNIX - Reset Orders Data Script")
    print("="*60)
    
    if not confirm_reset():
        print("\n❌ Operation cancelled by user.")
        return
    
    print("\n⚠️  Last chance to cancel! Press Ctrl+C to abort...")
    input("Press ENTER to proceed with deletion...")
    
    success = reset_data()
    
    if success:
        print("\n" + "="*60)
        print("✅ Data reset completed successfully!")
        print("="*60)
        print("\nYou can now create fresh Purchase Orders and Working Orders.")
        print("Numbering will start from the beginning.\n")
    else:
        print("\n" + "="*60)
        print("❌ Data reset failed or incomplete")
        print("="*60)
        print("\nPlease check the errors above and try again.")
        print("You may need to run the SQL script manually in Supabase.\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled by user (Ctrl+C)")
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
