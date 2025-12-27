from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.alert import (
    AlertConfigCreate, AlertConfigUpdate, AlertConfigResponse,
    AlertHistoryResponse, AlertAcknowledge, NotificationLogResponse,
    SendNotificationRequest, NotificationResponse, AlertSummary
)
from app.schemas.user import UserResponse
from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.services.notification_service import notification_service
from datetime import datetime, timedelta

router = APIRouter()


# ============================================
# ALERT CONFIGURATION ENDPOINTS
# ============================================

@router.post("/config", response_model=AlertConfigResponse, status_code=201)
async def create_alert_config(
    config_data: AlertConfigCreate,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Create a new alert configuration.
    
    - **alert_type**: low_utilization, high_avg_time, bottleneck, stage_delayed
    - **threshold_value**: Threshold for triggering alert (e.g., 70 for 70%)
    - **notify_roles**: Roles to notify when alert triggers
    """
    db = get_db()
    
    config_dict = config_data.model_dump()
    config_dict['created_by'] = current_user.id
    
    result = db.table('wip_alert_config').insert(config_dict).execute()
    
    if not result.data:
        raise Exception("Failed to create alert configuration")
    
    return AlertConfigResponse(**result.data[0])


@router.get("/config", response_model=List[AlertConfigResponse])
async def list_alert_configs(
    alert_type: Optional[str] = None,
    stage_name: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """List all alert configurations with optional filters"""
    db = get_db()
    
    query = db.table('wip_alert_config').select('*')
    
    if alert_type:
        query = query.eq('alert_type', alert_type)
    if stage_name:
        query = query.eq('stage_name', stage_name)
    if is_active is not None:
        query = query.eq('is_active', is_active)
    
    result = query.order('alert_type', 'stage_name').execute()
    
    return [AlertConfigResponse(**config) for config in result.data]


@router.get("/config/{config_id}", response_model=AlertConfigResponse)
async def get_alert_config(
    config_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get alert configuration by ID"""
    db = get_db()
    
    result = db.table('wip_alert_config').select('*').eq('id', config_id).execute()
    
    if not result.data:
        raise Exception(f"Alert configuration {config_id} not found")
    
    return AlertConfigResponse(**result.data[0])


@router.put("/config/{config_id}", response_model=AlertConfigResponse)
async def update_alert_config(
    config_id: str,
    config_data: AlertConfigUpdate,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """Update alert configuration"""
    db = get_db()
    
    update_dict = {k: v for k, v in config_data.model_dump(exclude_unset=True).items() if v is not None}
    
    if not update_dict:
        return await get_alert_config(config_id, current_user)
    
    result = db.table('wip_alert_config').update(update_dict).eq('id', config_id).execute()
    
    if not result.data:
        raise Exception(f"Alert configuration {config_id} not found")
    
    return AlertConfigResponse(**result.data[0])


@router.delete("/config/{config_id}")
async def delete_alert_config(
    config_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """Delete alert configuration"""
    db = get_db()
    
    result = db.table('wip_alert_config').delete().eq('id', config_id).execute()
    
    if not result.data:
        raise Exception(f"Alert configuration {config_id} not found")
    
    return {"message": "Alert configuration deleted successfully"}


# ============================================
# ALERT HISTORY ENDPOINTS
# ============================================

@router.get("/history", response_model=List[AlertHistoryResponse])
async def list_alert_history(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    severity: Optional[str] = None,
    stage_name: Optional[str] = None,
    is_acknowledged: Optional[bool] = None,
    days: int = Query(7, ge=1, le=30),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List alert history with filters.
    
    - **severity**: Filter by severity (info/warning/critical)
    - **stage_name**: Filter by stage
    - **is_acknowledged**: Filter by acknowledgment status
    - **days**: Number of days of history (default 7)
    """
    db = get_db()
    
    offset = (page - 1) * limit
    cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    query = db.table('wip_alert_history').select('*').gte('created_at', cutoff_date)
    
    if severity:
        query = query.eq('severity', severity)
    if stage_name:
        query = query.eq('stage_name', stage_name)
    if is_acknowledged is not None:
        query = query.eq('is_acknowledged', is_acknowledged)
    
    result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
    
    return [AlertHistoryResponse(**alert) for alert in result.data]


@router.get("/history/{alert_id}", response_model=AlertHistoryResponse)
async def get_alert_history(
    alert_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get alert history by ID"""
    db = get_db()
    
    result = db.table('wip_alert_history').select('*').eq('id', alert_id).execute()
    
    if not result.data:
        raise Exception(f"Alert {alert_id} not found")
    
    return AlertHistoryResponse(**result.data[0])


@router.post("/history/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    ack_data: AlertAcknowledge,
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """Acknowledge an alert"""
    db = get_db()
    
    result = db.table('wip_alert_history').update({
        'is_acknowledged': True,
        'acknowledged_by': current_user.id,
        'acknowledged_at': datetime.utcnow().isoformat()
    }).eq('id', alert_id).execute()
    
    if not result.data:
        raise Exception(f"Alert {alert_id} not found")
    
    return {"message": "Alert acknowledged successfully"}


@router.get("/summary", response_model=AlertSummary)
async def get_alert_summary(
    days: int = Query(7, ge=1, le=30),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get alert summary statistics.
    
    Returns counts by severity, stage, and recent alerts.
    """
    db = get_db()
    
    cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    # Get all alerts in time period
    alerts = db.table('wip_alert_history').select('*').gte('created_at', cutoff_date).execute()
    
    total_alerts = len(alerts.data)
    unacknowledged = len([a for a in alerts.data if not a['is_acknowledged']])
    critical = len([a for a in alerts.data if a['severity'] == 'critical'])
    warning = len([a for a in alerts.data if a['severity'] == 'warning'])
    info = len([a for a in alerts.data if a['severity'] == 'info'])
    
    # Count by stage
    alerts_by_stage = {}
    for alert in alerts.data:
        stage = alert['stage_name']
        alerts_by_stage[stage] = alerts_by_stage.get(stage, 0) + 1
    
    # Get recent alerts
    recent = sorted(alerts.data, key=lambda x: x['created_at'], reverse=True)[:10]
    
    return AlertSummary(
        total_alerts=total_alerts,
        unacknowledged_alerts=unacknowledged,
        critical_alerts=critical,
        warning_alerts=warning,
        info_alerts=info,
        alerts_by_stage=alerts_by_stage,
        recent_alerts=[AlertHistoryResponse(**a) for a in recent]
    )


# ============================================
# NOTIFICATION ENDPOINTS
# ============================================

@router.post("/notify", response_model=NotificationResponse)
async def send_notification(
    notification_data: SendNotificationRequest,
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Send notification for an alert.
    
    - **alert_id**: Alert to notify about
    - **recipients**: List of email addresses or user IDs
    - **notification_type**: email, sms, in_app, webhook
    """
    result = await notification_service.send_alert_notification(
        notification_data.alert_id,
        notification_data.recipients,
        notification_data.notification_type
    )
    
    return NotificationResponse(**result)


@router.get("/notifications", response_model=List[NotificationLogResponse])
async def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    notification_type: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """List notification log with filters"""
    db = get_db()
    
    offset = (page - 1) * limit
    
    query = db.table('wip_notification_log').select('*')
    
    if status:
        query = query.eq('status', status)
    if notification_type:
        query = query.eq('notification_type', notification_type)
    
    result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
    
    return [NotificationLogResponse(**log) for log in result.data]


@router.post("/check-alerts")
async def trigger_alert_check(
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Manually trigger alert checking.
    
    Checks all WIP metrics against configured thresholds and creates alerts.
    """
    db = get_db()
    
    try:
        db.rpc('check_wip_alerts').execute()
        return {"message": "Alert check completed successfully"}
    except Exception as e:
        raise Exception(f"Failed to check alerts: {str(e)}")
