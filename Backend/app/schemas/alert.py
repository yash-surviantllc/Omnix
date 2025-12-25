from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


# ============================================
# ALERT CONFIGURATION SCHEMAS
# ============================================

class AlertConfigBase(BaseModel):
    alert_type: str = Field(..., description="Type of alert: low_utilization, high_avg_time, bottleneck, stage_delayed")
    stage_name: Optional[str] = Field(None, description="Stage name or NULL for all stages")
    threshold_value: Decimal = Field(..., description="Threshold value (e.g., 70 for 70%)")
    is_active: bool = Field(True, description="Whether alert is active")
    notify_roles: List[str] = Field(default_factory=lambda: ["Supervisor", "Admin"], description="Roles to notify")
    notify_emails: Optional[List[str]] = Field(None, description="Specific email addresses to notify")


class AlertConfigCreate(AlertConfigBase):
    pass


class AlertConfigUpdate(BaseModel):
    alert_type: Optional[str] = None
    stage_name: Optional[str] = None
    threshold_value: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notify_roles: Optional[List[str]] = None
    notify_emails: Optional[List[str]] = None


class AlertConfigResponse(AlertConfigBase):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True


# ============================================
# ALERT HISTORY SCHEMAS
# ============================================

class AlertHistoryBase(BaseModel):
    alert_type: str
    stage_name: str
    severity: str = Field(..., description="info, warning, or critical")
    message: str
    current_value: Optional[Decimal] = None
    threshold_value: Optional[Decimal] = None
    metadata: Optional[Dict[str, Any]] = None


class AlertHistoryResponse(AlertHistoryBase):
    id: str
    alert_config_id: Optional[str] = None
    is_acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AlertAcknowledge(BaseModel):
    alert_id: str
    notes: Optional[str] = None


# ============================================
# NOTIFICATION SCHEMAS
# ============================================

class NotificationLogResponse(BaseModel):
    id: str
    alert_history_id: str
    notification_type: str
    recipient: str
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class SendNotificationRequest(BaseModel):
    alert_id: str
    recipients: List[str]
    notification_type: str = Field(default="in_app", description="email, sms, in_app, webhook")


class NotificationResponse(BaseModel):
    alert_id: str
    notification_type: str
    results: List[Dict[str, Any]]


# ============================================
# ALERT SUMMARY SCHEMAS
# ============================================

class AlertSummary(BaseModel):
    total_alerts: int
    unacknowledged_alerts: int
    critical_alerts: int
    warning_alerts: int
    info_alerts: int
    alerts_by_stage: Dict[str, int]
    recent_alerts: List[AlertHistoryResponse]
