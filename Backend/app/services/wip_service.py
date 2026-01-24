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
        
        # Generate work order number (prefer server-side sequence RPC)
        work_order_number = await WIPService._get_next_work_order_number(db)
        
        # Fetch product_id from purchase order if not provided
        product_id = order_data.product_id
        if not product_id:
            po_result = db.table('purchase_orders').select('product_id').eq('id', order_data.purchase_order_id).execute()
            if not po_result.data:
                raise Exception(f"Purchase Order {order_data.purchase_order_id} not found")
            product_id = po_result.data[0]['product_id']
        
        # Insert working order
        insert_data = {
            **order_data.model_dump(mode="json"),
            'work_order_number': work_order_number,
            'created_by': created_by,
            'product_id': product_id
        }
        
        # Schema 006 Enforcement: Do NOT rename columns.
        # target_qty is correct. purchase_order_id is correct.
        
        # Default shift (required constraint if not nullable, but checking duplicates)
        if 'shift' not in insert_data:
            insert_data['shift'] = 'Morning'
            
        # Ensure priority is Title Case if present
        if 'priority' in insert_data and insert_data['priority']:
             insert_data['priority'] = insert_data['priority'].title()
        
        result = db.table('work_orders').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create working order")
        
        # Update WIP metrics
        await WIPService._update_stage_metrics()

        row = WIPService._map_db_row(result.data[0])
        return WorkingOrderResponse(**row)

    @staticmethod
    async def _get_next_work_order_number(db) -> str:
        now = datetime.now()
        year = now.year

        try:
            seq_result = db.rpc('next_working_order_seq').execute()
            seq_num = int(seq_result.data) if seq_result.data is not None else None
        except Exception:
            seq_num = None

        if seq_num is None:
            latest = (
                db.table('work_orders')
                .select('work_order_number')
                .order('created_at', desc=True)
                .limit(1)
                .execute()
            )

            next_seq = 1
            if latest.data:
                last_number = latest.data[0].get('work_order_number') or ''
                parts = last_number.split('-')
                if len(parts) == 3 and parts[0] == 'WO':
                    try:
                        last_year = int(parts[1])
                        last_seq = int(parts[2])
                        next_seq = last_seq + 1 if last_year == year else 1
                    except ValueError:
                        next_seq = 1

            seq_num = next_seq

        return f"WO-{year}-{str(seq_num).zfill(4)}"
    
    @staticmethod
    async def list_working_orders(
        page: int = 1,
        limit: int = 50,
        status: Optional[str] = None,
        operation: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[WorkingOrderListItem]:
        """List working orders with filters"""
        db = get_db()
        
        offset = (page - 1) * limit
        
        query = db.table('work_orders').select('*')
        
        if status:
            query = query.eq('status', status)
        
        if operation:
            query = query.eq('operation', operation)
        
        if purchase_order_id:
            # Check both possible columns
            query = query.or_(f"purchase_order_id.eq.{purchase_order_id}")

        if search:
            # Search by work order number or operation (ILIKE match)
            # Note: exact UUID search handled via purchase_order_id filter usually
            query = query.or_(f"work_order_number.ilike.%{search}%,operation.ilike.%{search}%")
        
        # Standard select (no join to avoid errors)
        # query = query.select('*') # Removed to avoid duplicate select calls
        pass
        
        try:
            result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        except Exception as e:
            print(f"Error in list_working_orders query: {str(e)}")
            raise e
            
        if not result.data:
            return []
            
        work_orders = result.data
        
        # Batch Fetch Details
        po_ids = list(set([wo['purchase_order_id'] for wo in work_orders if wo.get('purchase_order_id')]))
        
        po_map = {} # id -> {order_number, product_id}
        product_ids = set()
        
        if po_ids:
            try:
                # Fetch POs
                po_query = db.table('purchase_orders').select('id, order_number, product_id').in_('id', po_ids)
                po_result = po_query.execute()
                for po in po_result.data:
                    po_map[po['id']] = po
                    if po.get('product_id'):
                        product_ids.add(po['product_id'])
            except Exception as e:
                print(f"Error batch fetching POs: {e}")
                
        # Also collect direct product_ids from work_orders if they exist
        for wo in work_orders:
            if wo.get('product_id'):
                product_ids.add(wo['product_id'])
                
        product_map = {} # id -> {name, code}
        if product_ids:
            try:
                prod_query = db.table('products').select('id, name, code').in_('id', list(product_ids))
                prod_result = prod_query.execute()
                for p in prod_result.data:
                    product_map[p['id']] = p
            except Exception as e:
                 print(f"Error batch fetching products: {e}")
        
        # Stitch
        items = []
        for wo in work_orders:
            base = WIPService._map_db_row(wo)
            
            # Resolve PO
            po = po_map.get(wo.get('purchase_order_id')) or {}
            base['purchase_order_number'] = po.get('order_number', 'Unknown')
            
            # Resolve Product (Prefer direct link, fallback to PO link)
            p_id = wo.get('product_id') or po.get('product_id')
            prod = product_map.get(p_id) or {}
            
            base['product_name'] = prod.get('name', 'Unknown')
            base['product_code'] = prod.get('code', '')
            
            items.append(WorkingOrderListItem(**base))
            
        return items
    
    @staticmethod
    async def get_working_order_by_id(order_id: str) -> WorkingOrderResponse:
        """Get working order by ID"""
        db = get_db()
        
        result = db.table('work_orders').select('*').eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        row = WIPService._map_db_row(result.data[0])
        return WorkingOrderResponse(**row)
    
    @staticmethod
    async def update_working_order(
        order_id: str,
        order_data: WorkingOrderUpdate,
        updated_by: str
    ) -> WorkingOrderResponse:
        """Update working order"""
        db = get_db()
        
        update_data = {
            k: v
            for k, v in order_data.model_dump(exclude_unset=True, mode="json").items()
            if v is not None
        }
        
        if not update_data:
            return await WIPService.get_working_order_by_id(order_id)
            
        # Schema 006 Enforcement: Do NOT rename columns.
        pass
        
        result = db.table('work_orders').update(update_data).eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        # Update WIP metrics if status or completion changed
        if 'status' in update_data or 'completed_qty' in update_data:
            await WIPService._update_stage_metrics()
        
        row = WIPService._map_db_row(result.data[0])
        return WorkingOrderResponse(**row)
    
    @staticmethod
    async def delete_working_order(order_id: str) -> dict:
        """Delete/cancel working order"""
        db = get_db()
        
        result = db.table('work_orders').update({'status': 'Cancelled'}).eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        await WIPService._update_stage_metrics()
        
        return {"message": "Working order cancelled successfully"}

    @staticmethod
    def _map_db_row(row: dict) -> dict:
        """Map database columns to schema fields"""
        if row:
            # Legacy mapping removed. DB schema now matches Pydantic schema.
            pass
        return row    
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
        delayed_stages = [s for s in stages if s.health_status == 'Delayed']
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
        
        result = db.table('wip_stage_metrics').select('*').in_('health_status', ['Warning', 'Delayed']).order('utilization_percentage', desc=True).execute()
        
        alerts = []
        for stage in result.data:
            severity = 'critical' if stage['health_status'] == 'Delayed' else 'warning'
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
        
        stages_healthy = len([s for s in stages if s['health_status'] == 'Healthy'])
        stages_warning = len([s for s in stages if s['health_status'] == 'Warning'])
        stages_delayed = len([s for s in stages if s['health_status'] == 'Delayed'])
        
        bottleneck_stage = None
        delayed_stages = [s for s in stages if s['health_status'] == 'Delayed']
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
