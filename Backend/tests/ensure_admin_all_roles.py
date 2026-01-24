import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db

async def ensure_admin_has_all_roles():
    """Ensure admin user has ALL roles for unrestricted access"""
    try:
        db = get_db()
        
        # Find the admin user
        users = db.table('users').select('*').eq('username', 'admin').execute()
        
        if not users.data:
            print("❌ Admin user not found!")
            return
            
        user = users.data[0]
        user_id = user['id']
        print(f"✓ Found user: {user['username']}")
        print(f"  Email: {user['email']}")
        print(f"  Full Name: {user.get('full_name', 'N/A')}")
        
        # Get ALL available roles
        all_roles = db.table('roles').select('*').execute()
        
        if not all_roles.data:
            print("❌ No roles found in database!")
            return
            
        print(f"\n✓ Found {len(all_roles.data)} roles in system:")
        for role in all_roles.data:
            print(f"  - {role['name']} (ID: {role['id']})")
        
        # Get current user roles
        current_roles = db.table('user_roles').select('roles(name)').eq('user_id', user_id).execute()
        current_role_names = [r['roles']['name'] for r in current_roles.data] if current_roles.data else []
        
        print(f"\n✓ Current roles for admin: {current_role_names}")
        
        # Assign ALL roles to admin user
        print(f"\n🔧 Ensuring admin has ALL roles...")
        roles_added = 0
        
        for role in all_roles.data:
            role_id = role['id']
            role_name = role['name']
            
            # Check if user already has this role
            has_role = db.table('user_roles').select('*').match({
                'user_id': user_id,
                'role_id': role_id
            }).execute()
            
            if not has_role.data:
                # Add the role
                db.table('user_roles').insert({
                    'user_id': user_id,
                    'role_id': role_id
                }).execute()
                print(f"  ✓ Added role: {role_name}")
                roles_added += 1
            else:
                print(f"  ✓ Already has: {role_name}")
        
        # Verify final roles
        final_roles = db.table('user_roles').select('roles(name)').eq('user_id', user_id).execute()
        final_role_names = [r['roles']['name'] for r in final_roles.data] if final_roles.data else []
        
        print(f"\n✅ FINAL ROLES for admin user: {final_role_names}")
        print(f"✅ Admin user now has {len(final_role_names)} roles")
        print(f"✅ Admin can access EVERYTHING and perform ALL actions!")
        
        if roles_added > 0:
            print(f"\n🔄 {roles_added} new role(s) added - user should logout/login to refresh session")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(ensure_admin_has_all_roles())
