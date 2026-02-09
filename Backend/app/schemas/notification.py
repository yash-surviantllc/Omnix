"""
Notification Schemas
Pydantic models for notification system
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: str
    notification_type: str
    title: str
    message: str
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    reference_number: Optional[str] = None
    target_role: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    """Schema for marking notifications as read"""
    notification_ids: List[str] = Field(..., min_length=1, description="List of notification IDs to mark as read")


class MaterialRequestNotificationDetail(BaseModel):
    """Detailed notification for material requests with full requisition data"""
    notification_id: str
    is_read: bool
    created_at: datetime
    requisition_number: str
    work_order_number: Optional[str] = None
    sku_id: Optional[str] = None  # Added for notification detail display
    product_name: Optional[str] = None # Added for notification detail display
    department: str
    requesting_stage: Optional[str] = None
    requested_by: str
    shift: Optional[str] = None
    status: str
    items: List[Dict[str, Any]]  # List of items with rm_code, description, quantity
    
    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    """Schema for unread notification count"""
    unread_count: int
    latest_unread_at: Optional[datetime] = None
