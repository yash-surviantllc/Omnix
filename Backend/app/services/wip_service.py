from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from app.database import get_db
from app.schemas.wip import (
    WorkingOrderCreate, WorkingOrderUpdate, WorkingOrderResponse, WorkingOrderListItem,
    WIPStageMetricsResponse, WIPStageMetricsListItem, WIPDashboardResponse,
    WIPSummaryStats, BottleneckAlert, StagePerformanceHistoryResponse
)


class WIPService:
    """Service for WIP tracking and stage metrics"""
    
    # ============================================
    # WORKING ORDERS
    # ============================================
    
    @staticmethod
    async def create_working_order(
        order_data: WorkingOrderCreate,
        created_by: str
    ) -> WorkingOrderResponse:
        """Create a new working order"""
        db = get_db()
        
        # Generate work order number
        result = db.rpc('nextval', {'sequence_name': 'working_order_seq'}).execute()
        seq_num = result.data
        work_order_number = f"WO-{datetime.now().year}-{str(seq_num).zfill(4)}"
        
        # Insert working order
        insert_data = {
            **order_data.model_dump(),
            'work_order_number': work_order_number,
            'created_by': created_by
        }
        
        result = db.table('working_orders').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create working order")
        
        # Update WIP metrics
        await WIPService._update_stage_metrics()
        
        return WorkingOrderResponse(**result.data[0])
    
    @staticmethod
    async def list_working_orders(
        page: int = 1,
        limit: int = 50,
        status: Optional[str] = None,
        operation: Optional[str] = None,
        production_order_id: Optional[str] = None
    ) -> List[WorkingOrderListItem]:
        """List working orders with filters"""
        db = get_db()
        
        offset = (page - 1) * limit
        
        query = db.table('working_orders').select('*')
        
        if status:
            query = query.eq('status', status)
        
        if operation:
            query = query.eq('operation', operation)
        
        if production_order_id:
            query = query.eq('production_order_id', production_order_id)
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        return [WorkingOrderListItem(**wo) for wo in result.data]
    
    @staticmethod
    async def get_working_order_by_id(order_id: str) -> WorkingOrderResponse:
        """Get working order by ID"""
        db = get_db()
        
        result = db.table('working_orders').select('*').eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        return WorkingOrderResponse(**result.data[0])
    
    @staticmethod
    async def update_working_order(
        order_id: str,
        order_data: WorkingOrderUpdate,
        updated_by: str
    ) -> WorkingOrderResponse:
        """Update working order"""
        db = get_db()
        
        update_data = {k: v for k, v in order_data.model_dump(exclude_unset=True).items() if v is not None}
        
        if not update_data:
            return await WIPService.get_working_order_by_id(order_id)
        
        result = db.table('working_orders').update(update_data).eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        # Update WIP metrics if status or completion changed
        if 'status' in update_data or 'completed_qty' in update_data:
            await WIPService._update_stage_metrics()
        
        return WorkingOrderResponse(**result.data[0])
    
    @staticmethod
    async def delete_working_order(order_id: str) -> dict:
        """Delete/cancel working order"""
        db = get_db()
        
        result = db.table('working_orders').update({'status': 'Cancelled'}).eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        await WIPService._update_stage_metrics()
        
        return {"message": "Working order cancelled successfully"}
    
    # ============================================
    # WIP STAGE METRICS
    # ============================================
    
    @staticmethod
    async def get_wip_dashboard() -> WIPDashboardResponse:
        """Get complete WIP dashboard data"""
        db = get_db()
        
        # Get all active stage metrics
        result = db.table('wip_stage_metrics').select('*').eq('is_active', True).order('stage_sequence').execute()
        
        stages = [WIPStageMetricsListItem(**stage) for stage in result.data]
        
        # Calculate summary stats
        total_orders = sum(s.orders_count for s in stages)
        total_units = sum(s.units_count for s in stages)
        avg_cycle_time = Decimal(sum(float(s.avg_time_minutes) for s in stages) / len(stages)) if stages else Decimal('0')
        
        # Find bottleneck (delayed stage with highest utilization)
        bottleneck_stage = None
        delayed_stages = [s for s in stages if s.health_status == 'delayed']
        if delayed_stages:
            bottleneck_stage = max(delayed_stages, key=lambda s: s.utilization_percentage).stage_name
        
        return WIPDashboardResponse(
            stages=stages,
            total_orders=total_orders,
            total_units=total_units,
            avg_cycle_time=avg_cycle_time,
            bottleneck_stage=bottleneck_stage,
            last_updated=datetime.utcnow()
        )
    
    @staticmethod
    async def get_stage_metrics() -> List[WIPStageMetricsResponse]:
        """Get all WIP stage metrics"""
        db = get_db()
        
        result = db.table('wip_stage_metrics').select('*').eq('is_active', True).order('stage_sequence').execute()
        
        return [WIPStageMetricsResponse(**stage) for stage in result.data]
    
    @staticmethod
    async def get_bottleneck_alerts() -> List[BottleneckAlert]:
        """Get bottleneck alerts for delayed stages"""
        db = get_db()
        
        result = db.table('wip_stage_metrics').select('*').in_('health_status', ['warning', 'delayed']).order('utilization_percentage', desc=True).execute()
        
        alerts = []
        for stage in result.data:
            severity = 'critical' if stage['health_status'] == 'delayed' else 'warning'
            alerts.append(BottleneckAlert(
                stage_name=stage['stage_name'],
                utilization_percentage=stage['utilization_percentage'],
                avg_time_minutes=stage['avg_time_minutes'],
                target_time_minutes=stage['target_time_minutes'],
                orders_count=stage['orders_count'],
                units_count=stage['units_count'],
                severity=severity
            ))
        
        return alerts
    
    @staticmethod
    async def get_summary_stats() -> WIPSummaryStats:
        """Get WIP summary statistics"""
        db = get_db()
        
        result = db.table('wip_stage_metrics').select('*').eq('is_active', True).execute()
        
        stages = result.data
        total_orders = sum(s['orders_count'] for s in stages)
        total_units = sum(s['units_count'] for s in stages)
        avg_cycle_time = Decimal(sum(s['avg_time_minutes'] for s in stages) / len(stages)) if stages else Decimal('0')
        
        stages_healthy = len([s for s in stages if s['health_status'] == 'healthy'])
        stages_warning = len([s for s in stages if s['health_status'] == 'warning'])
        stages_delayed = len([s for s in stages if s['health_status'] == 'delayed'])
        
        bottleneck_stage = None
        delayed_stages = [s for s in stages if s['health_status'] == 'delayed']
        if delayed_stages:
            bottleneck_stage = max(delayed_stages, key=lambda s: s['utilization_percentage'])['stage_name']
        
        return WIPSummaryStats(
            total_orders=total_orders,
            total_units=total_units,
            avg_cycle_time_minutes=avg_cycle_time,
            bottleneck_stage=bottleneck_stage,
            stages_healthy=stages_healthy,
            stages_warning=stages_warning,
            stages_delayed=stages_delayed
        )
    
    @staticmethod
    async def get_stage_performance_history(
        stage_name: str,
        days: int = 7
    ) -> List[StagePerformanceHistoryResponse]:
        """Get historical performance for a stage"""
        db = get_db()
        
        result = db.table('stage_performance_history').select('*').eq('stage_name', stage_name).order('date', desc=True).limit(days).execute()
        
        return [StagePerformanceHistoryResponse(**record) for record in result.data]
    
    # ============================================
    # INTERNAL HELPERS
    # ============================================
    
    @staticmethod
    async def _update_stage_metrics():
        """Update WIP stage metrics by calling database function"""
        db = get_db()
        
        try:
            db.rpc('update_wip_stage_metrics').execute()
            
            # Trigger alert checking after metrics update
            try:
                db.rpc('check_wip_alerts').execute()
            except Exception:
                pass
                
        except Exception:
            pass


# Create singleton instance
wip_service = WIPService()
