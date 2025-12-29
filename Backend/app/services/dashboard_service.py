from datetime import datetime, timedelta
from typing import List
from decimal import Decimal
from app.database import get_db
from app.schemas.dashboard import (
    DashboardResponse,
    DashboardKPIs,
    KPICard,
    OrderSummary,
    ShortageItem,
    ReworkAlert,
    RecentActivity,
    QuickAction
)


class DashboardService:
    
    @staticmethod
    async def get_dashboard_data(user_id: str, user_roles: List[str]) -> DashboardResponse:
        """
        Get complete dashboard data for user.
        """
        db = get_db()
        
        # Calculate KPIs
        kpis = await DashboardService._calculate_kpis(db)
        
        # Get orders summary
        orders_summary = await DashboardService._get_orders_summary(db)
        
        # Get material shortages
        shortages = await DashboardService._get_material_shortages(db)
        
        # Get rework alerts
        rework_alerts = await DashboardService._get_rework_alerts(db)
        
        # Get recent activities
        recent_activities = await DashboardService._get_recent_activities(db)
        
        return DashboardResponse(
            kpis=kpis,
            orders_summary=orders_summary,
            shortages=shortages,
            rework_alerts=rework_alerts,
            recent_activities=recent_activities,
            last_updated=datetime.utcnow()
        )
    
    @staticmethod
    async def _calculate_kpis(db) -> DashboardKPIs:
        """
        Calculate all KPIs with REAL DATA.
        """
        # ========================================
        # 1. LIVE ORDERS KPI (REAL DATA!)
        # ========================================
        live_orders_count = 0
        
        try:
            # Count orders that are Planned or In Progress
            orders = db.table('production_orders').select('id', count='exact').in_(
                'status', ['Planned', 'In Progress']
            ).execute()
            live_orders_count = orders.count if hasattr(orders, 'count') else len(orders.data)
        except Exception:
            pass
        
        live_orders = KPICard(
            title="Live Orders",
            value=live_orders_count,
            unit="orders",
            trend="up" if live_orders_count > 0 else "stable",
            trend_percentage=0.0,
            icon="📦",
            color="blue"
        )
        
        # ========================================
        # 2. MATERIAL SHORTAGES KPI (REAL DATA from inventory_items!)
        # ========================================
        shortage_count = 0
        critical_count = 0
        low_count = 0
        
        try:
            # Get all active inventory items with low or critical status
            items = db.table('inventory_items').select(
                'id', 'material_name', 'quantity', 'reorder_level', 'status', 'allocated_quantity'
            ).eq('is_active', True).execute()
            
            for item in items.data:
                status = item.get('status', 'sufficient')
                quantity = Decimal(str(item.get('quantity', 0)))
                allocated_quantity = Decimal(str(item.get('allocated_quantity', 0)))
                free_qty = quantity - allocated_quantity
                reorder_level = Decimal(str(item.get('reorder_level', 0)))
                
                # Count items below reorder level
                if free_qty <= reorder_level:
                    shortage_count += 1
                    
                    if status == 'critical' or free_qty == 0:
                        critical_count += 1
                    elif status == 'low':
                        low_count += 1
                        
        except Exception:
            pass
        
        # Calculate trend percentage
        trend_pct = 0.0
        if shortage_count > 0:
            trend_pct = (critical_count / shortage_count * 100) if shortage_count > 0 else 0.0
        
        material_shortages = KPICard(
            title="Material Shortages",
            value=shortage_count,
            unit=f"{critical_count} critical" if critical_count > 0 else "items",
            trend="up" if critical_count > 0 else "stable",
            trend_percentage=trend_pct,
            icon="⚠️",
            color="red" if critical_count > 0 else ("yellow" if shortage_count > 0 else "green")
        )
        
        # ========================================
        # 3. REWORK ITEMS KPI
        # ========================================
        # TODO: Implement when qc_inspections table exists
        rework_items = KPICard(
            title="Items in Rework",
            value=0,
            unit="items",
            trend="stable",
            trend_percentage=0.0,
            icon="🔧",
            color="yellow"
        )
        
        # ========================================
        # 4. ON-TIME DELIVERY KPI (REAL DATA!)
        # ========================================
        otd_percentage_value = 0.0
        
        try:
            # Get completed orders from last 30 days
            from datetime import timedelta
            thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
            
            completed_orders = db.table('production_orders').select(
                'id', 'due_date', 'completion_date'
            ).eq('status', 'Completed').gte('completion_date', thirty_days_ago).execute()
            
            if completed_orders.data:
                on_time_count = 0
                total_count = len(completed_orders.data)
                
                for order in completed_orders.data:
                    due_date = datetime.fromisoformat(order['due_date']).date() if isinstance(order['due_date'], str) else order['due_date']
                    completed_at = datetime.fromisoformat(order['completion_date'].replace('Z', '+00:00')).date()
                    
                    if completed_at <= due_date:
                        on_time_count += 1
                
                otd_percentage_value = (on_time_count / total_count * 100) if total_count > 0 else 0
        except Exception:
            pass
        
        otd_percentage = KPICard(
            title="On-Time Delivery",
            value=round(otd_percentage_value, 1),
            unit="%",
            trend="up" if otd_percentage_value >= 90 else "down",
            trend_percentage=0.0,
            icon="✅",
            color="green" if otd_percentage_value >= 90 else "yellow" if otd_percentage_value >= 70 else "red"
        )
        
        # ========================================
        # 5. PRODUCTION EFFICIENCY KPI
        # ========================================
        # TODO: Implement when wip_metrics table exists
        production_efficiency = KPICard(
            title="Production Efficiency",
            value=0.0,
            unit="%",
            trend="stable",
            trend_percentage=0.0,
            icon="📊",
            color="blue"
        )
        
        return DashboardKPIs(
            live_orders=live_orders,
            material_shortages=material_shortages,
            rework_items=rework_items,
            otd_percentage=otd_percentage,
            production_efficiency=production_efficiency
        )     
        
    @staticmethod
    async def _get_orders_summary(db) -> OrderSummary:
        """
        Get orders breakdown by status (REAL DATA!).
        """
        try:
            orders = db.table('production_orders').select('status').execute()
            
            total = len(orders.data)
            planned = sum(1 for o in orders.data if o['status'] == 'Planned')
            in_progress = sum(1 for o in orders.data if o['status'] == 'In Progress')
            completed = sum(1 for o in orders.data if o['status'] == 'Completed')
            on_hold = sum(1 for o in orders.data if o['status'] == 'On Hold')
            
            return OrderSummary(
                total=total,
                planned=planned,
                in_progress=in_progress,
                completed=completed,
                on_hold=on_hold
            )
        except Exception:
            pass
            return OrderSummary(
                total=0,
                planned=0,
                in_progress=0,
                completed=0,
                on_hold=0
            )
    
    @staticmethod
    async def _get_material_shortages(db) -> List[ShortageItem]:
        """
        Get list of materials with shortages (REAL DATA!).
        """
        shortages = []
        
        try:
            # Get all active stock alerts
            alerts = db.table('stock_alerts').select('*').eq('is_active', True).execute()
            
            for alert in alerts.data:
                # Get current stock
                inv_query = db.table('inventory').select('available_qty', 'allocated_qty').eq(
                    'product_id', alert['product_id']
                )
                
                if alert.get('location_id'):
                    inv_query = inv_query.eq('location_id', alert['location_id'])
                
                inv_result = inv_query.execute()
                
                current_stock = Decimal('0')
                for inv in inv_result.data:
                    available = Decimal(str(inv['available_qty']))
                    allocated = Decimal(str(inv['allocated_qty']))
                    current_stock += (available - allocated)
                
                min_qty = Decimal(str(alert['min_qty']))
                
                if current_stock < min_qty:
                    # Get product details
                    product = db.table('products').select('code', 'name', 'unit').eq(
                        'id', alert['product_id']
                    ).execute()
                    
                    if product.data:
                        shortage_qty = min_qty - current_stock
                        
                        # Determine priority
                        if current_stock == 0:
                            priority = "high"
                        elif current_stock < (min_qty * Decimal('0.5')):
                            priority = "high"
                        else:
                            priority = "medium"
                        
                        shortages.append(ShortageItem(
                            item_id=alert['product_id'],
                            item_name=product.data[0]['name'],
                            current_stock=float(current_stock),
                            required_stock=float(min_qty),
                            shortage_qty=float(shortage_qty),
                            unit=product.data[0]['unit'],
                            priority=priority
                        ))
            
            # Sort by priority (high first) and shortage quantity
            shortages.sort(key=lambda x: (x.priority != "high", x.shortage_qty), reverse=True)
            
            # Return top 10
            return shortages[:10]
            
        except Exception:
            pass
            return []
    
    @staticmethod
    async def _get_rework_alerts(db) -> List[ReworkAlert]:
        """
        Get list of items in rework.
        """
        # TODO: Implement actual query when qc_inspections table exists
        return []
    
    @staticmethod
    async def _get_recent_activities(db) -> List[RecentActivity]:
        """
        Get recent system activities (REAL DATA!).
        """
        activities = []
        
        # ========================================
        # 1. Get recent inventory_items transactions (NEW!)
        # ========================================
        try:
            inv_items_trans = db.table('inventory_item_transactions').select(
                'id', 'transaction_type', 'inventory_item_id', 'quantity_change', 'reason', 'created_by', 'transaction_date'
            ).order('transaction_date', desc=True).limit(10).execute()
            
            for trans in inv_items_trans.data:
                # Get inventory item details
                item = db.table('inventory_items').select('material_code', 'material_name', 'unit').eq(
                    'id', trans['inventory_item_id']
                ).execute()
                
                if item.data:
                    material_name = item.data[0]['material_name']
                    material_code = item.data[0]['material_code']
                    unit = item.data[0]['unit']
                    
                    # Get user name
                    user_name = "System"
                    if trans.get('created_by'):
                        user = db.table('users').select('full_name', 'username').eq('id', trans['created_by']).execute()
                        if user.data:
                            user_name = user.data[0].get('full_name') or user.data[0].get('username')
                    
                    # Activity descriptions and icons
                    activity_map = {
                        'IN': ('📥', 'Inventory added'),
                        'OUT': ('📤', 'Inventory removed'),
                        'ADJUST': ('⚙️', 'Inventory updated'),
                        'ALLOCATE': ('🔒', 'Stock allocated'),
                        'RELEASE': ('🔓', 'Stock released')
                    }
                    
                    icon, action = activity_map.get(trans['transaction_type'], ('📦', 'Inventory transaction'))
                    
                    qty_change = trans['quantity_change']
                    sign = '+' if qty_change > 0 else ''
                    description = f"{action}: {material_code} - {material_name} ({sign}{qty_change} {unit})"
                    if trans.get('reason'):
                        description += f" - {trans['reason'][:50]}"
                    
                    activities.append(RecentActivity(
                        id=trans['id'],
                        activity_type=f"inventory_{trans['transaction_type'].lower()}",
                        description=description,
                        user_name=user_name,
                        timestamp=datetime.fromisoformat(trans['transaction_date'].replace('Z', '+00:00')).replace(tzinfo=None),
                        icon=icon
                    ))
        except Exception:
            pass
        
        # ========================================
        # 2. Get recent gate entries (NEW!)
        # ========================================
        try:
            gate_entries = db.table('gate_entries').select(
                'id', 'entry_number', 'entry_type', 'vendor', 'status', 'destination_department', 'created_by', 'created_at'
            ).order('created_at', desc=True).limit(10).execute()
            
            for entry in gate_entries.data:
                # Get user name
                user_name = "Security"
                if entry.get('created_by'):
                    user = db.table('users').select('full_name', 'username').eq('id', entry['created_by']).execute()
                    if user.data:
                        user_name = user.data[0].get('full_name') or user.data[0].get('username')
                
                # Activity descriptions and icons based on entry type and status
                entry_type_icons = {
                    'material': '📦',
                    'courier': '📮',
                    'visitor': '👤',
                    'jobwork_return': '🔄',
                    'subcontract_return': '↩️',
                    'delivery': '🚚',
                    'machine_spare': '⚙️'
                }
                
                status_actions = {
                    'arrived': 'arrived at gate',
                    'under_verification': 'under verification',
                    'accepted': 'accepted',
                    'rejected': 'rejected'
                }
                
                icon = entry_type_icons.get(entry['entry_type'], '🚪')
                action = status_actions.get(entry['status'], 'processed')
                
                # Format entry type for display
                entry_type_display = entry['entry_type'].replace('_', ' ').title()
                
                description = f"Gate Entry {action}: {entry['entry_number']} - {entry_type_display} from {entry['vendor']} → {entry['destination_department']}"
                
                activities.append(RecentActivity(
                    id=entry['id'],
                    activity_type=f"gate_entry_{entry['status']}",
                    description=description,
                    user_name=user_name,
                    timestamp=datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00')).replace(tzinfo=None),
                    icon=icon
                ))
        except Exception:
            pass
        
        # ========================================
        # 3. Get recent inventory transactions (existing)
        # ========================================
        try:
            # Get recent inventory transactions
            trans_result = db.table('inventory_transactions').select(
                'id', 'transaction_type', 'product_id', 'quantity', 'performed_by', 'created_at', 'notes'
            ).order('created_at', desc=True).limit(10).execute()
            
            for trans in trans_result.data:
                # Get product name
                product = db.table('products').select('code', 'name').eq('id', trans['product_id']).execute()
                product_name = product.data[0]['name'] if product.data else 'Unknown Product'
                product_code = product.data[0]['code'] if product.data else ''
                
                # Get user name
                user_name = "System"
                if trans.get('performed_by'):
                    user = db.table('users').select('full_name', 'username').eq('id', trans['performed_by']).execute()
                    if user.data:
                        user_name = user.data[0].get('full_name') or user.data[0].get('username')
                
                # Activity descriptions and icons
                activity_map = {
                    'TRANSFER': ('🔄', 'Material transferred'),
                    'GATE_IN': ('📥', 'Gate entry received'),
                    'GATE_OUT': ('📤', 'Gate exit processed'),
                    'ADJUSTMENT': ('⚙️', 'Stock adjusted'),
                    'ALLOCATION': ('🔒', 'Inventory allocated'),
                    'RELEASE': ('🔓', 'Allocation released'),
                    'PRODUCTION': ('🏭', 'Production consumed')
                }
                
                icon, action = activity_map.get(trans['transaction_type'], ('📦', 'Transaction'))
                
                description = f"{action}: {product_code} - {product_name} ({trans['quantity']} units)"
                if trans.get('notes'):
                    description += f" - {trans['notes'][:50]}"
                
                activities.append(RecentActivity(
                    id=trans['id'],
                    activity_type=trans['transaction_type'].lower(),
                    description=description,
                    user_name=user_name,
                    timestamp=datetime.fromisoformat(trans['created_at'].replace('Z', '+00:00')).replace(tzinfo=None),
                    icon=icon
                ))
        
        except Exception:
            pass
        
        # Also add recent user registrations if not many transactions
        if len(activities) < 10:
            try:
                users = db.table('users').select(
                    'id', 'username', 'full_name', 'created_at'
                ).order('created_at', desc=True).limit(5).execute()
                
                for user in users.data:
                    activities.append(RecentActivity(
                        id=user['id'],
                        activity_type="user_registered",
                        description=f"New user registered: {user.get('full_name') or user['username']}",
                        user_name=user['username'],
                        timestamp=datetime.fromisoformat(user['created_at'].replace('Z', '+00:00')).replace(tzinfo=None),
                        icon="👤"
                    ))
            except Exception:
                pass
        
        # Sort by timestamp and return top 10
        activities.sort(key=lambda x: x.timestamp, reverse=True)
        return activities[:10]
    
    @staticmethod
    async def get_quick_actions(user_roles: List[str]) -> List[QuickAction]:
        """
        Get quick actions based on user roles.
        """
        all_actions = [
            QuickAction(
                id="plan_materials",
                title="Plan Materials",
                description="Plan material requirements",
                route="/material-planning",
                icon="📋",
                roles=["Admin", "Planner"]
            ),
            QuickAction(
                id="create_bom",
                title="Create BOM",
                description="Create new Bill of Materials",
                route="/bom/create",
                icon="🔧",
                roles=["Admin", "Planner", "Engineer"]
            ),
            QuickAction(
                id="create_order",
                title="Create Order",
                description="Create production order",
                route="/orders/create",
                icon="📦",
                roles=["Admin", "Planner"]
            ),
            QuickAction(
                id="view_wip",
                title="WIP Board",
                description="View work in progress",
                route="/wip-board",
                icon="📊",
                roles=["Admin", "Planner", "Supervisor"]
            ),
            QuickAction(
                id="material_request",
                title="Material Request",
                description="Request materials",
                route="/material-request/create",
                icon="📝",
                roles=["Admin", "Operator", "Supervisor"]
            ),
            QuickAction(
                id="material_transfer",
                title="Material Transfer",
                description="Transfer materials",
                route="/material-transfer/create",
                icon="🔄",
                roles=["Admin", "Store Manager", "Supervisor"]
            ),
            QuickAction(
                id="qc_inspection",
                title="QC Check",
                description="Quality inspection",
                route="/qc/inspection",
                icon="✅",
                roles=["Admin", "QC Inspector"]
            ),
            QuickAction(
                id="gate_entry",
                title="Gate Entry",
                description="Log gate entry",
                route="/gate/entry",
                icon="🚪",
                roles=["Admin", "Security"]
            ),
            QuickAction(
                id="inventory",
                title="View Inventory",
                description="Check stock levels",
                route="/inventory",
                icon="📦",
                roles=["Admin", "Store Manager", "Planner"]
            ),
            QuickAction(
                id="adjust_stock",
                title="Adjust Stock",
                description="Stock count adjustment",
                route="/inventory/adjust",
                icon="⚙️",
                roles=["Admin", "Store Manager"]
            )
        ]
        
        # Filter actions based on user roles
        if "Admin" in user_roles:
            return all_actions
        
        filtered_actions = [
            action for action in all_actions
            if any(role in user_roles for role in action.roles)
        ]
        
        return filtered_actions


# Create singleton instance
dashboard_service = DashboardService()