from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.schemas.user import UserResponse, UserCreate, WorkerModulesUpdate
from app.api.deps import get_current_user, require_role
from app.database import get_db, get_admin_db
from app.core.security import get_password_hash
from app.core.exceptions import NotFoundException, ConflictException

VALID_MODULE_KEYS = {
    'dashboard', 'bom', 'orders', 'working-order', 'wip', 'transfer',
    'material-request', 'qc', 'inventory', 'gate-entry', 'gate-exit',
}

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    List all users (Admin only).
    
    - **page**: Page number (default: 1)
    - **limit**: Items per page (default: 20, max: 100)
    - **search**: Search by email, username, or full name
    - **is_active**: Filter by active status
    """
    db = get_db()
    
    # Calculate offset
    offset = (page - 1) * limit
    
    # Build query
    query = db.table('users').select('*')
    
    if search:
        query = query.or_(
            f"email.ilike.%{search}%,username.ilike.%{search}%,full_name.ilike.%{search}%"
        )
    
    if is_active is not None:
        query = query.eq('is_active', is_active)
    
    # Execute query with pagination
    result = query.range(offset, offset + limit - 1).execute()
    
    users = []
    for user in result.data:
        # Get roles for each user
        roles_result = db.table('user_roles').select(
            'roles(name)'
        ).eq('user_id', user['id']).execute()
        
        roles = [r['roles']['name'] for r in roles_result.data] if roles_result.data else []
        users.append(UserResponse(**user, roles=roles))
    
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Get user by ID (Admin only).
    """
    db = get_db()
    
    # Get user
    user_result = db.table('users').select('*').eq('id', user_id).execute()
    
    if not user_result.data:
        raise NotFoundException(detail="User not found")
    
    user = user_result.data[0]
    
    # Get roles
    roles_result = db.table('user_roles').select(
        'roles(name)'
    ).eq('user_id', user_id).execute()
    
    roles = [r['roles']['name'] for r in roles_result.data] if roles_result.data else []
    
    return UserResponse(**user, roles=roles)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Create a new user (Admin only).
    
    Same as register endpoint but accessible only by admins.
    """
    db = get_db()
    
    # Check if email already exists
    existing_email = db.table('users').select('id').eq('email', user_data.email).execute()
    if existing_email.data:
        raise ConflictException(detail="Email already registered")
    
    # Check if username already exists
    existing_username = db.table('users').select('id').eq('username', user_data.username).execute()
    if existing_username.data:
        raise ConflictException(detail="Username already taken")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    user_dict = {
        "email": user_data.email,
        "username": user_data.username,
        "password_hash": hashed_password,
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "is_active": True,
        "is_verified": False,
        "created_by": current_user.id
    }
    
    result = db.table('users').insert(user_dict).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    created_user = result.data[0]
    
    return UserResponse(**created_user, roles=[])


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Update user (Admin only).
    
    - **full_name**: New full name
    - **phone**: New phone number
    - **is_active**: Active status
    """
    db = get_db()
    
    # Check if user exists
    existing = db.table('users').select('id').eq('id', user_id).execute()
    if not existing.data:
        raise NotFoundException(detail="User not found")
    
    update_data = {"updated_by": current_user.id}
    
    if full_name is not None:
        update_data['full_name'] = full_name
    if phone is not None:
        update_data['phone'] = phone
    if is_active is not None:
        update_data['is_active'] = is_active
    
    # Update user
    result = db.table('users').update(update_data).eq('id', user_id).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    # Get updated user with roles
    roles_result = db.table('user_roles').select(
        'roles(name)'
    ).eq('user_id', user_id).execute()
    
    roles = [r['roles']['name'] for r in roles_result.data] if roles_result.data else []
    
    return UserResponse(**result.data[0], roles=roles)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Delete/deactivate user (Admin only).
    
    Instead of hard delete, we deactivate the user.
    """
    db = get_db()
    
    # Check if user exists
    existing = db.table('users').select('id').eq('id', user_id).execute()
    if not existing.data:
        raise NotFoundException(detail="User not found")
    
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Deactivate user instead of deleting
    db.table('users').update({
        'is_active': False,
        'updated_by': current_user.id
    }).eq('id', user_id).execute()
    
    return None


@router.put("/{user_id}/roles", response_model=UserResponse)
async def assign_roles(
    user_id: str,
    role_names: List[str],
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Assign roles to user (Admin only).
    
    - **role_names**: List of role names to assign
    
    This will replace all existing roles with the new ones.
    """
    db = get_db()
    
    # Check if user exists
    user_result = db.table('users').select('*').eq('id', user_id).execute()

    if not user_result.data:
        raise NotFoundException(detail="User not found")
    
    # Get role IDs
    roles_result = db.table('roles').select('id', 'name').in_('name', role_names).execute()
    
    if len(roles_result.data) != len(role_names):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more role names are invalid"
        )
    
    # Delete existing roles
    db.table('user_roles').delete().eq('user_id', user_id).execute()
    
    # Assign new roles
    for role in roles_result.data:
        db.table('user_roles').insert({
            'user_id': user_id,
            'role_id': role['id'],
            'assigned_by': current_user.id
        }).execute()
    
    # Get updated user with roles
    roles_query = db.table('user_roles').select('roles(name)').eq('user_id', user_id).execute()
    roles = [role['roles']['name'] for role in roles_query.data] if roles_query.data else []

    return UserResponse(
        **user_result.data[0],
        roles=roles
    )


