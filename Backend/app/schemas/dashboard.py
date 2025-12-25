from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class KPICard(BaseModel):
    """Individual KPI card data"""
    title: str
    value: int | float
    unit: Optional[str] = None
    trend: Optional[str] = None  # "up", "down", "stable"
    trend_percentage: Optional[float] = None
    icon: Optional[str] = None
    color: Optional[str] = "blue"  # blue, green, red, yellow


class OrderSummary(BaseModel):
    """Orders breakdown by status"""
    total: int
    planned: int
    in_progress: int
    completed: int
    on_hold: int


class ShortageItem(BaseModel):
    """Material shortage item"""
    item_id: str
    item_name: str
    current_stock: float
    required_stock: float
    shortage_qty: float
    unit: str
    priority: str  # "high", "medium", "low"


class ReworkAlert(BaseModel):
    """Rework alert item"""
    order_number: str
    product_name: str
    qty_in_rework: float
    defect_category: str
    stage: str
    days_in_rework: int


class RecentActivity(BaseModel):
    """Recent activity log"""
    id: str
    activity_type: str  # "order_created", "material_transferred", etc.
    description: str
    user_name: str
    timestamp: datetime
    icon: Optional[str] = None


class DashboardKPIs(BaseModel):
    """Complete dashboard KPIs"""
    live_orders: KPICard
    material_shortages: KPICard
    rework_items: KPICard
    otd_percentage: KPICard
    production_efficiency: KPICard


class DashboardResponse(BaseModel):
    """Complete dashboard response"""
    kpis: DashboardKPIs
    orders_summary: OrderSummary
    shortages: List[ShortageItem]
    rework_alerts: List[ReworkAlert]
    recent_activities: List[RecentActivity]
    last_updated: datetime


class QuickAction(BaseModel):
    """Quick action button"""
    id: str
    title: str
    description: str
    route: str
    icon: str
    roles: List[str]  # Roles that can see this action