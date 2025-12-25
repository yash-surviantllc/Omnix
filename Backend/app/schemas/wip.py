from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# ============================================
# WORKING ORDER SCHEMAS
# ============================================

class WorkingOrderBase(BaseModel):
    production_order_id: str
    operation: str = Field(..., description="Operation name (e.g., Cutting, Sewing)")
    workstation: Optional[str] = None
    assigned_team: Optional[str] = None
    target_qty: Decimal = Field(..., gt=0)
    unit: str
    priority: str = Field(default="Normal", pattern="^(Low|Normal|High|Urgent)$")
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    notes: Optional[str] = None


class WorkingOrderCreate(WorkingOrderBase):
    pass


class WorkingOrderUpdate(BaseModel):
    operation: Optional[str] = None
    workstation: Optional[str] = None
    assigned_team: Optional[str] = None
    target_qty: Optional[Decimal] = Field(None, gt=0)
    completed_qty: Optional[Decimal] = Field(None, ge=0)
    rejected_qty: Optional[Decimal] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(Pending|In Progress|Completed|On Hold|Cancelled)$")
    priority: Optional[str] = Field(None, pattern="^(Low|Normal|High|Urgent)$")
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    notes: Optional[str] = None


class WorkingOrderResponse(WorkingOrderBase):
    id: str
    work_order_number: str
    completed_qty: Decimal
    rejected_qty: Decimal
    status: str
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WorkingOrderListItem(BaseModel):
    """Simplified working order for list views"""
    id: str
    work_order_number: str
    production_order_id: str
    operation: str
    workstation: Optional[str] = None
    assigned_team: Optional[str] = None
    target_qty: Decimal
    completed_qty: Decimal
    unit: str
    status: str
    priority: str
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================
# WIP STAGE METRICS SCHEMAS
# ============================================

class WIPStageMetricsBase(BaseModel):
    stage_name: str
    stage_sequence: int
    target_time_minutes: Decimal = Field(..., gt=0)


class WIPStageMetricsCreate(WIPStageMetricsBase):
    is_active: bool = True


class WIPStageMetricsUpdate(BaseModel):
    target_time_minutes: Optional[Decimal] = Field(None, gt=0)
    is_active: Optional[bool] = None


class WIPStageMetricsResponse(WIPStageMetricsBase):
    id: str
    orders_count: int
    units_count: int
    avg_time_minutes: Decimal
    utilization_percentage: Decimal
    health_status: str
    is_active: bool
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WIPStageMetricsListItem(BaseModel):
    """Simplified stage metrics for WIP board"""
    id: str
    stage_name: str
    stage_sequence: int
    orders_count: int = Field(alias="orders")
    units_count: int = Field(alias="units")
    avg_time_minutes: Decimal = Field(alias="avgTime")
    target_time_minutes: Decimal = Field(alias="targetAvgTime")
    utilization_percentage: Decimal = Field(alias="utilization")
    health_status: str = Field(alias="health")
    
    class Config:
        from_attributes = True
        populate_by_name = True


# ============================================
# STAGE PERFORMANCE HISTORY SCHEMAS
# ============================================

class StagePerformanceHistoryBase(BaseModel):
    stage_name: str
    date: date


class StagePerformanceHistoryCreate(StagePerformanceHistoryBase):
    orders_processed: int = 0
    units_processed: int = 0
    avg_time_minutes: Decimal = Decimal('0')
    utilization_percentage: Decimal = Decimal('0')
    efficiency_percentage: Decimal = Decimal('0')


class StagePerformanceHistoryResponse(StagePerformanceHistoryBase):
    id: str
    orders_processed: int
    units_processed: int
    avg_time_minutes: Decimal
    utilization_percentage: Decimal
    efficiency_percentage: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================
# WIP DASHBOARD SCHEMAS
# ============================================

class WIPDashboardResponse(BaseModel):
    """Complete WIP dashboard data"""
    stages: List[WIPStageMetricsListItem]
    total_orders: int
    total_units: int
    avg_cycle_time: Decimal
    bottleneck_stage: Optional[str] = None
    last_updated: datetime


class WIPSummaryStats(BaseModel):
    """Summary statistics for WIP board"""
    total_orders: int
    total_units: int
    avg_cycle_time_minutes: Decimal
    bottleneck_stage: Optional[str] = None
    stages_healthy: int
    stages_warning: int
    stages_delayed: int


class BottleneckAlert(BaseModel):
    """Bottleneck alert information"""
    stage_name: str
    utilization_percentage: Decimal
    avg_time_minutes: Decimal
    target_time_minutes: Decimal
    orders_count: int
    units_count: int
    severity: str  # warning, critical