@router.get("/roles/list", response_model=List[dict])
async def list_roles(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all available roles.
    Available to all authenticated users.
    """
    db = get_db()
    
    result = db.table('roles').select('*').eq('is_active', True).execute()
    
    return result.data


# ── Worker Module Permission Management ──────────────────────────────────────

@router.get("/{user_id}/worker-modules", response_model=List[str])
async def get_worker_modules(
    user_id: str,
    current_user: UserResponse = Depends(require_role("admin"))
):
    """
    List granted modules for a worker (Admin only).
    """
    db = get_db()
    result = db.table('worker_module_permissions') \
        .select('module_key') \
        .eq('user_id', user_id) \
        .execute()
    modules = [r['module_key'] for r in result.data] if result.data else []
    if 'dashboard' not in modules:
        modules.insert(0, 'dashboard')
    return modules


@router.put("/{user_id}/worker-modules", response_model=List[str])
async def replace_worker_modules(
    user_id: str,
    body: WorkerModulesUpdate,
    current_user: UserResponse = Depends(require_role("admin"))
):
    """
    Replace full module list for a worker (Admin only).
    Dashboard is always granted implicitly.
    """
    db = get_db()

    # Validate user exists
    user_check = db.table('users').select('id').eq('id', user_id).execute()
    if not user_check.data:
        raise NotFoundException(detail="User not found")

    # Validate module keys
    invalid = [m for m in body.modules if m not in VALID_MODULE_KEYS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid module keys: {invalid}"
        )

    # Remove 'dashboard' from payload — it's always implicitly granted
    modules_to_store = [m for m in body.modules if m != 'dashboard']

    # Atomic replace: delete existing, insert new
    db.table('worker_module_permissions').delete().eq('user_id', user_id).execute()
    for mod in modules_to_store:
        db.table('worker_module_permissions').insert({
            'user_id': user_id,
            'module_key': mod,
            'granted_by': current_user.id,
        }).execute()

    return ['dashboard'] + modules_to_store


@router.post("/{user_id}/worker-modules/{module_key}", status_code=status.HTTP_201_CREATED)
async def grant_worker_module(
    user_id: str,
    module_key: str,
    current_user: UserResponse = Depends(require_role("admin"))
):
    """
    Grant a single module to a worker (Admin only).
    """
    if module_key not in VALID_MODULE_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid module key: '{module_key}'"
        )
    if module_key == 'dashboard':
        return {"detail": "Dashboard is always granted by default"}

    db = get_db()

    # Check user exists
    user_check = db.table('users').select('id').eq('id', user_id).execute()
    if not user_check.data:
        raise NotFoundException(detail="User not found")

    # Check for duplicate
    existing = db.table('worker_module_permissions') \
        .select('id') \
        .eq('user_id', user_id) \
        .eq('module_key', module_key) \
        .execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Module '{module_key}' already granted"
        )

    db.table('worker_module_permissions').insert({
        'user_id': user_id,
        'module_key': module_key,
        'granted_by': current_user.id,
    }).execute()

    return {"detail": f"Module '{module_key}' granted to user {user_id}"}


@router.delete("/{user_id}/worker-modules/{module_key}", status_code=status.HTTP_200_OK)
async def revoke_worker_module(
    user_id: str,
    module_key: str,
    current_user: UserResponse = Depends(require_role("admin"))
):
    """
    Revoke a single module from a worker (Admin only).
    """
    if module_key == 'dashboard':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke dashboard access"
        )

    db = get_db()
    result = db.table('worker_module_permissions') \
        .delete() \
        .eq('user_id', user_id) \
        .eq('module_key', module_key) \
        .execute()

    if not result.data:
        raise NotFoundException(detail=f"Module '{module_key}' was not granted to this user")

    return {"detail": f"Module '{module_key}' revoked from user {user_id}"}