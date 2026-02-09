from typing import List, Optional, Union
from datetime import datetime
from decimal import Decimal
from app.database import get_db
from app.schemas.wip import (
    WorkingOrderCreate, WorkingOrderUpdate, WorkingOrderResponse, WorkingOrderListItem,
    UniqueWorkingOrderItem,
    WIPStageMetricsResponse, WIPStageMetricsListItem, WIPDashboardResponse,
    WIPSummaryStats, BottleneckAlert, StagePerformanceHistoryResponse
)
from app.services.bom_service import BOMService # Task 3: For Material Allocation
from app.services.websocket_manager import manager # For Real-time Updates
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
        prod_res = db.table('products').select('code').eq('id', product_id).single().execute()
        sku = prod_res.data['code'] if prod_res.data else None
        
        config_id = getattr(order_data, 'config_id', None)
        if not config_id:
            config_id = await StageService.resolve_config_for_entity(sku=sku, wo_no=work_order_number)
        
        # Get Stages
        stages = await StageService.list_stages(config_id=config_id)
        first_op_name = stages[0].name if stages else 'General' # Fallback for operation field

        # 3. Insert working order
        insert_data = {
            **order_data.model_dump(mode="json", exclude={'operation', 'config_id'}),
            'work_order_number': work_order_number,
            'created_by': created_by,
            'product_id': product_id,
            'operation': first_op_name # CRITICAL: Satisfy NOT NULL constraint
        }
        
        # Default shift
        if 'shift' not in insert_data:
            insert_data['shift'] = 'Morning'
        
        # Defensive Mapping (Task 2 Fix)
        if insert_data.get('shift') == 'Evening':
            insert_data['shift'] = 'Afternoon'
            
        if insert_data.get('priority') == 'Normal':
            insert_data['priority'] = 'Medium'
            
        # Ensure priority is Title Case
        if 'priority' in insert_data and insert_data['priority']:
             insert_data['priority'] = insert_data['priority'].title()
        
        result = db.table('work_orders').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create working order")

        wo_id = result.data[0]['id']
        logger.info(f"WO Created: {work_order_number} (ID: {wo_id}) | SKU: {sku} | Config: {config_id} | Operation: {first_op_name}")
        
        # 4. Inventory Allocation (Real-time) - PRODUCTION-SAFE VERSION
        # Phase 1: Validation (no DB changes yet)
        # Phase 2: Allocation (with rollback tracking)
        
        # Get Main Store Location
        try:
            loc_res = db.table('locations').select('id').eq('code', 'MAIN-STORE').single().execute()
            if not loc_res.data:
                raise ValidationException(detail="MAIN-STORE location not found. Please configure inventory locations.")
            main_store_id = loc_res.data['id']
        except Exception as e:
            logger.error(f"Failed to get MAIN-STORE location: {e}")
            # Delete WO since we can't allocate materials
            db.table('work_orders').delete().eq('id', wo_id).execute()
            raise ValidationException(detail=f"Cannot allocate materials: Main Store location not configured")
        
        # Calculate Requirements
        try:
            requirements = await BOMService.calculate_material_requirements(product_id, Decimal(str(order_data.target_qty)))
        except Exception as e:
            logger.error(f"BOM calculation failed: {e}")
            db.table('work_orders').delete().eq('id', wo_id).execute()
            raise ValidationException(detail=f"Failed to calculate material requirements: {str(e)}")
        
        if not requirements:
            logger.warning(f"No BOM materials found for product {product_id}")
            # This might be valid for some products, continue without allocation
        else:
            # PHASE 1: VALIDATION - Check all materials before allocating any
            validation_errors = []
            material_details = []
            
            for req in requirements:
                # Get product name for error messages
                try:
                    prod_res = db.table('products').select('name').eq('id', req.material_id).single().execute()
                    material_name = prod_res.data['name'] if prod_res.data else f"Material {req.material_id}"
                except:
                    material_name = f"Material {req.material_id}"
                
                # Query inventory
                inv_query = db.table('inventory').select('id, allocated_qty, available_qty').eq(
                    'product_id', req.material_id
                ).eq('location_id', main_store_id)
                
                inv_res = inv_query.limit(1).execute()
                
                # Check 1: Material exists in inventory
                if not inv_res.data:
                    validation_errors.append(
                        f"{material_name}: Not found in Main Store inventory"
                    )
                    continue
                
                inv_record = inv_res.data[0]
                available = Decimal(str(inv_record['available_qty']))
                current_allocated = Decimal(str(inv_record['allocated_qty']))
                free_qty = available - current_allocated
                
                # Check 2: Sufficient free stock
                if free_qty < req.required_quantity:
                    validation_errors.append(
                        f"{material_name}: Insufficient stock (need {req.required_quantity} {req.unit}, "
                        f"only {free_qty} {req.unit} free - total: {available}, allocated: {current_allocated})"
                    )
                    continue
                
                # Store for allocation phase
                material_details.append({
                    'requirement': req,
                    'inventory_record': inv_record,
                    'material_name': material_name
                })
            
            # If any validation errors, fail before making any changes
            if validation_errors:
                # Delete the WO that was just created
                db.table('work_orders').delete().eq('id', wo_id).execute()
                logger.error(f"Material allocation validation failed for WO {work_order_number}: {validation_errors}")
                
                error_msg = f"Cannot create Working Order - Material allocation failed:\n\n"
                error_msg += "\n".join(f"• {err}" for err in validation_errors)
                error_msg += f"\n\nPlease ensure sufficient materials are available before creating this Working Order."
                
                raise ValidationException(detail=error_msg)
            
            # PHASE 2: ALLOCATION - All validations passed, now allocate
            allocated_inventory_ids = []
            wo_materials_data = []
            
            try:
                for detail in material_details:
                    req = detail['requirement']
                    inv_record = detail['inventory_record']
                    material_name = detail['material_name']
                    
                    # Prepare WO material record
                    wo_materials_data.append({
                        'work_order_id': wo_id,
                        'material_id': req.material_id,
                        'required_qty': float(req.required_quantity),
                        'allocated_qty': float(req.required_quantity),
                        'unit': req.unit,
                        'status': 'Allocated'
                    })
                    
                    # Update inventory allocation
                    new_allocated = Decimal(str(inv_record['allocated_qty'])) + req.required_quantity
                    db.table('inventory').update({
                        'allocated_qty': float(new_allocated),
                        'updated_at': datetime.utcnow().isoformat()
                    }).eq('id', inv_record['id']).execute()
                    
                    # Track for potential rollback
                    allocated_inventory_ids.append({
                        'id': inv_record['id'],
                        'quantity': req.required_quantity,
                        'material_name': material_name
                    })
                    
                    logger.info(f"Allocated {req.required_quantity} {req.unit} of {material_name} for WO {work_order_number}")
                
                # Insert all WO materials at once
                if wo_materials_data:
                    db.table('work_order_materials').insert(wo_materials_data).execute()
                    logger.info(f"Created {len(wo_materials_data)} material records for WO {work_order_number}")
                
                # Broadcast inventory update
                await manager.broadcast({"type": "inventory_update"})
                await dashboard_service.broadcast_shortages_update()
                await dashboard_service.broadcast_activities_update()
                await dashboard_service.broadcast_kpis_update()
                logger.info(f"Material allocation completed successfully for WO {work_order_number}")
                
            except Exception as e:
                # ROLLBACK: Undo all inventory allocations
                logger.error(f"Allocation failed for WO {work_order_number}, initiating rollback: {e}")
                
                for alloc in allocated_inventory_ids:
                    try:
                        # Get current allocated_qty
                        inv = db.table('inventory').select('allocated_qty').eq('id', alloc['id']).single().execute()
                        if inv.data:
                            # Subtract the quantity we added
                            rollback_allocated = Decimal(str(inv.data['allocated_qty'])) - alloc['quantity']
                            db.table('inventory').update({
                                'allocated_qty': float(max(rollback_allocated, Decimal('0'))),  # Prevent negative
                                'updated_at': datetime.utcnow().isoformat()
                            }).eq('id', alloc['id']).execute()
                            logger.info(f"Rolled back allocation for {alloc['material_name']}")
                    except Exception as rollback_err:
                        logger.error(f"Rollback failed for {alloc['material_name']}: {rollback_err}")
                
                # Delete WO and WO materials
                try:
                    db.table('work_order_materials').delete().eq('work_order_id', wo_id).execute()
                except:
                    pass
                
                db.table('work_orders').delete().eq('id', wo_id).execute()
                logger.error(f"Deleted WO {work_order_number} after allocation failure")
                
                # Re-raise with user-friendly message
                raise ValidationException(
                    detail=f"Material allocation failed: {str(e)}. All changes have been rolled back."
                )
        
        
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
        
        # 6. Update WIP metrics
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
            # Case: Operation not found in operations table. 
            # We need to resolve the correct sequence number to avoid constraint violation.
             
            # Try to find stage config first
            stage_res = db.table('wip_stages').select('sequence_number').eq('name', operation_name).execute()
             
            if stage_res.data:
                seq_num = stage_res.data[0]['sequence_number']
            else:
                # Fallback: Find max sequence for this WO and add 1
                max_seq_res = db.table('work_order_operations').select('sequence_number').eq('work_order_id', parent['id']).order('sequence_number', desc=True).limit(1).execute()
                if max_seq_res.data:
                    seq_num = max_seq_res.data[0]['sequence_number'] + 1
                else:
                    seq_num = 10 # Default start if no operations exist

            new_op_data = {
               'work_order_id': parent['id'],
               'operation_name': operation_name,
               'sequence_number': seq_num,
               'status': 'In Progress',
               'actual_start': datetime.utcnow().isoformat()
            }
            ins_res = db.table('work_order_operations').insert(new_op_data).execute()
            if not ins_res.data:
                raise Exception("Failed to create operation record")
            op_record = ins_res.data[0]
        else:
             op_record = op_res.data[0]
             # Update status
             db.table('work_order_operations').update({
                 'status': 'In Progress',
                 'actual_start': datetime.utcnow().isoformat()
             }).eq('id', op_record['id']).execute()

        # 4. Update metrics & Broadcast
        await WIPService._update_stage_metrics()
        
        # Return the updated operation as a WO object (for frontend compatibility)
        # We need to construct the full object
        row = WIPService._map_db_row(parent)
        row['operation'] = operation_name
        row['status'] = 'In Progress'
        row['id'] = op_record['id'] # Important: Return Op ID
        
        return WorkingOrderResponse(**row)
            
        # 4. Update metrics & Broadcast
        await WIPService._update_stage_metrics()
        
        # Helper to map response
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

            # NEW LOGIC: Fetch Operations from work_order_operations
            # We want to return a list where each item represents an Operation.
            # If the WO has operations in work_order_operations, we return those.
            # If not, we return the base WO as a single item (legacy fallback).
            
            ops_query = db.table('work_order_operations').select('*').eq('work_order_id', wo['id']).execute()
            ops = ops_query.data
            
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

                    items.append(WorkingOrderListItem(**item))
            else:
                 # Legacy fallback: Return WO as is (single stage)
                 # Only if it matches operation filter
                 if operation and wo['operation'] != operation:
                     continue
                 items.append(WorkingOrderListItem(**base))

        return items
    
    
    @staticmethod
    async def list_unique_working_orders(
        status: Optional[List[str]] = None
    ) -> List[UniqueWorkingOrderItem]:
        """
        Get unique work orders (one per work_order_number).
        Used for dropdowns where we need to select a work order, not an operation.
        """
        db = get_db()
        
        query = db.table('work_orders').select('id, work_order_number, product_id, status, created_at')
        
        if status:
            query = query.in_('status', status)
        
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
                status=wo['status']
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
        
        db = get_db()
        
        print(f"[DEBUG] Fetching stages for work order: {work_order_number}")
        
        # Get work order
        wo_result = db.table('work_orders').select('*').eq('work_order_number', work_order_number).limit(1).execute()
        if not wo_result.data:
            print(f"[DEBUG] Work order not found: {work_order_number}")
            return []
        
        wo = wo_result.data[0]
        print(f"[DEBUG] Found work order: {wo.get('id')}")
        
        # Get operations for this work order to find which stages are configured
        ops_result = db.table('work_order_operations').select('operation_name').eq('work_order_id', wo['id']).execute()
        
        if not ops_result.data:
            print(f"[DEBUG] No operations found for work order, returning all active stages")
            # Fallback: return all active stages if no operations defined
            stages_result = db.table('wip_stages').select('*').eq('is_active', True).order('sequence_number').execute()
        else:
            # Get unique operation names
            operation_names = list(set([op['operation_name'] for op in ops_result.data]))
            print(f"[DEBUG] Found operations: {operation_names}")
            
            # Get stages that match these operation names
            stages_result = db.table('wip_stages').select('*').in_('name', operation_names).eq('is_active', True).order('sequence_number').execute()
        
        print(f"[DEBUG] Found {len(stages_result.data) if stages_result.data else 0} stages")
        
        if not stages_result.data:
            return []
        
        stages = [
            WIPStageResponse(
                id=s['id'],
                name=s['name'],
                code=s['code'],
                sequence_number=s['sequence_number'],
                target_time_minutes=s.get('target_time_minutes'),
                location_id=s.get('location_id'),
                description=s.get('description'),
                is_active=s['is_active'],
                created_at=datetime.fromisoformat(s['created_at'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(s['updated_at'].replace('Z', '+00:00'))
            )
            for s in stages_result.data
        ]
        
        print(f"[DEBUG] Returning {len(stages)} stages: {[s.name for s in stages]}")
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
        
        # KEY FIX: Check if this ID belongs to an Operation (work_order_operations)
        # If so, update that table instead of work_orders.
        op_check = db.table('work_order_operations').select('work_order_id, operation_name').eq('id', order_id).execute()
        
        if op_check.data:
            # It's an Operation ID
            op_data = op_check.data[0]
            # Map update fields to table columns (e.g. status, actual_end)
            op_update = {}
            if 'status' in update_data:
                op_update['status'] = update_data['status']
            if 'actual_start' in update_data:
                op_update['actual_start'] = update_data['actual_start']
            if 'actual_end' in update_data:
                op_update['actual_end'] = update_data['actual_end']
            if 'completed_qty' in update_data:
                # Store completed qty
                op_update['completed_qty'] = update_data['completed_qty']
            
            if op_update:
                op_res = db.table('work_order_operations').update(op_update).eq('id', order_id).execute()
                if not op_res.data:
                    raise Exception("Failed to update operation")

            # Return the full WO structure
            parent_wo = await WIPService.get_working_order_by_id(op_data['work_order_id'])
            # Override with op details (hacky but consistent with list view)
            parent_wo.id = order_id # Return the op ID request
            parent_wo.operation = op_data['operation_name']
            parent_wo.status = update_data.get('status', parent_wo.status)
            
             # Update metrics & Broadcast (Global WO status usually tracks overall progress, but here we track OPS)
            await WIPService._update_stage_metrics()
            await dashboard_service.broadcast_orders_update()
            await dashboard_service.broadcast_kpis_update()
            
            return parent_wo

        # Fallback: Update main Work Order (Legacy or Header update)
        result = db.table('work_orders').update(update_data).eq('id', order_id).execute()
        
        if not result.data:
            raise Exception(f"Working order {order_id} not found")
        
        # Update WIP metrics if status or completion changed
        if 'status' in update_data or 'completed_qty' in update_data:
            await WIPService._update_stage_metrics()
            await dashboard_service.broadcast_orders_update()
            await dashboard_service.broadcast_kpis_update()
        
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
