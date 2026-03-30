from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime
from typing import Optional, List, Union
from app.core.security import decode_token
from app.services.auth_service import auth_service
from app.schemas.user import UserResponse
from app.database import get_db

# Security scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserResponse:
    """
    Dependency to get current authenticated user.
    """
    token = credentials.credentials
    
    # Decode token
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if payload.get('type') != 'access':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get('sub')
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user = await auth_service.get_current_user(user_id)
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user


async def get_current_active_user(
    current_user: UserResponse = Depends(get_current_user)
) -> UserResponse:
    """
    Dependency to ensure user is active.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_role(required_role: Union[str, List[str]]):
    """
    Dependency factory to check if user has required role.
    Accepts a single role string or a list of allowed roles.
    """
    async def role_checker(current_user: UserResponse = Depends(get_current_user)):
        user_roles_lower = [r.lower() for r in current_user.roles] if current_user.roles else []
        
        # Admin bypass - always allow admin
        if 'admin' in user_roles_lower:
            return current_user
            
        allowed_roles = []
        if isinstance(required_role, list):
            allowed_roles = [r.lower() for r in required_role]
        else:
            allowed_roles = [required_role.lower()]
            
        # Check if user has ANY of the allowed roles
        has_role = any(role in user_roles_lower for role in allowed_roles)
        
        if not has_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required"
            )
        return current_user
    
    return role_checker


async def get_current_user_ws(token: str) -> UserResponse:
    """
    Get current authenticated user for WebSocket connections.
    Token passed as query parameter.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token required",
        )
    
    # Decode token
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    if payload.get('type') != 'access':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    
    user_id = payload.get('sub')
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Get user from database
    user = await auth_service.get_current_user(user_id)
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user


def require_worker_module_access(module_key: Union[str, List[str]]):
    """
    Dependency factory for worker-scoped module access.
    - Admin bypasses all checks.
    - Workers must have at least one of the module keys explicitly granted.
    - All other roles (manager, supervisor, etc.) pass through unchanged.
    """
    async def checker(current_user: UserResponse = Depends(get_current_user)):
        user_roles_lower = [r.lower() for r in current_user.roles] if current_user.roles else []

        # Admin always passes
        if 'admin' in user_roles_lower:
            return current_user

        # Non-worker roles pass through without module checks
        if 'worker' not in user_roles_lower:
            return current_user

        # Worker: check cached module permissions from user object
        worker_modules = current_user.worker_modules or []
        
        # If module_key is a list, check if there's any intersection
        if isinstance(module_key, list):
            has_access = any(key in worker_modules for key in module_key)
            module_desc = ", ".join(module_key)
        else:
            has_access = module_key in worker_modules
            module_desc = module_key

        if not has_access:
            with open(r"c:\Work\Inventory Management\Omnix\Backend\auth_debug.log", "a") as f:
                f.write(f"{datetime.now().isoformat()} - 403 FORBIDDEN - User: {current_user.id} ({current_user.email}) - Roles: {current_user.roles} - WorkerModules: {worker_modules} - Requested: {module_key}\n")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access to any of modules [{module_desc}] has not been granted to worker"
            )

        with open(r"c:\Work\Inventory Management\Omnix\Backend\auth_debug.log", "a") as f:
            f.write(f"{datetime.now().isoformat()} - 200 OK - User: {current_user.id} - WorkerModules: {worker_modules} - Requested: {module_key}\n")

        return current_user

    return checker


async def block_worker_delete(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    """
    Hard-blocks DELETE operations for workers on admin-only resources
    (stages, shifts, products, alerts, wip-board).
    For module-scoped deletes, use require_worker_module_access() instead.
    """
    user_roles_lower = [r.lower() for r in current_user.roles] if current_user.roles else []
    if "admin" in user_roles_lower:
        return current_user
    if "worker" in user_roles_lower:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workers are not permitted to delete this resource",
        )
    return current_user


