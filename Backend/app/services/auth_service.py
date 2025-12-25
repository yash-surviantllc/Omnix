from datetime import datetime, timedelta
from typing import Optional, Dict
import secrets
from app.database import get_db, get_admin_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.core.exceptions import (
    AuthenticationException,
    ConflictException,
    NotFoundException
)
from app.core.email import email_service
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.token import Token
from app.config import settings


class AuthService:
    
    @staticmethod
    async def register(user_data: UserCreate) -> UserResponse:
        """
        Register a new user.
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
        }
        
        result = db.table('users').insert(user_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create user")
        
        created_user = result.data[0]
        
        # Assign default role (Operator)
        operator_role = db.table('roles').select('id').eq('name', 'Operator').execute()
        if operator_role.data:
            db.table('user_roles').insert({
                'user_id': created_user['id'],
                'role_id': operator_role.data[0]['id']
            }).execute()
        
        return UserResponse(**created_user, roles=['Operator'])
    
    @staticmethod
    async def login(credentials: UserLogin) -> Token:
        """
        Authenticate user and return tokens.
        """
        db = get_db()
        
        # Find user by email or username
        user_result = db.table('users').select('*').or_(
            f"email.eq.{credentials.email_or_username},username.eq.{credentials.email_or_username}"
        ).execute()
        
        if not user_result.data:
            raise AuthenticationException(detail="Invalid credentials")
        
        user = user_result.data[0]
        
        # Verify password
        if not verify_password(credentials.password, user['password_hash']):
            raise AuthenticationException(detail="Invalid credentials")
        
        # Check if user is active
        if not user['is_active']:
            raise AuthenticationException(detail="Account is inactive")
        
        # Update last login
        db.table('users').update({
            'last_login': datetime.utcnow().isoformat()
        }).eq('id', user['id']).execute()
        
        # Create tokens
        token_data = {"sub": user['id'], "email": user['email']}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        # Store refresh token
        db.table('refresh_tokens').insert({
            'user_id': user['id'],
            'token': refresh_token,
            'expires_at': (datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
        }).execute()
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
    
    @staticmethod
    async def refresh_access_token(refresh_token: str) -> Token:
        """
        Refresh access token using refresh token.
        """
        db = get_db()
        
        # Decode refresh token
        payload = decode_token(refresh_token)
        if not payload or payload.get('type') != 'refresh':
            raise AuthenticationException(detail="Invalid refresh token")
        
        # Check if token exists and not revoked
        token_record = db.table('refresh_tokens').select('*').eq(
            'token', refresh_token
        ).eq('revoked', False).execute()
        
        if not token_record.data:
            raise AuthenticationException(detail="Refresh token revoked or invalid")
        
        token_data = token_record.data[0]
        
        # Check if token expired
        if datetime.fromisoformat(token_data['expires_at'].replace('Z', '+00:00')) < datetime.utcnow():
            raise AuthenticationException(detail="Refresh token expired")
        
        # Get user
        user = db.table('users').select('*').eq('id', payload['sub']).execute()
        if not user.data or not user.data[0]['is_active']:
            raise AuthenticationException(detail="User not found or inactive")
        
        user_data = user.data[0]
        
        # Create new tokens
        new_token_data = {"sub": user_data['id'], "email": user_data['email']}
        new_access_token = create_access_token(new_token_data)
        new_refresh_token = create_refresh_token(new_token_data)
        
        # Revoke old refresh token
        db.table('refresh_tokens').update({
            'revoked': True,
            'revoked_at': datetime.utcnow().isoformat()
        }).eq('token', refresh_token).execute()
        
        # Store new refresh token
        db.table('refresh_tokens').insert({
            'user_id': user_data['id'],
            'token': new_refresh_token,
            'expires_at': (datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
        }).execute()
        
        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
    
    @staticmethod
    async def logout(refresh_token: str) -> Dict[str, str]:
        """
        Logout user by revoking refresh token.
        """
        db = get_db()
        
        # Revoke refresh token
        result = db.table('refresh_tokens').update({
            'revoked': True,
            'revoked_at': datetime.utcnow().isoformat()
        }).eq('token', refresh_token).execute()
        
        return {"message": "Successfully logged out"}
    
    @staticmethod
    async def get_current_user(user_id: str) -> UserResponse:
        """
        Get current user details with roles.
        """
        db = get_db()
        
        # Get user
        user_result = db.table('users').select('*').eq('id', user_id).execute()
        
        if not user_result.data:
            raise NotFoundException(detail="User not found")
        
        user = user_result.data[0]
        
        # Get user roles
        roles_result = db.table('user_roles').select(
            'roles(name)'
        ).eq('user_id', user_id).execute()
        
        roles = [r['roles']['name'] for r in roles_result.data] if roles_result.data else []
        
        return UserResponse(**user, roles=roles)
    
    @staticmethod
    async def forgot_password(email: str) -> Dict[str, str]:
        """
        Initiate password reset process.
        """
        db = get_db()
        
        # Find user by email
        user_result = db.table('users').select('id, email, full_name, is_active').eq('email', email).execute()
        
        if not user_result.data:
            # Don't reveal if email exists or not for security
            return {"message": "If the email exists, a password reset link has been sent"}
        
        user = user_result.data[0]
        
        if not user['is_active']:
            raise AuthenticationException(detail="Account is inactive")
        
        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        
        # Store token in database with 1 hour expiry
        expires_at = datetime.utcnow() + timedelta(hours=1)
        
        db.table('password_reset_tokens').insert({
            'user_id': user['id'],
            'token': reset_token,
            'expires_at': expires_at.isoformat(),
            'used': False
        }).execute()
        
        # Send password reset email
        email_sent = email_service.send_password_reset_email(
            to_email=user['email'],
            reset_token=reset_token,
            user_name=user['full_name']
        )
        
        if not email_sent:
            raise Exception("Failed to send password reset email")
        
        return {"message": "If the email exists, a password reset link has been sent"}
    
    @staticmethod
    async def reset_password(token: str, new_password: str) -> Dict[str, str]:
        """
        Reset password using reset token.
        """
        db = get_db()
        
        # Find valid token
        token_result = db.table('password_reset_tokens').select(
            'id, user_id, expires_at, used'
        ).eq('token', token).execute()
        
        if not token_result.data:
            raise AuthenticationException(detail="Invalid or expired reset token")
        
        token_data = token_result.data[0]
        
        # Check if token is already used
        if token_data['used']:
            raise AuthenticationException(detail="Reset token has already been used")
        
        # Check if token is expired
        expires_at = datetime.fromisoformat(token_data['expires_at'].replace('Z', '+00:00'))
        if datetime.utcnow() > expires_at:
            raise AuthenticationException(detail="Reset token has expired")
        
        # Hash new password
        hashed_password = get_password_hash(new_password)
        
        # Update user password
        db.table('users').update({
            'password_hash': hashed_password,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', token_data['user_id']).execute()
        
        # Mark token as used
        db.table('password_reset_tokens').update({
            'used': True,
            'used_at': datetime.utcnow().isoformat()
        }).eq('id', token_data['id']).execute()
        
        # Invalidate all refresh tokens for this user (force re-login)
        db.table('refresh_tokens').update({
            'revoked': True,
            'revoked_at': datetime.utcnow().isoformat()
        }).eq('user_id', token_data['user_id']).execute()
        
        return {"message": "Password has been reset successfully"}


# Create singleton instance
auth_service = AuthService()