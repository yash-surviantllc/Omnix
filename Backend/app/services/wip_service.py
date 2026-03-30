from typing import List, Optional, Union
from datetime import datetime
from decimal import Decimal
from app.database import get_db
from app.core.exceptions import NotFoundException, ValidationException
from app.schemas.wip import (
    WorkingOrderCreate, WorkingOrderUpdate, WorkingOrderResponse, WorkingOrderListItem,
    UniqueWorkingOrderItem,
    WIPStageMetricsResponse, WIPStageMetricsListItem, WIPDashboardResponse,
    WIPSummaryStats, BottleneckAlert, StagePerformanceHistoryResponse
)
from app.services.bom_service import BOMService
from app.services.inventory_service import InventoryService
from app.services.websocket_manager import manager
from app.services.dashboard_service import dashboard_service



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
        
        # 1. Resolve Product ID
        product_id = order_data.product_id
        if not product_id:
            po_result = db.table('purchase_orders').select('product_id').eq('id', order_data.purchase_order_id).execute()
            if not po_result.data:
                raise Exception(f"Purchase Order {order_data.purchase_order_id} not found")
            product_id = po_result.data[0]['product_id']

        # 2. Stage Resolution (NOW BEFORE INSERT)
        from app.services.stage_service import StageService
        import logging
        
        # Setup debug logger
        logging.basicConfig(filename='wip_debug.log', level=logging.INFO)
        logger = logging.getLogger('wip_debug')
        
        # Resolve Config
        prod_res = db.table('products').select('code, wip_config_id').eq('id', product_id).single().execute()
        sku = prod_res.data['code'] if prod_res.data else None
        product_config_id = prod_res.data.get('wip_config_id') if prod_res.data else None
        
        config_id = getattr(order_data, 'config_id', None)
        
        # If config is default or missing, try to use product's preferred config
        if (not config_id or config_id == 'default') and product_config_id:
             config_id = product_config_id
             
        if not config_id:
            config_id = await StageService.resolve_config_for_entity(sku=sku, wo_no=work_order_number)
        
        # Get Stages - with fallback to default
        stages = await StageService.list_stages(config_id=config_id)
        
        # If selected config has no stages, fallback to 'default' config
        if not stages and config_id != 'default':
            logger.warning(f"Config '{config_id}' has no stages. Falling back to 'default' config.")
            config_id = 'default'
            stages = await StageService.list_stages(config_id='default')
        
        # Final validation - even default must have stages
        if not stages:
            raise ValidationException(
                detail=f"No stages configured in 'default' config. Please configure at least one stage in WIP Settings before creating work orders."
            )
        
        first_op_name = stages[0].name

        # 3. Insert working order
        insert_data = {
            **order_data.model_dump(mode="json", exclude={'operation'}),
            'work_order_number': work_order_number,
            'created_by': created_by,
            'product_id': product_id,
            'operation': first_op_name, # CRITICAL: Satisfy NOT NULL constraint
            'config_id': config_id # Store the resolved config_id
        }
        
        # Normalize priority to title case
        if 'priority' in insert_data and insert_data['priority']:
            insert_data['priority'] = insert_data['priority'].title()
            # Map 'Normal' to 'Medium' for consistency
            if insert_data['priority'] == 'Normal':
                insert_data['priority'] = 'Medium'
        
        result = db.table('work_orders').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create working order")

        wo_id = result.data[0]['id']
        logger.info(f"WO Created: {work_order_number} (ID: {wo_id}) | SKU: {sku} | Config: {config_id} | Operation: {first_op_name}")
        
        # 4. Inventory Allocation (Real-time) - PRODUCTION-SAFE VERSION
        try:
            await WIPService._allocate_inventory(wo_id, product_id, order_data.target_qty, work_order_number)
        except ValidationException as e:
            # create_working_order will be called from an API where ValidationException is caught
            raise e
        except Exception as e:
            logger.error(f"Allocation unexpected failure: {e}")
            db.table('work_orders').delete().eq('id', wo_id).execute()
            raise ValidationException(detail=f"Unexpected error during allocation: {str(e)}")
        
        
        # 5. Insert Operations
        try:
            ops_data = []
            for stage in stages:
                ops_data.append({
                    'work_order_id': wo_id,
                    'operation_name': stage.name,
                    'sequence_number': stage.sequence_number,
                    'status': 'Pending',
                    'workstation_id': None 
                })
            
            if ops_data:
                db.table('work_order_operations').insert(ops_data).execute()
                logger.info(f"Inserted {len(ops_data)} operations for WO {work_order_number}")
            else:
                 logger.warning(f"No stages found for config {config_id}")

        except Exception as e:
            logger.error(f"Error enforcing stage config: {e}")
        
        # 6. Initialize order_stage_tracking - place in first stage
        try:
            if stages:
                first_stage = stages[0]
                db.table('order_stage_tracking').insert({
                    'order_id': wo_id,
                    'current_stage_id': first_stage.id,
                    'quantity_in_stage': float(order_data.target_qty),
                    'entered_stage_at': datetime.utcnow().isoformat()
                }).execute()
                logger.info(f"Initialized order_stage_tracking for WO {work_order_number} in stage {first_stage.name}")
        except Exception as e:
            logger.error(f"Error initializing order_stage_tracking: {e}")
        
        # 7. Update WIP metrics
        await WIPService._update_stage_metrics()

        row = WIPService._map_db_row(result.data[0])
        return WorkingOrderResponse(**row)

    @staticmethod
    async def start_operation(
        work_order_number: str,
        operation_name: str,
        user_id: str
    ) -> WorkingOrderResponse:
        """
        Start a new operation stage for a working order.
        Creates a new row in work_orders table if it doesn't exist,
        copying details from the initial/main record.
        """
        db = get_db()
        
        # 1. Find the parent/main work order to copy details from
        # We look for ANY record with this WO number to get the static details
        parent_res = db.table('work_orders').select('*').eq('work_order_number', work_order_number).limit(1).execute()
        if not parent_res.data:
            raise Exception(f"Work Order {work_order_number} not found")
            
        parent = parent_res.data[0]
        
        # 2. Find the operation record in work_order_operations
        # We need the parent WO ID first
        
        op_res = (
            db.table('work_order_operations')
            .select('id, status')
            .eq('work_order_id', parent['id'])
            .eq('operation_name', operation_name)
            .execute()
        )
        
        if not op_res.data:
            raise ValidationException(detail=f"Operation '{operation_name}' not found for work order {work_order_number}")
        
        op_record = op_res.data[0]
        
        # 3. Validate current status (can start if Pending, Planned, Released, or On Hold)
        current_status = op_record.get('status', '').lower()
        valid_start_statuses = ['pending', 'planned', 'released', 'on hold']
        if current_status not in valid_start_statuses:
            raise ValidationException(detail=f"Operation '{operation_name}' cannot be started (current status: {op_record.get('status')})")
        
        # 4. Update status to In Progress
        db.table('work_order_operations').update({
            'status': 'In Progress',
            'actual_start': datetime.utcnow().isoformat()
        }).eq('id', op_record['id']).execute()

        # 5. Update metrics & Broadcast
        await WIPService._update_stage_metrics()
        await dashboard_service.broadcast_orders_update()
        await dashboard_service.broadcast_kpis_update()
        
        # Return the updated operation as a WO object (for frontend compatibility)
        # We need to construct the full object
        row = WIPService._map_db_row(parent)
        row['operation'] = operation_name
        row['status'] = 'In Progress'
        row['id'] = op_record['id'] # Important: Return Op ID
        
        return WorkingOrderResponse(**row)

    @staticmethod
    async def pause_operation(
        work_order_number: str,
        operation_name: str,
        user_id: str
    ) -> WorkingOrderResponse:
        """
        Pause an in-progress operation.
        Uses work order number + operation name for robust identification.
        """
        db = get_db()
        
        # 1. Find the parent work order
        parent_res = db.table('work_orders').select('*').eq('work_order_number', work_order_number).limit(1).execute()
        if not parent_res.data:
            raise ValidationException(detail=f"Work Order {work_order_number} not found")
        
        parent = parent_res.data[0]
        
        # 2. Find the operation in work_order_operations
        op_res = (
            db.table('work_order_operations')
            .select('id, status')
            .eq('work_order_id', parent['id'])
            .eq('operation_name', operation_name)
            .execute()
        )
        
        if not op_res.data:
            raise ValidationException(detail=f"Operation '{operation_name}' not found for work order {work_order_number}")
        
        op_record = op_res.data[0]
        
        # 3. Validate current status
        current_status = op_record.get('status', '').lower()
        if current_status not in ['in progress', 'in-progress']:
            raise ValidationException(detail=f"Operation '{operation_name}' is not in progress (current status: {op_record.get('status')})")
        
        # 4. Update to On Hold
        db.table('work_order_operations').update({
            'status': 'On Hold'
        }).eq('id', op_record['id']).execute()
        
        # 5. Update metrics & Broadcast
        await WIPService._update_stage_metrics()
        await dashboard_service.broadcast_orders_update()
        await dashboard_service.broadcast_kpis_update()
        
        # 6. Return response
        row = WIPService._map_db_row(parent)
        row['operation'] = operation_name
        row['status'] = 'On Hold'
        row['id'] = op_record['id']
        
        return WorkingOrderResponse(**row)

    @staticmethod
    async def complete_operation(
        work_order_number: str,
        operation_name: str,
        user_id: str,
        completed_qty: Optional[float] = None
    ) -> WorkingOrderResponse:
        """
        Complete an in-progress operation.
        Updates status, records end time, consumes materials, and produces FG if final stage.
        """
        db = get_db()
        
        # 1. Find the parent work order
        parent_res = db.table('work_orders').select('*').eq('work_order_number', work_order_number).limit(1).execute()
        if not parent_res.data:
            raise ValidationException(detail=f"Work Order {work_order_number} not found")
        
        parent = parent_res.data[0]
        
        # 2. Find the operation in work_order_operations
        op_res = (
            db.table('work_order_operations')
            .select('*')
            .eq('work_order_id', parent['id'])
            .order('sequence_number')
            .execute()
        )
        
        if not op_res.data:
            raise ValidationException(detail=f"Operations not found for work order {work_order_number}")
        
        ops = op_res.data
        op_record = next((op for op in ops if op['operation_name'] == operation_name), None)
        
        if not op_record:
            raise ValidationException(detail=f"Operation '{operation_name}' not found for work order {work_order_number}")
        
        # 3. Validate current status
        current_status = op_record.get('status', '').lower()
        if current_status not in ['in progress', 'in-progress']:
            raise ValidationException(detail=f"Operation '{operation_name}' is not in progress (current status: {op_record.get('status')})")
        
        # 4. Use provided qty or default to work order's target qty
        final_qty = Decimal(str(completed_qty if completed_qty is not None else parent.get('target_qty', 0)))
        
        # 5. Consume Materials (Proportional to final_qty)
        try:
            await WIPService._consume_materials(parent['id'], parent['product_id'], final_qty)
        except Exception as e:
            import logging
            logging.error(f"Material consumption failed for WO {work_order_number}: {e}")
            
        # 6. Check if this is the final operation
        is_final = ops[-1]['operation_name'] == operation_name
        if is_final:
            try:
                await InventoryService.produce_stock(parent['product_id'], final_qty)
                # Also update main work order status
                db.table('work_orders').update({
                    'status': 'Completed',
                    'completed_qty': float(final_qty),
                    'actual_end': datetime.utcnow().isoformat()
                }).eq('id', parent['id']).execute()
            except Exception as e:
                import logging
                logging.error(f"FG production failed for WO {work_order_number}: {e}")

        # 7. Update Operation to Completed
        db.table('work_order_operations').update({
            'status': 'Completed',
            'actual_end': datetime.utcnow().isoformat(),
            'completed_qty': float(final_qty)
        }).eq('id', op_record['id']).execute()
        
        # 8. Update metrics & Broadcast
        await WIPService._update_stage_metrics()
        await dashboard_service.broadcast_orders_update()
        await dashboard_service.broadcast_kpis_update()
        
        # 9. Return response
        row = WIPService._map_db_row(parent)
        row['operation'] = operation_name
        row['status'] = 'Completed'
        row['id'] = op_record['id']
        row['completed_qty'] = float(final_qty)
        
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
            
        # KEY FIX: Check if this ID belongs to an Operation (work_order_operations)
        op_check = db.table('work_order_operations').select('work_order_id, operation_name').eq('id', order_id).execute()
        
        if op_check.data:
            # It's an Operation ID
            op_data = op_check.data[0]
            op_update = {}
            if 'status' in update_data:
                op_update['status'] = update_data['status']
            if 'actual_start' in update_data:
                op_update['actual_start'] = update_data['actual_start']
            if 'actual_end' in update_data:
                op_update['actual_end'] = update_data['actual_end']
            if 'completed_qty' in update_data:
                op_update['completed_qty'] = update_data['completed_qty']
            
            if op_update:
                # If marking as completed via direct update, trigger consumption/production
                if op_update.get('status') == 'Completed':
                    # We need the parent wo for context
                    parent = await WIPService.get_working_order_by_id(op_data['work_order_id'])
                    # Use provided qty or parent target
                    c_qty = Decimal(str(op_update.get('completed_qty') or parent.target_qty))
                    
                    # 1. Consume Materials
                    await WIPService._consume_materials(parent.id, parent.product_id, c_qty)
                    
                    # 2. Check if final
                    ops_res = db.table('work_order_operations').select('operation_name').eq('work_order_id', parent.id).order('sequence_number').execute()
                    if ops_res.data and ops_res.data[-1]['operation_name'] == op_data['operation_name']:
                         await InventoryService.produce_stock(parent.product_id, c_qty)
                         # Update header too
                         db.table('work_orders').update({
                             'status': 'Completed',
                             'completed_qty': float(c_qty),
                             'actual_end': datetime.utcnow().isoformat()
                         }).eq('id', parent.id).execute()

                op_res = db.table('work_order_operations').update(op_update).eq('id', order_id).execute()
                if not op_res.data:
                    raise Exception("Failed to update operation")

            # Return the full WO structure
            parent_wo = await WIPService.get_working_order_by_id(op_data['work_order_id'])
            parent_wo.id = order_id 
            parent_wo.operation = op_data['operation_name']
            parent_wo.status = update_data.get('status', parent_wo.status)
            
            await WIPService._update_stage_metrics()
            await dashboard_service.broadcast_orders_update()
            await dashboard_service.broadcast_kpis_update()
            
            return parent_wo

        # Fallback: Update main Work Order (Header update)
        # Handle header-level completion
        if update_data.get('status') == 'Completed':
             # Fetch current state
             curr = db.table('work_orders').select('*').eq('id', order_id).single().execute()
             if curr.data:
                 c_qty = Decimal(str(update_data.get('completed_qty') or curr.data.get('completed_qty') or curr.data.get('target_qty', 0)))
                 # Consume all remaining allocated materials
                 await WIPService._consume_materials(order_id, curr.data['product_id'], c_qty)
                 # Produce FG
                 await InventoryService.produce_stock(curr.data['product_id'], c_qty)
                 # Mark all operations as completed? 
                 # Usually if you mark header as completed, it's a shortcut
                 db.table('work_order_operations').update({
                     'status': 'Completed',
                     'actual_end': datetime.utcnow().isoformat(),
                     'completed_qty': float(c_qty)
                 }).eq('work_order_id', order_id).neq('status', 'Completed').execute()
                 
                 if 'completed_qty' not in update_data:
                     update_data['completed_qty'] = float(c_qty)

        result = db.table('work_orders').update(update_data).eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        if 'status' in update_data or 'completed_qty' in update_data:
            await WIPService._update_stage_metrics()
            await dashboard_service.broadcast_orders_update()
            await dashboard_service.broadcast_kpis_update()
        
        row = WIPService._map_db_row(result.data[0])
        return WorkingOrderResponse(**row)

    @staticmethod
    async def _allocate_inventory(wo_id: str, product_id: str, target_qty: Decimal, work_order_number: str):
        """Internal helper to handle multi-location inventory allocation for a WO"""
        db = get_db()
        import logging
        logger = logging.getLogger('wip_debug')

        # Calculate Requirements
        try:
            requirements = await BOMService.calculate_material_requirements(product_id, target_qty)
        except Exception as e:
            logger.error(f"BOM calculation failed: {e}")
            db.table('work_orders').delete().eq('id', wo_id).execute()
            raise ValidationException(detail=f"Failed to calculate material requirements: {str(e)}")
        
        if not requirements:
            logger.info(f"Inventory: No BOM materials found for product {product_id}")
            return
            
        # Fetch all valid locations (store, warehouse, production_line)
        # Exclude only 'scrap' and 'quality' locations from material allocation
        try:
            valid_locs = db.table('locations').select('id').in_(
                'type', ['store', 'warehouse', 'production_line']
            ).eq('is_active', True).execute()
            store_ids = [loc['id'] for loc in valid_locs.data] if valid_locs.data else []
            
            if not store_ids:
                logger.warning("No valid storage locations found. Auto-creating MAIN-STORE.")
                new_loc = db.table('locations').insert({
                    'code': 'MAIN-STORE',
                    'name': 'Main Warehouse',
                    'type': 'store',
                    'is_active': True
                }).execute()
                if new_loc.data:
                    store_ids = [new_loc.data[0]['id']]
        except Exception as e:
            logger.error(f"Error fetching storage locations: {e}")
            raise ValidationException(detail="System error: Could not verify storage locations.")

        # PHASE 1: VALIDATION - Check all materials before allocating any
        validation_errors = []
        allocation_plan = []
        
        for req in requirements:
            material_name = f"Material {req.material_id}"
            try:
                prod_res = db.table('products').select('name').eq('id', req.material_id).single().execute()
                if prod_res.data: material_name = prod_res.data['name']
            except: pass
            
            # Query inventory in ANY valid store
            inv_res = db.table('inventory').select('id, location_id, allocated_qty, available_qty').eq(
                'product_id', req.material_id
            ).in_('location_id', store_ids).execute()
            
            total_free_everywhere = Decimal('0')
            potential_sources = []
            
            if inv_res.data:
                for r in inv_res.data:
                    free = Decimal(str(r['available_qty'])) - Decimal(str(r['allocated_qty']))
                    if free > 0:
                        total_free_everywhere += free
                        potential_sources.append({'record': r, 'free': free})
            
            # FALLBACK: Check inventory_items if inventory table is empty
            if not inv_res.data or total_free_everywhere == 0:
                try:
                    prod_res = db.table('products').select('code, name').eq('id', req.material_id).execute()
                    if prod_res.data:
                        material_code = prod_res.data[0]['code']
                        product_name = prod_res.data[0]['name']
                        
                        # Try exact code match first
                        items_res = db.table('inventory_items').select('quantity').eq('material_code', material_code).execute()
                        if items_res.data:
                            for item in items_res.data:
                                item_qty = Decimal(str(item.get('quantity', 0)))
                                total_free_everywhere += item_qty
                            logger.info(f"Using inventory_items EXACT match for {material_name}: {total_free_everywhere}")
                        else:
                            # Fuzzy match by name if exact code fails
                            name_res = db.table('inventory_items').select('quantity').ilike('material_name', f'%{product_name}%').execute()
                            if name_res.data:
                                for item in name_res.data:
                                    item_qty = Decimal(str(item.get('quantity', 0)))
                                    total_free_everywhere += item_qty
                                logger.info(f"Using inventory_items NAME match for {material_name}: {total_free_everywhere}")
                except Exception as e:
                    logger.error(f"Error checking inventory_items fallback: {e}")
            
            if total_free_everywhere < req.required_quantity:
                 validation_errors.append(
                    f"{material_name}: Insufficient stock (need {req.required_quantity} {req.unit}, found {total_free_everywhere} in stores)."
                )
                 continue
            
            # Sort: Largest stocks first
            potential_sources.sort(key=lambda x: x['free'], reverse=True)
            
            sources_to_use = []
            remaining_needed = req.required_quantity
            for src in potential_sources:
                if remaining_needed <= 0: break
                take = min(remaining_needed, src['free'])
                sources_to_use.append({
                    'record_id': src['record']['id'],
                    'amount': take,
                    'current_allocated': Decimal(str(src['record']['allocated_qty']))
                })
                remaining_needed -= take
            
            # Note: If inventory came from inventory_items (no potential_sources), 
            # we skip allocation updates since inventory_items doesn't support allocation tracking
            allocation_plan.append({
                'material_id': req.material_id,
                'material_name': material_name,
                'unit': req.unit,
                'sources': sources_to_use,
                'total_req': req.required_quantity,
                'from_items_table': len(potential_sources) == 0  # Flag for inventory_items source
            })
        
        if validation_errors:
            db.table('work_orders').delete().eq('id', wo_id).execute()
            error_msg = f"Allocation failed:\n" + "\n".join(f"- {err}" for err in validation_errors)
            raise ValidationException(detail=error_msg)
        
        # PHASE 2: ALLOCATION
        allocated_history = []
        wo_materials_data = []
        
        try:
            for plan in allocation_plan:
                total_material_allocated = Decimal('0')
                
                # Skip allocation updates if material is from inventory_items (no allocation tracking)
                if plan.get('from_items_table', False):
                    logger.info(f"Skipping allocation update for {plan['material_name']} (sourced from inventory_items)")
                    total_material_allocated = plan['total_req']
                else:
                    # Normal allocation from inventory table
                    for src in plan['sources']:
                        db.table('inventory').update({
                            'allocated_qty': float(src['current_allocated'] + src['amount']),
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', src['record_id']).execute()

                        allocated_history.append({'id': src['record_id'], 'amount': src['amount']})
                        total_material_allocated += src['amount']
                
                wo_materials_data.append({
                    'work_order_id': wo_id,
                    'material_id': plan['material_id'],
                    'required_qty': float(plan['total_req']),
                    'allocated_qty': float(total_material_allocated),
                    'unit': plan['unit'],
                    'status': 'Allocated'
                })
            
            if wo_materials_data:
                db.table('work_order_materials').insert(wo_materials_data).execute()
            
            await manager.broadcast({"type": "inventory_update"})
            await dashboard_service.broadcast_shortages_update()

        except Exception as e:
            # ROLLBACK
            for alloc in allocated_history:
                try:
                    inv = db.table('inventory').select('allocated_qty').eq('id', alloc['id']).single().execute()
                    if inv.data:
                        val = float(max(Decimal(str(inv.data['allocated_qty'])) - alloc['amount'], Decimal('0')))
                        db.table('inventory').update({'allocated_qty': val}).eq('id', alloc['id']).execute()
                except: pass
            
            db.table('work_orders').delete().eq('id', wo_id).execute()
            raise Exception(f"Allocation committed failure: {e}")

    @staticmethod
    async def _consume_materials(wo_id: str, product_id: str, quantity: Decimal):
        """Consume materials proportional to the quantity of product completed"""
        # 1. Calculate requirements for this partial quantity
        requirements = await BOMService.calculate_material_requirements(product_id, quantity)
        
        if not requirements:
            return
            
        # 2. Consume from allocated stock
        for req in requirements:
            try:
                await InventoryService.consume_allocated_stock(req.material_id, req.required_quantity)
                
                # 3. Update work_order_materials tracking (optional but nice)
                # We need to find the record for this WO and material
                db = get_db()
                mat_res = db.table('work_order_materials').select('*').eq('work_order_id', wo_id).eq('material_id', req.material_id).execute()
                if mat_res.data:
                    current_consumed = Decimal(str(mat_res.data[0].get('consumed_qty', 0)))
                    new_consumed = current_consumed + req.required_quantity
                    db.table('work_order_materials').update({
                        'consumed_qty': float(new_consumed),
                        'updated_at': datetime.utcnow().isoformat()
                    }).eq('id', mat_res.data[0]['id']).execute()
            except Exception as e:
                import logging
                logging.error(f"Error consuming {req.material_id} for WO {wo_id}: {e}")
    
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
        status: Optional[Union[str, List[str]]] = None,
        operation: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[WorkingOrderListItem]:
        """List working orders with filters"""
        db = get_db()
        
        offset = (page - 1) * limit
        
        query = db.table('work_orders').select('*')
        
        if status:
            if isinstance(status, list):
                query = query.in_('status', status)
            else:
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
            
        # Deduplicate work_orders by ID just in case
        work_orders_raw = result.data
        unique_wos = {wo['id']: wo for wo in work_orders_raw}.values()
        work_orders = list(unique_wos)
        
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
        # Fetch Routing Rules for dynamic config resolution
        from app.services.stage_service import StageService
        assignments = await StageService.get_assignments()
        sku_rules = assignments.get('sku_assignments', {})
        wo_rules = assignments.get('wo_assignments', {})

        items = []
        for wo in work_orders:
            base = WIPService._map_db_row(wo)
            
            # Resolve PO
            po = po_map.get(wo.get('purchase_order_id')) or {}
            base['purchase_order_number'] = po.get('order_number', 'Unknown')
            
            # Resolve Product
            p_id = wo.get('product_id') or po.get('product_id')
            prod = product_map.get(p_id) or {}
            
            base['product_name'] = prod.get('name', 'Unknown')
            base['product_code'] = prod.get('code', '')

            # Restore Dynamic Config Resolution
            wo_no = wo.get('work_order_number')
            sku = base['product_code']
            
            resolved_config = 'default'
            if wo_no and wo_no.strip() in wo_rules:
                resolved_config = wo_rules[wo_no.strip()]
            elif sku and sku.strip() in sku_rules:
                resolved_config = sku_rules[sku.strip()]
            
            base['config_id'] = resolved_config

            # Batch fetch operations will be done below
            items.append(base)  # Collect base items first

        # OPTIMIZATION: Batch fetch ALL operations for all work orders at once (fixes N+1 problem)
        wo_ids = [wo['id'] for wo in work_orders]
        ops_by_wo = {}
        
        if wo_ids:
            try:
                all_ops_query = db.table('work_order_operations').select('*').in_('work_order_id', wo_ids).execute()
                for op in all_ops_query.data:
                    wo_id = op['work_order_id']
                    if wo_id not in ops_by_wo:
                        ops_by_wo[wo_id] = []
                    ops_by_wo[wo_id].append(op)
            except Exception as e:
                print(f"Error batch fetching operations: {e}")

        # OPTIMIZATION 2: Batch fetch ALL transferred quantities for all orders
        # Aggregated by Production Run (Purchase Order) + Stage
        transfers_by_po_stage = {}
        target_pos = list(set([wo.get('purchase_order_id') for wo in work_orders if wo.get('purchase_order_id')]))
        stage_name_to_id = {} # For mapping operation_name back to transfers
        
        if target_pos:
            try:
                # 1. Map all WIP stages (name -> id)
                all_stages = db.table('wip_stages').select('id, name').execute()
                stage_name_to_id = {s['name']: s['id'] for s in all_stages.data}

                # 2. Get all work order IDs for these POs
                related_wo_res = db.table('work_orders').select('id, purchase_order_id').in_('purchase_order_id', target_pos).execute()
                all_related_wo_ids = [row['id'] for row in related_wo_res.data]
                wo_to_po = {row['id']: row['purchase_order_id'] for row in related_wo_res.data}
                
                # 3. Fetch and aggregate transfers
                if all_related_wo_ids:
                    all_transfers = db.table('wip_stage_transfers').select('order_id, from_stage_id, quantity').in_('order_id', all_related_wo_ids).execute()
                    
                    for t in all_transfers.data:
                        po_id = wo_to_po.get(t['order_id'])
                        stage_id = t.get('from_stage_id')
                        if po_id and stage_id:
                            key = f"{po_id}:{stage_id}"
                            transfers_by_po_stage[key] = transfers_by_po_stage.get(key, 0) + float(t['quantity'])
            except Exception as e:
                print(f"Error batch fetching transfers: {e}")

        
        # Now process items with their operations
        final_items = []
        for idx, wo in enumerate(work_orders):
            base = items[idx]
            ops = ops_by_wo.get(wo['id'], [])
            
            if ops:
                # Filter by operation/status if needed (simple client-side filter here for robustness)
                filtered_ops = ops
                if operation:
                   filtered_ops = [op for op in filtered_ops if op['operation_name'] == operation]
                
                if not filtered_ops and operation:
                   continue # Skip entire WO if no matching operation found

                for op in filtered_ops:
                    item = base.copy()
                    # Override with specific operation details
                    item['id'] = op['id'] # Use Operation ID as the main ID for frontend
                    item['operation'] = op['operation_name']
                    item['status'] = op['status']
                    item['workstation_id'] = op['workstation_id']
                    
                    # Map operation specific timestamps if available
                    item['scheduled_start'] = op.get('planned_start') or item['scheduled_start']
                    item['scheduled_end'] = op.get('planned_end') or item['scheduled_end']
                    item['actual_start'] = op.get('actual_start')
                    item['actual_end'] = op.get('actual_end')
                    
                    # Fix: Map completed quantity from operation
                    item['completed_qty'] = op.get('completed_qty', 0)
                    item['rejected_qty'] = op.get('rejected_qty', 0)

                    # Fix: Map transferred quantity from aggregated batch
                    op_stage_id = stage_name_to_id.get(op['operation_name'])
                    po_id = item.get('purchase_order_id')
                    transferred_qty = 0
                    if po_id and op_stage_id:
                        transferred_qty = transfers_by_po_stage.get(f"{po_id}:{op_stage_id}", 0)
                    item['transferred_qty'] = transferred_qty

                    final_items.append(WorkingOrderListItem(**item))

            else:
                 # Legacy fallback: Return WO as is (single stage)
                 # Only if it matches operation filter
                 if operation and wo['operation'] != operation:
                     continue
                 final_items.append(WorkingOrderListItem(**base))

        return final_items
    
    
    @staticmethod
    async def list_unique_working_orders(
        status: Optional[List[str]] = None,
        purchase_order_id: Optional[str] = None
    ) -> List[UniqueWorkingOrderItem]:
        """
        Get unique work orders (one per work_order_number).
        Used for dropdowns where we need to select a work order, not an operation.
        """
        db = get_db()
        
        query = db.table('work_orders').select('id, work_order_number, product_id, purchase_order_id, status, target_qty, completed_qty, created_at')
        
        if status:
            query = query.in_('status', status)
            
        if purchase_order_id:
            query = query.eq('purchase_order_id', purchase_order_id)
        
        result = query.order('created_at', desc=True).execute()
        
        if not result.data:
            return []
        
        # Deduplicate by work_order_number (take first occurrence)
        seen = set()
        unique_orders = []
        
        for wo in result.data:
            if wo['work_order_number'] not in seen:
                seen.add(wo['work_order_number'])
                unique_orders.append(wo)
        
        # Fetch product names
        product_ids = list(set([wo['product_id'] for wo in unique_orders if wo.get('product_id')]))
        product_map = {}
        
        if product_ids:
            products = db.table('products').select('id, name').in_('id', product_ids).execute()
            product_map = {p['id']: p['name'] for p in products.data}
        
        return [
            UniqueWorkingOrderItem(
                id=wo['id'],
                work_order_number=wo['work_order_number'],
                product_name=product_map.get(wo.get('product_id'), 'Unknown Product'),
                status=wo['status'],
                target_qty=wo.get('target_qty', 0),
                completed_qty=wo.get('completed_qty', 0),
                product_id=wo.get('product_id'),
                purchase_order_id=wo.get('purchase_order_id')
            )
            for wo in unique_orders
        ]
    
    
    @staticmethod
    async def get_work_order_stages(work_order_number: str) -> List['WIPStageResponse']:
        """
        Get configured WIP stages for a specific work order.
        Returns only stages that have operations defined for this work order.
        """
        from app.schemas.material_transfer import WIPStageResponse
        import logging
        logger = logging.getLogger(__name__)
        
        db = get_db()
        
        # Get work order
        wo_result = db.table('work_orders').select('*').eq('work_order_number', work_order_number).limit(1).execute()
        if not wo_result.data:
            logger.warning(f"Work order {work_order_number} not found for stage fetching")
            return []
        
        wo = wo_result.data[0]
        
        # Get operations for this work order to find which stages are configured
        ops_result = db.table('work_order_operations').select('operation_name').eq('work_order_id', wo['id']).execute()
        
        stages_result = None
        if not ops_result.data:
            logger.info(f"No operations found for WO {work_order_number}, falling back to all active stages")
            stages_result = db.table('wip_stages').select('*').eq('is_active', True).order('sequence_number').execute()
        else:
            # Get unique operation names
            operation_names = list(set([op['operation_name'] for op in ops_result.data]))
            # Get stages that match these operation names
            stages_result = db.table('wip_stages').select('*').in_('name', operation_names).eq('is_active', True).order('sequence_number').execute()
            
            # If explicit name match failed (e.g. typos or renames), fallback to ALL active stages
            if not stages_result.data:
                logger.info(f"No matching stages found for operations {operation_names}, falling back to all active stages")
                stages_result = db.table('wip_stages').select('*').eq('is_active', True).order('sequence_number').execute()
        
        if not stages_result or not stages_result.data:
            logger.warning("No WIP stages found in database")
            return []
        
        stages = []
        for s in stages_result.data:
            try:
                # Handle datetime parsing safely
                created_at = s.get('created_at')
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    created_at = datetime.utcnow()
                    
                updated_at = s.get('updated_at')
                if isinstance(updated_at, str):
                    updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                else:
                    updated_at = datetime.utcnow()

                stages.append(WIPStageResponse(
                    id=s['id'],
                    name=s['name'],
                    code=s['code'],
                    sequence_number=s['sequence_number'],
                    target_time_minutes=s.get('target_avg_time_minutes') or s.get('target_time_minutes') or 0,
                    location_id=s.get('location_id'),
                    description=s.get('description'),
                    is_active=s.get('is_active', True),
                    created_at=created_at,
                    updated_at=updated_at
                ))
            except Exception as e:
                logger.error(f"Error mapping stage {s.get('name')}: {e}")
                continue
        
        return stages
    
    
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
        
        stages = []
        for s in result.data:
            s['health_status'] = WIPService._map_health_status(s.get('health_status'))
            stages.append(WIPStageMetricsListItem(**s))
        
        # Calculate summary stats
        total_orders = sum(s.orders_count for s in stages)
        total_units = sum(s.units_count for s in stages)
        avg_cycle_time = Decimal(sum(float(s.avg_time_minutes) for s in stages) / len(stages)) if stages else Decimal('0')
        
        # Find bottleneck (delayed stage with highest utilization)
        bottleneck_stage = None
        delayed_stages = [s for s in stages if s.health_status == 'red']
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
        
        metrics = []
        for stage in result.data:
            stage['health_status'] = WIPService._map_health_status(stage.get('health_status'))
            metrics.append(WIPStageMetricsResponse(**stage))
        return metrics
    
    @staticmethod
    async def get_bottleneck_alerts() -> List[BottleneckAlert]:
        """Get bottleneck alerts for delayed stages"""
        db = get_db()
        
        result = db.table('wip_stage_metrics').select('*').in_('health_status', ['Warning', 'Delayed', 'yellow', 'red']).order('utilization_percentage', desc=True).execute()
        
        alerts = []
        for stage in result.data:
            h_status = WIPService._map_health_status(stage.get('health_status'))
            severity = 'critical' if h_status == 'red' else 'warning'
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
        
        stages_green = len([s for s in stages if WIPService._map_health_status(s['health_status']) == 'green'])
        stages_yellow = len([s for s in stages if WIPService._map_health_status(s['health_status']) == 'yellow'])
        stages_red = len([s for s in stages if WIPService._map_health_status(s['health_status']) == 'red'])
        
        bottleneck_stage = None
        delayed_stages = [s for s in stages if WIPService._map_health_status(s['health_status']) == 'red']
        if delayed_stages:
            bottleneck_stage = max(delayed_stages, key=lambda s: s['utilization_percentage'])['stage_name']
        
        return WIPSummaryStats(
            total_orders=total_orders,
            total_units=total_units,
            avg_cycle_time_minutes=avg_cycle_time,
            bottleneck_stage=bottleneck_stage,
            stages_green=stages_green,
            stages_yellow=stages_yellow,
            stages_red=stages_red
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
            
    @staticmethod
    def _map_health_status(status: Optional[str]) -> str:
        """Map legacy health status strings to color-coded enums"""
        if not status:
            return 'green'
        
        status_map = {
            'Healthy': 'green',
            'Warning': 'yellow',
            'Delayed': 'red',
            'green': 'green',
            'yellow': 'yellow',
            'red': 'red'
        }
        return status_map.get(status, 'green')


# Create singleton instance
wip_service = WIPService()
