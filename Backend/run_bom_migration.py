"""
Script to run BOM schema migration on Supabase database.
This will create products, boms, and bom_materials tables with sample data.
"""

from supabase import create_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def run_migration():
    """Execute the BOM schema migration."""
    
    # Create Supabase admin client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # Read the migration file
    with open('migrations/002_bom_schema.sql', 'r', encoding='utf-8') as f:
        migration_sql = f.read()
    
    print("🚀 Running BOM schema migration...")
    print("=" * 60)
    
    try:
        # Execute the migration
        # Note: Supabase Python client doesn't support raw SQL execution directly
        # We need to use the REST API or execute via Supabase dashboard
        
        print("⚠️  IMPORTANT: Supabase Python client doesn't support raw SQL execution.")
        print("\n📋 Please run this migration manually:")
        print("\n1. Go to: https://ejedsuwoljqrojlgwcyx.supabase.co/project/_/sql")
        print("2. Copy the contents of: migrations/002_bom_schema.sql")
        print("3. Paste and click 'Run'")
        print("\nOR use the Supabase CLI:")
        print("   supabase db push")
        
        print("\n" + "=" * 60)
        print("\n✅ Migration file location: migrations/002_bom_schema.sql")
        print("\n📦 This will create:")
        print("   - products table (with 7 raw materials + 4 finished goods)")
        print("   - boms table")
        print("   - bom_materials table")
        print("   - bom_versions table")
        print("   - Sample BOMs for T-Shirt and Jacket")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    run_migration()
