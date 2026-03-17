from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# ============================================
# ENUMS
# ============================================

class WIPHealthStatus(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class WIPAlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class WIPAlertType(str, Enum):
    UNDER_UTILIZATION = "under_utilization"
    OVER_UTILIZATION = "over_utilization"
    BOTTLENECK = "bottleneck"
    DELAY = "delay"


# ============================================
# WORKING ORDER SCHEMAS
# ============================================

class WorkingOrderBase(BaseModel):
    purchase_order_id: str
    product_id: Optional[str] = None # Added product_id linkage
    operation: Optional[str] = Field(None, description="Operation name (auto-assigned if config_id provided)")
    shift: Optional[str] = "Morning" # Added shift field
    workstation_id: Optional[str] = None  # Added
    workstation_name: Optional[str] = None  # Renamed from workstation
    assigned_team: Optional[str] = None
    target_qty: Decimal = Field(..., gt=0)
    unit: str
    priority: str = Field(default="Medium", pattern="^(Low|Medium|High|Urgent)$")
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    notes: Optional[str] = None


class WorkingOrderCreate(WorkingOrderBase):
    config_id: Optional[str] = None


class WorkingOrderUpdate(BaseModel):
    operation: Optional[str] = None
    workstation_id: Optional[str] = None  # Added
    workstation_name: Optional[str] = None  # Renamed from workstation
    assigned_team: Optional[str] = None
    target_qty: Optional[Decimal] = Field(None, gt=0)
    completed_qty: Optional[Decimal] = Field(None, ge=0)
    rejected_qty: Optional[Decimal] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(Pending|In Progress|Completed|On Hold|Cancelled)$")
    priority: Optional[str] = Field(None, pattern="^(Low|Normal|Medium|High|Urgent|LOW|MEDIUM|HIGH|URGENT)$")
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    notes: Optional[str] = None


class WorkingOrderResponse(WorkingOrderBase):
    id: str
    work_order_number: str
    config_id: Optional[str] = None # Support dynamic config tracking
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
    purchase_order_id: Optional[str] = None # made optional to be safe
    product_id: Optional[str] = None # Added for QC/Process linkage
    operation: str
    workstation_id: Optional[str] = None  # Added
    workstation_name: Optional[str] = None  # Renamed from workstation
    assigned_team: Optional[str] = None
    target_qty: Decimal
    completed_qty: Decimal
    unit: str
    status: str
    priority: str
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    rejected_qty: Decimal = Decimal('0')
    notes: Optional[str] = None
    shift: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Enhanced fields for list view optimization
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    purchase_order_number: Optional[str] = None
    config_id: Optional[str] = None # Support dynamic config resolution
    transferred_qty: Decimal = Decimal('0') # Support batched quantity tracking

    
    class Config:
        from_attributes = True


class UniqueWorkingOrderItem(BaseModel):
    """Unique working order for dropdown selection (one per work_order_number)"""
    id: str
    work_order_number: str
    product_name: str
    status: str
    target_qty: Decimal
    completed_qty: Decimal
    product_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    
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
    health_status: WIPHealthStatus
    is_active: bool
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WIPStageMetricsListItem(BaseModel):
    """Simplified stage metrics for WIP board"""
    id: str
    stage_name: str
    stage_sequence: int
    orders_count: int
    units_count: int
    avg_time_minutes: Decimal
    target_avg_time_minutes: Decimal = Field(validation_alias="target_time_minutes", serialization_alias="target_avg_time_minutes")
    utilization_percentage: Decimal
    health_status: WIPHealthStatus

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
    stages_green: int
    stages_yellow: int
    stages_red: int


class BottleneckAlert(BaseModel):
    """Bottleneck alert information"""
    stage_name: str
    utilization_percentage: Decimal
    avg_time_minutes: Decimal
    target_time_minutes: Decimal
    orders_count: int
    units_count: int
    severity: str  # warning, critical



class WIPStageBase(BaseModel):
    name: str
    code: str = Field(..., max_length=50)
    sequence_number: int = Field(..., ge=1)
    target_avg_time_minutes: Decimal = Field(..., gt=0)
    description: Optional[str] = None
    color: Optional[str] = Field(default="#3B82F6", description="Hex color for UI chips")
    icon: Optional[str] = Field(default=None, description="Optional Lucide icon name")
    location_id: Optional[str] = None
    is_active: bool = True


class WIPStageCreate(WIPStageBase):
    created_by: Optional[str] = None


class WIPStageUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = Field(default=None, max_length=50)
    sequence_number: Optional[int] = Field(default=None, ge=1)
    target_avg_time_minutes: Optional[Decimal] = Field(default=None, gt=0)
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    location_id: Optional[str] = None
    is_active: Optional[bool] = None


class WIPStageResponse(WIPStageBase):
    id: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WIPStageMetrics(BaseModel):
    stage_id: str
    stage_name: str
    sequence_number: int
    orders_count: int
    units_count: Decimal
    avg_time_minutes: Decimal
    target_avg_time_minutes: Decimal
    utilization_percentage: Decimal
    health_status: WIPHealthStatus


class WIPBoardResponse(BaseModel):
    stages: List[WIPStageMetrics]
    total_orders: int
    total_units: Decimal
    avg_cycle_time: Decimal
    bottleneck_stage: Optional[str] = None
    last_updated: datetime


class StageOrderItem(BaseModel):
    order_id: str
    order_number: str
    product_name: Optional[str] = None
    quantity_in_stage: Decimal
    priority: Optional[str] = None
    status: Optional[str] = None
    entered_stage_at: datetime


class StageOrdersResponse(BaseModel):
    stage_id: str
    stage_name: str
    orders: List[StageOrderItem]


class StageMetricPoint(BaseModel):
    timestamp: datetime
    orders_in_stage: int
    units_in_stage: Decimal
    avg_time_minutes: Decimal
    utilization_percentage: Decimal
    health_status: WIPHealthStatus


class StageMetricsDetailResponse(BaseModel):
    stage: WIPStageResponse
    latest_metrics: WIPStageMetrics
    history: List[StageMetricPoint]


class WIPTransferCreate(BaseModel):
    order_id: str
    from_stage_id: Optional[str] = None
    to_stage_id: str
    quantity: Decimal = Field(..., gt=0)
    unit: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    notes: Optional[str] = None


class WIPTransferResponse(WIPTransferCreate):
    id: str
    transfer_number: str
    status: str
    actual_time_minutes: Optional[Decimal] = None
    transferred_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BottleneckResponse(BaseModel):
    stage_id: str
    stage_name: str
    avg_time_minutes: Decimal
    target_avg_time_minutes: Decimal
    utilization_percentage: Decimal
    orders_count: int
    units_count: Decimal
    severity: WIPAlertSeverity


class TrendPoint(BaseModel):
    date: date
    orders_processed: int
    units_processed: Decimal
    avg_time_minutes: Decimal
    utilization_percentage: Decimal
    health_status: WIPHealthStatus


class TrendResponse(BaseModel):
    stage_id: str
    stage_name: str
    points: List[TrendPoint]


class WIPAlertResponse(BaseModel):
    stage_id: str
    stage_name: str
    alert_type: WIPAlertType
    severity: WIPAlertSeverity
    message: str
    detected_at: datetime


class WIPEventType(str, Enum):
    STAGE_UPDATE = "stage_update"
    TRANSFER_RECORDED = "transfer_recorded"
    ALERT = "alert"


class WIPEventBase(BaseModel):
    event_type: WIPEventType
    timestamp: datetime


class StageUpdatePayload(WIPEventBase):
    data: WIPStageMetrics


class TransferEventPayload(WIPEventBase):
    data: WIPTransferResponse


class AlertEventPayload(WIPEventBase):
    data: WIPAlertResponse
