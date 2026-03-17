from pydantic import BaseModel, EmailStr, Field, TypeAdapter, ValidationError, field_validator
from typing import Optional, List
from datetime import datetime
import re


class UserBase(BaseModel):
    email: str
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        """Allow real emails or Supabase synthetic ones with '@'."""
        if not isinstance(v, str) or '@' not in v:
            raise ValueError('Invalid email address')

        # Prefer strict validation when possible
        email_adapter = TypeAdapter(EmailStr)
        try:
            email_adapter.validate_python(v)
            return v
        except ValidationError:
            # Supabase legacy auth seeds may append metadata after domain
            # Accept such values if they still contain '@' to avoid crashes
            return v


class UserCreate(UserBase):
    email: EmailStr
    password: str = Field(..., min_length=8)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """
        Validate password strength:
        - At least 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        """
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        
        return v


class UserLogin(BaseModel):
    email_or_username: str
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class WorkerModulesUpdate(BaseModel):
    modules: List[str]


class UserResponse(UserBase):
    id: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    roles: Optional[List[str]] = []
    worker_modules: Optional[List[str]] = None
    
    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        """Validate new password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)