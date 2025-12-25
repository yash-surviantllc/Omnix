from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict
from app.schemas.user import UserCreate, UserLogin, UserResponse, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.schemas.token import Token, RefreshTokenRequest
from app.services.auth_service import auth_service
from app.api.deps import get_current_user
from app.core.security import verify_password, get_password_hash
from app.database import get_db

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """
    Register a new user.
    
    - **email**: Valid email address (must be unique)
    - **username**: Username (3-50 characters, must be unique)
    - **password**: Strong password (min 8 chars, uppercase, lowercase, digit, special char)
    - **full_name**: User's full name
    - **phone**: Optional phone number
    """
    return await auth_service.register(user_data)


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """
    Login with email/username and password.
    
    Returns access token (30 min expiry) and refresh token (7 days expiry).
    
    - **email_or_username**: Email address or username
    - **password**: User password
    """
    return await auth_service.login(credentials)


@router.post("/refresh", response_model=Token)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    
    - **refresh_token**: Valid refresh token received from login
    
    Returns new access token and refresh token. Old refresh token is revoked.
    """
    return await auth_service.refresh_access_token(request.refresh_token)


@router.post("/logout", response_model=Dict[str, str])
async def logout(
    request: RefreshTokenRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Logout user by revoking refresh token.
    
    Requires authentication. Pass refresh token to revoke it.
    """
    return await auth_service.logout(request.refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get current user profile.
    
    Requires authentication via Bearer token.
    """
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    full_name: str = None,
    phone: str = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update current user profile.
    
    - **full_name**: New full name (optional)
    - **phone**: New phone number (optional)
    """
    db = get_db()
    
    update_data = {}
    if full_name:
        update_data['full_name'] = full_name
    if phone:
        update_data['phone'] = phone
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Update user
    result = db.table('users').update(update_data).eq('id', current_user.id).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    # Return updated user
    return await auth_service.get_current_user(current_user.id)


@router.post("/change-password", response_model=Dict[str, str])
async def change_password(
    request: ChangePasswordRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Change user password.
    
    - **current_password**: Current password for verification
    - **new_password**: New strong password
    """
    db = get_db()
    
    # Get user with password hash
    user_result = db.table('users').select('password_hash').eq('id', current_user.id).execute()
    
    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user = user_result.data[0]
    
    # Verify current password
    if not verify_password(request.current_password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Hash new password
    new_password_hash = get_password_hash(request.new_password)
    
    # Update password
    db.table('users').update({
        'password_hash': new_password_hash
    }).eq('id', current_user.id).execute()
    
    return {"message": "Password changed successfully"}


@router.post("/forgot-password", response_model=Dict[str, str])
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request password reset link.
    
    Sends a password reset email if the email exists in the system.
    For security, always returns success message regardless of email existence.
    
    - **email**: Email address associated with the account
    """
    return await auth_service.forgot_password(request.email)


@router.post("/reset-password", response_model=Dict[str, str])
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using reset token.
    
    - **token**: Password reset token from email
    - **new_password**: New strong password
    """
    return await auth_service.reset_password(request.token, request.new_password)