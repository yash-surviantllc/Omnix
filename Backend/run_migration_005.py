"""
Run database migration 005_configurable_stages.sql
"""
import os
from pathlib import Path
from app.database import get_db

def run_migration():
    """Execute the configurable stages migration"""
    migration_file = Path(__file__).parent / "migrations_consolidated" / "005_configurable_stages.sql"
    
    print(f"Reading migration file: {migration_file}")
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("Executing migration...")
    
    db = get_db()
    
    try:
        # Execute the SQL
        result = db.rpc('exec_sql', {'sql': sql_content}).execute()
        print("✅ Migration executed successfully!")
        return True
    except Exception as e:
        # If exec_sql RPC doesn't exist, try executing statements one by one
        print(f"RPC method not available, executing statements individually...")
        
        # Split by statement (rough split on semicolons not in strings/comments)
        statements = []
        current_stmt = []
        in_function = False
        
        for line in sql_content.split('\n'):
            stripped = line.strip()
            
            # Track if we're inside a function definition
            if 'CREATE OR REPLACE FUNCTION' in line or 'CREATE FUNCTION' in line:
                in_function = True
            
            current_stmt.append(line)
            
            # End of statement
            if stripped.endswith(';') and not in_function:
                statements.append('\n'.join(current_stmt))
                current_stmt = []
            elif in_function and stripped.startswith('$$ LANGUAGE'):
                in_function = False
        
        # Add any remaining statement
        if current_stmt:
            statements.append('\n'.join(current_stmt))
        
        print(f"Executing {len(statements)} statements...")
        
        for i, stmt in enumerate(statements, 1):
            stmt = stmt.strip()
            if not stmt or stmt.startswith('--') or stmt.startswith('/*'):
                continue
            
            try:
                print(f"  [{i}/{len(statements)}] Executing...")
                # Supabase doesn't support direct SQL execution via client
                # We need to use the SQL editor or create RPC functions
                print(f"  Statement: {stmt[:100]}...")
                print("  ⚠️  Cannot execute via Supabase client. Please run migration manually.")
            except Exception as stmt_error:
                print(f"  ❌ Error: {stmt_error}")
                raise
        
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Running Migration: 005_configurable_stages.sql")
    print("=" * 60)
    
    success = run_migration()
    
    if success:
        print("\n✅ Migration completed successfully!")
    else:
        print("\n⚠️  Please run the migration manually using Supabase SQL Editor:")
        print("   1. Go to Supabase Dashboard > SQL Editor")
        print("   2. Copy the contents of migrations_consolidated/005_configurable_stages.sql")
        print("   3. Paste and execute")
