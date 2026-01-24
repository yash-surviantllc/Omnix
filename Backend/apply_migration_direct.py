import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment variables.")
    # Try to construct or look for other vars
    # Sometimes it's aliased
    POSTGRES_URL = os.getenv("POSTGRES_URL")
    if POSTGRES_URL:
        DATABASE_URL = POSTGRES_URL
    else:
        print("Available keys:", [k for k in os.environ.keys() if 'URL' in k or 'DB' in k])
        sys.exit(1)

print(f"Connecting to database...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Read migration file
    migration_path = os.path.join("migrations_consolidated", "005_configurable_stages.sql")
    print(f"Reading {migration_path}...")
    
    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()
        
    print("Executing SQL...")
    cursor.execute(sql)
    
    print("✅ Migration applied successfully!")
    
    conn.close()
    
except Exception as e:
    print(f"❌ Error applying migration: {e}")
    sys.exit(1)
