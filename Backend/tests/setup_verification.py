import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.auth_service import auth_service
from app.schemas.user import UserCreate
from app.database import get_db

async def create_test_admin():
    email = "test_admin@omnix.com"
    username = "test_admin"
    password = "SafePassword123!"
    
    print(f"Attempting to create user: {email}")
    
    try:
        # Check if exists first to avoid conflict error
        db = get_db()
        existing = db.table('users').select('id').eq('email', email).execute()
        
        user_id = None
        if existing.data:
            print("User already exists. Updating role to Admin...")
            user_id = existing.data[0]['id']
        else:
            user_data = UserCreate(
                email=email,
                username=username,
                password=password,
                full_name="Test Admin",
                phone="1234567890"
            )
            try:
                # This assigns Operator role by default
                user = await auth_service.register(user_data)
                user_id = user.id
                print(f"User created with ID: {user_id}")
            except Exception as e:
                print(f"Error registering user: {e}")
                return

        # Assign Admin Role
        if user_id:
            # Get Admin Role ID
            role_res = db.table('roles').select('id').eq('name', 'admin').execute()
            if role_res.data:
                admin_role_id = role_res.data[0]['id']
                
                # Check if already has role
                has_role = db.table('user_roles').select('*').match({
                    'user_id': user_id,
                    'role_id': admin_role_id
                }).execute()
                
                if not has_role.data:
                    db.table('user_roles').insert({
                        'user_id': user_id,
                        'role_id': admin_role_id
                    }).execute()
                    print("Admin role assigned successfully.")
                else:
                    print("User already has Admin role.")
            else:
                print("Error: 'Admin' role not found in database roles table.")
                
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(create_test_admin())
