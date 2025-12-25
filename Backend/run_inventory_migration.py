"""
Run inventory items migration
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Missing Supabase credentials in .env file")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Read migration file
with open('migrations/008_inventory_items_enhanced.sql', 'r') as f:
    sql_content = f.read()

# Split by semicolons and execute each statement
statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]

print("Running inventory items migration...")
print(f"Total statements to execute: {len(statements)}")

for i, statement in enumerate(statements, 1):
    try:
        # Skip empty statements and comments
        if not statement or statement.startswith('--'):
            continue
            
        print(f"\nExecuting statement {i}/{len(statements)}...")
        
        # Execute via RPC call
        result = supabase.rpc('exec_sql', {'sql': statement}).execute()
        print(f"✓ Statement {i} executed successfully")
        
    except Exception as e:
        print(f"✗ Error in statement {i}: {str(e)}")
        print(f"Statement: {statement[:100]}...")
        # Continue with next statement
        continue

print("\n✓ Migration completed!")
print("\nVerifying tables...")

# Verify tables exist
try:
    result = supabase.table('inventory_items').select('count').execute()
    print(f"✓ inventory_items table exists")
except Exception as e:
    print(f"✗ inventory_items table check failed: {e}")

try:
    result = supabase.table('inventory_item_transactions').select('count').execute()
    print(f"✓ inventory_item_transactions table exists")
except Exception as e:
    print(f"✗ inventory_item_transactions table check failed: {e}")

try:
    result = supabase.table('stock_alerts_items').select('count').execute()
    print(f"✓ stock_alerts_items table exists")
except Exception as e:
    print(f"✗ stock_alerts_items table check failed: {e}")

print("\n✓ All done!")
