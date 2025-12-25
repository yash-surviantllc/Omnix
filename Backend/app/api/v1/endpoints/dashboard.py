from fastapi import APIRouter, Depends
from typing import List
from app.schemas.dashboard import DashboardResponse, QuickAction
from app.schemas.user import UserResponse
from app.services.dashboard_service import dashboard_service
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get complete dashboard data.
    
    Returns:
    - KPIs (live orders, shortages, rework, OTD%, efficiency)
    - Orders summary by status
    - Material shortages list
    - Rework alerts
    - Recent activities
    
    Data is role-based and filtered for the current user.
    """
    return await dashboard_service.get_dashboard_data(
        user_id=current_user.id,
        user_roles=current_user.roles
    )


@router.get("/kpis", response_model=DashboardResponse)
async def get_dashboard_kpis(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get only KPIs (lightweight endpoint for auto-refresh).
    
    This endpoint can be called every 30 seconds for real-time updates.
    """
    return await dashboard_service.get_dashboard_data(
        user_id=current_user.id,
        user_roles=current_user.roles
    )


@router.get("/quick-actions", response_model=List[QuickAction])
async def get_quick_actions(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get quick action buttons based on user roles.
    
    Returns list of actions the user is authorized to perform.
    """
    return await dashboard_service.get_quick_actions(current_user.roles)


@router.get("/orders-summary")
async def get_orders_summary(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get detailed orders breakdown by status.
    
    Drill-down from Orders KPI card.
    """
    # TODO: Implement when production_orders table exists
    return {
        "total": 0,
        "by_status": {
            "planned": 0,
            "in_progress": 0,
            "completed": 0,
            "on_hold": 0
        },
        "by_priority": {
            "urgent": 0,
            "high": 0,
            "medium": 0,
            "low": 0
        }
    }


@router.get("/shortages")
async def get_shortages_detail(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get detailed material shortages.
    
    Drill-down from Shortages KPI card.
    """
    # TODO: Implement when inventory table exists
    return {
        "total_shortages": 0,
        "critical_count": 0,
        "items": []
    }


@router.get("/rework")
async def get_rework_detail(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get detailed rework information.
    
    Drill-down from Rework KPI card.
    """
    # TODO: Implement when qc_inspections table exists
    return {
        "total_items": 0,
        "total_quantity": 0,
        "by_defect_category": {},
        "items": []
    }