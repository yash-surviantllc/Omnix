import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

print("🔍 Verifying Supabase Database Setup...\n")

# Check if tables exist by trying to query them
tables_to_check = ['users', 'roles', 'user_roles', 'refresh_tokens']

for table in tables_to_check:
    try:
        result = supabase.table(table).select('*').limit(1).execute()
        print(f"✅ Table '{table}' exists")
        
        # For roles table, show the default roles
        if table == 'roles':
            roles_result = supabase.table('roles').select('name').execute()
            if roles_result.data:
                role_names = [r['name'] for r in roles_result.data]
                print(f"   Default roles: {', '.join(role_names)}")
            else:
                print(f"   ⚠️  No roles found - migration may not have inserted default roles")
                
    except Exception as e:
        print(f"❌ Table '{table}' does not exist or error: {str(e)}")

print("\n" + "="*50)

# Check if we can create a test query
try:
    user_count = supabase.table('users').select('id', count='exact').execute()
    print(f"\n📊 Current user count: {user_count.count}")
    
    if user_count.count == 0:
        print("\n💡 Next step: Create your first user via:")
        print("   - API: http://localhost:8000/docs → POST /api/v1/auth/register")
        print("   - Or insert directly in Supabase Table Editor")
    else:
        print(f"\n✅ Database has {user_count.count} user(s) already!")
        
except Exception as e:
    print(f"\n❌ Error checking users: {str(e)}")

print("\n" + "="*50)
print("✅ Database verification complete!")
