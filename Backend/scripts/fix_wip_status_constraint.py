
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from parent directory
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(current_dir, '.env')

print(f"Current working dir: {os.getcwd()}")
print(f"Script location: {os.path.dirname(os.path.abspath(__file__))}")
print(f"Looking for .env at: {env_path}")
print(f"File exists: {os.path.exists(env_path)}")

load_dotenv(dotenv_path=env_path)

# Debug: Check what keys were loaded or exist in file
print("\nScanning .env file for keys...")
with open(env_path, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            key = line.split('=')[0].strip()
            print(f"Found key in file: {key}")

print(f"\nEnvironment variables loaded:")
print(f"SUPABASE_URL present: {'SUPABASE_URL' in os.environ}")

print(f"SUPABASE_URL present: {'SUPABASE_URL' in os.environ}")

# Try to find the URL
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")

# Try to find the Service Role Key (preferred) or any key
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL:
    raise ValueError("Missing SUPABASE_URL in .env file")

if not SUPABASE_KEY:
    raise ValueError("Missing any valid SUPABASE KEY (SERVICE_ROLE_KEY, SERVICE_KEY, or SUPABASE_KEY) in .env file")

print(f"Using Supabase URL: {SUPABASE_URL}")
print(f"Using Supabase Key: {SUPABASE_KEY[:5]}...{SUPABASE_KEY[-5:] if SUPABASE_KEY else ''}")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def fix_constraint():
    print("\n🔧 Starting constraint update...\n")
    
    # Read the SQL script
    script_path = os.path.join(os.path.dirname(__file__), 'fix_wip_status_constraint.sql')
    
    if not os.path.exists(script_path):
        print(f"❌ Error: SQL script not found at {script_path}")
        return False
    
    with open(script_path, 'r', encoding='utf-8') as f:
        sql_script = f.read()
    
    try:
        # Execute the SQL script
        print("📝 Executing SQL script...")
        result = supabase.rpc('exec_sql', {'sql': sql_script}).execute()
        
        print("\n✅ Constraint updated successfully!")
        return True
            
    except Exception as e:
        print(f"\n❌ Error executing script: {str(e)}")
        return False

if __name__ == "__main__":
    fix_constraint()
