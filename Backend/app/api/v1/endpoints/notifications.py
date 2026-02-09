"""
Notification API Endpoints
REST API for managing notifications
"""
from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.notification import (
    NotificationResponse,
    NotificationMarkRead
)
from app.schemas.user import UserResponse
from app.services.notification_service import notification_service
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/material-requests")
async def get_material_request_notifications(
    is_read: Optional[bool] = Query(default=None, description="Filter by read status"),
    limit: int = Query(default=50, le=100, description="Maximum number of notifications"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get material request notifications for warehouse/inventory personnel
    
    Returns enriched notifications with full requisition details including:
    - Requisition number (MR-YYYY-NNNN)
    - Work order number
    - Department and requesting stage
    - All items with RM codes, descriptions, and quantities
    """
    return await notification_service.get_material_request_notifications(is_read, limit)


@router.get("/unread-count")
async def get_unread_count(
    role: str = Query(default="inventory", description="Target role (inventory, warehouse, production)"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get count of unread notifications for a role
    
    Returns unread count and timestamp of latest unread notification
    """
    return await notification_service.get_unread_count_for_role(role)


@router.post("/mark-read")
async def mark_notifications_read(
    data: NotificationMarkRead,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Mark one or more notifications as read
    
    Provide a list of notification IDs to mark as read
    """
    return await notification_service.mark_notifications_as_read(data.notification_ids)
