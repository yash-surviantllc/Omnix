from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.schemas.material_transfer import (
    MaterialTransferCreate, MaterialTransferUpdate, MaterialTransferResponse,
    MaterialTransferListItem, TransferStatusUpdate, TransferApprovalRequest,
    WIPStageTransferCreate, WIPStageTransferResponse, WIPStageResponse,
    WIPStageWithUnits, OrderStageStatus
)
from app.core.exceptions import NotFoundException, ValidationException
from app.services.websocket_manager import manager


class MaterialTransferService:
    
    @staticmethod
    def _generate_transfer_number() -> str:
        """Generate unique transfer number: TRF-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        
        # Get count of transfers this year
        result = db.table('material_transfers').select('transfer_number', count='exact').like(
            'transfer_number', f'TRF-{year}-%'
        ).execute()
        
        count = result.count if hasattr(result, 'count') else 0
        next_number = count + 1
        
        return f"TRF-{year}-{next_number:04d}"
    
    @staticmethod
    async def create_transfer(
        transfer_data: MaterialTransferCreate,
        user_id: str
    ) -> MaterialTransferResponse:
        """
        Create material transfer request.
        Status starts as 'Pending'.
        """
        db = get_db()
        
        # Validate product exists
        product = db.table('products').select('id', 'unit').eq('id', transfer_data.product_id).execute()
        if not product.data:
            raise NotFoundException(detail="Product not found")
        
        # Validate locations exist (can be a Location or a WIP Stage)
        actual_to_location_id = transfer_data.destination_id or transfer_data.to_location_id
        is_to_stage = transfer_data.destination_type == "STAGE"
        to_stage_id = None
        to_stage_name = ""
        
        from_loc = db.table('locations').select('id').eq('id', transfer_data.from_location_id).execute()
        if not from_loc.data:
            from_loc = db.table('wip_stages').select('id').eq('id', transfer_data.from_location_id).execute()
        
        if is_to_stage:
            to_stage_id = actual_to_location_id
            to_stage_res = db.table('wip_stages').select('id', 'name').eq('id', to_stage_id).execute()
            if to_stage_res.data:
                to_stage_name = to_stage_res.data[0]['name']
                # If it's a stage, we must find a valid physical location for the FK constraint
                # 1. Try location type 'production_line'
                fallback = db.table('locations').select('id').eq('type', 'production_line').eq('is_active', True).execute()
                # 2. Try location type 'store'
                if not fallback.data:
                    fallback = db.table('locations').select('id').eq('type', 'store').eq('is_active', True).execute()
                # 3. Try any active location
                if not fallback.data:
                    fallback = db.table('locations').select('id').eq('is_active', True).limit(1).execute()
                    
                if fallback.data:
                    actual_to_location_id = fallback.data[0]['id']
                    to_loc = fallback # satisfy the check below
                else:
                    raise ValidationException(detail="No active physical locations exist in the system to map this transfer to.")
            else:
                raise NotFoundException(detail="Destination stage not found")
        else:
            to_loc = db.table('locations').select('id').eq('id', actual_to_location_id).execute()
            if not to_loc.data:
                # Fallback check in wip_stages just in case destination_type wasn't set correctly
                to_stage_res = db.table('wip_stages').select('id', 'name').eq('id', actual_to_location_id).execute()
                if to_stage_res.data:
                    is_to_stage = True
                    to_stage_id = actual_to_location_id
                    to_stage_name = to_stage_res.data[0]['name']
                    # Use same fallback logic for FK constraint
                    fallback = db.table('locations').select('id').eq('is_active', True).limit(1).execute()
                    if fallback.data:
                        actual_to_location_id = fallback.data[0]['id']
                        to_loc = fallback
                    else:
                        raise ValidationException(detail="No active physical locations exist in the system.")
                else:
                    raise NotFoundException(detail="Destination location not found")
        
        if not from_loc.data:
            raise NotFoundException(detail="Source location or stage not found")
        if not to_loc.data:
            raise NotFoundException(detail="Destination location or stage not found")
        
        # Final validation - ensure source and destination are different
        # For STAGE transfers, we allow from_location_id to be the fallback since the stage is logical
        is_same = (transfer_data.from_location_id == actual_to_location_id)
        if is_same and not is_to_stage:
             raise ValidationException(detail="Source and destination locations cannot be the same")
        
        # Check inventory availability at source
        inv = db.table('inventory').select('available_qty', 'allocated_qty').eq(
            'product_id', transfer_data.product_id
        ).eq('location_id', transfer_data.from_location_id).execute()
        
        if not inv.data:
            raise ValidationException(detail="No inventory found at source location")
        
        free_qty = float(inv.data[0]['available_qty']) - float(inv.data[0]['allocated_qty'])
        if free_qty < float(transfer_data.quantity):
            raise ValidationException(
                detail=f"Insufficient free inventory. Available: {free_qty}, Requested: {transfer_data.quantity}"
            )
        
        # Generate transfer number
        transfer_number = MaterialTransferService._generate_transfer_number()
        
        # Create transfer
        transfer_dict = {
            'transfer_number': transfer_number,
            'product_id': transfer_data.product_id,
            'from_location_id': transfer_data.from_location_id,
            'to_location_id': actual_to_location_id,
            'to_stage_id': to_stage_id,
            'to_stage_name': to_stage_name,
            'quantity': float(transfer_data.quantity),
            'unit': transfer_data.unit,
            'priority': transfer_data.priority,
            'reason': f"[Stage: {to_stage_name}] {transfer_data.reason or ''}" if is_to_stage else transfer_data.reason,
            'notes': transfer_data.notes,
            'reference_order_id': transfer_data.reference_order_id,
            'work_order_id': transfer_data.work_order_id,
            'work_order_number': transfer_data.work_order_number,
            'status': 'Approved',
            'transfer_type': 'Standard',
            'requested_by': user_id,
            'approved_by': user_id,
            'approved_at': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat()
        }
        
        result = db.table('material_transfers').insert(transfer_dict).execute()
        if not result.data:
            raise Exception("Failed to insert transfer record into database")
            
        transfer_id = result.data[0]['id']
        
        try:
            # Immediately execute the transfer
            await MaterialTransferService.execute_transfer(transfer_id, user_id)
        except Exception as e:
            # If execution fails, update status to Failed but return the response
            db.table('material_transfers').update({
                'status': 'Failed', 
                'notes': f"Execution failed: {str(e)}"
            }).eq('id', transfer_id).execute()
            
        # Return the latest state
        return await MaterialTransferService.get_transfer_by_id(transfer_id)
    
    @staticmethod
    async def list_transfers(
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        from_location_id: Optional[str] = None,
        to_location_id: Optional[str] = None,
        product_id: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[MaterialTransferListItem]:
        """List material transfers with optimized batch lookups"""
        db = get_db()
        offset = (page - 1) * limit
        query = db.table('material_transfers').select('*')
        
        if status:
            query = query.eq('status', status)
        if from_location_id:
            query = query.eq('from_location_id', from_location_id)
        if to_location_id:
            query = query.eq('to_location_id', to_location_id)
        if product_id:
            query = query.eq('product_id', product_id)
        
        result = query.order('requested_at', desc=True).range(offset, offset + limit - 1).execute()
        if not result.data:
            return []

        # Batch Lookups
        product_ids = list(set(t['product_id'] for t in result.data))
        from_loc_ids = list(set(t['from_location_id'] for t in result.data))
        to_loc_ids = list(set(t['to_location_id'] for t in result.data))
        all_loc_ids = list(set(from_loc_ids + to_loc_ids))

        product_map = {}
        if product_ids:
            prod_res = db.table('products').select('id, name').in_('id', product_ids).execute()
            product_map = {p['id']: p['name'] for p in prod_res.data}

        # Handle names from both locations and wip_stages
        location_map = {}
        if all_loc_ids:
            loc_res = db.table('locations').select('id, name').in_('id', all_loc_ids).execute()
            location_map.update({l['id']: l['name'] for l in loc_res.data})
            
            # Check remaining IDs in wip_stages
            remaining_ids = [id for id in all_loc_ids if id not in location_map]
            if remaining_ids:
                stage_res = db.table('wip_stages').select('id, name').in_('id', remaining_ids).execute()
                location_map.update({s['id']: s['name'] for s in stage_res.data})
        
        transfers = []
        for t in result.data:
            product_name = product_map.get(t['product_id'], 'Unknown')
            from_name = location_map.get(t['from_location_id'], 'Unknown')
            to_name = t.get('to_stage_name') or location_map.get(t['to_location_id'], 'Unknown')
            
            if search:
                s_lower = search.lower()
                if not any(s_lower in str(v).lower() for v in [t['transfer_number'], product_name, from_name, to_name]):
                    continue

            date_str = (t.get('executed_at') if t['status'] == 'Completed' else t.get('requested_at')) or t.get('created_at')
            date_to_show = datetime.fromisoformat(date_str.replace('Z', '+00:00')) if date_str else datetime.utcnow()

            transfers.append(MaterialTransferListItem(
                id=t['id'],
                transfer_number=t['transfer_number'],
                material=product_name,
                quantity=Decimal(str(t['quantity'])),
                unit=t['unit'],
                from_location=from_name,
                to_location=to_name,
                status=t['status'],
                date=date_to_show
            ))
        return transfers
    
    @staticmethod
    async def get_transfer_by_id(transfer_id: str) -> MaterialTransferResponse:
        """Get transfer by ID with all details"""
        db = get_db()
        
        # Get transfer
        transfer = db.table('material_transfers').select('*').eq('id', transfer_id).execute()
        
        if not transfer.data:
            raise NotFoundException(detail="Transfer not found")
        
        t = transfer.data[0]
        
        # Get product info
        product = db.table('products').select('code', 'name').eq('id', t['product_id']).execute()
        product_code = product.data[0]['code'] if product.data else None
        product_name = product.data[0]['name'] if product.data else None
        
        # Get location names
        from_loc = db.table('locations').select('name').eq('id', t['from_location_id']).execute()
        if not from_loc.data:
            from_loc = db.table('wip_stages').select('name').eq('id', t['from_location_id']).execute()
            
        from_location_name = from_loc.data[0]['name'] if from_loc.data else None
        
        # Prioritize to_stage_name from the transfer record
        to_location_name = t.get('to_stage_name')
        if not to_location_name:
            to_loc = db.table('locations').select('name').eq('id', t['to_location_id']).execute()
            to_location_name = to_loc.data[0]['name'] if to_loc.data else None
        
        # Get user names in batch
        user_ids = list(set(filter(None, [t.get('requested_by'), t.get('approved_by'), t.get('executed_by')])))
        user_map = {}
        if user_ids:
            users_res = db.table('users').select('id', 'full_name', 'username').in_('id', user_ids).execute()
            user_map = {u['id']: u.get('full_name') or u.get('username') for u in users_res.data}
        
        requested_by_name = user_map.get(t.get('requested_by'))
        approved_by_name = user_map.get(t.get('approved_by'))
        executed_by_name = user_map.get(t.get('executed_by'))
        
        return MaterialTransferResponse(
            id=t['id'],
            transfer_number=t['transfer_number'],
            product_id=t['product_id'],
            product_code=product_code,
            product_name=product_name,
            from_location_id=t['from_location_id'],
            from_location=from_location_name,
            to_location=to_location_name,
            from_location_name=from_location_name,
            to_location_name=to_location_name,
            to_location_id=t['to_location_id'],
            quantity=Decimal(str(t['quantity'])),
            unit=t['unit'],
            status=t['status'],
            transfer_type=t.get('transfer_type', 'Standard'),
            priority=t['priority'],
            reason=t.get('reason'),
            notes=t.get('notes'),
            reference_order_id=t.get('reference_order_id'),
            work_order_id=t.get('work_order_id'),
            work_order_number=t.get('work_order_number'),
            requested_by=t.get('requested_by'),
            requested_by_name=requested_by_name,
            approved_by=t.get('approved_by'),
            approved_by_name=approved_by_name,
            executed_by=t.get('executed_by'),
            executed_by_name=executed_by_name,
            requested_at=datetime.fromisoformat(t['requested_at'].replace('Z', '+00:00')),
            approved_at=datetime.fromisoformat(t['approved_at'].replace('Z', '+00:00')) if t.get('approved_at') else None,
            executed_at=datetime.fromisoformat(t['executed_at'].replace('Z', '+00:00')) if t.get('executed_at') else None,
            created_at=datetime.fromisoformat(t['created_at'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(t['updated_at'].replace('Z', '+00:00'))
        )
    
    @staticmethod
    async def approve_transfer(
        transfer_id: str,
        approval: TransferApprovalRequest,
        user_id: str
    ) -> MaterialTransferResponse:
        """Approve or reject transfer"""
        db = get_db()
        
        # Get transfer
        transfer = db.table('material_transfers').select('*').eq('id', transfer_id).execute()
        
        if not transfer.data:
            raise NotFoundException(detail="Transfer not found")
        
        if transfer.data[0]['status'] != 'Pending':
            raise ValidationException(detail=f"Cannot approve transfer with status: {transfer.data[0]['status']}")
        
        # Update transfer
        update_dict = {
            'status': 'Approved' if approval.approve else 'Rejected',
            'approved_by': user_id,
            'approved_at': datetime.utcnow().isoformat()
        }
        
        if approval.notes:
            update_dict['notes'] = approval.notes
        
        db.table('material_transfers').update(update_dict).eq('id', transfer_id).execute()
        
        # Broadcast update
        await manager.broadcast_dashboard_update('transfers', {
           'action': 'approved' if approval.approve else 'rejected',
           'transfer_id': transfer_id
        })

        return await MaterialTransferService.get_transfer_by_id(transfer_id)
    
    @staticmethod
    async def execute_transfer(
        transfer_id: str,
        user_id: str
    ) -> MaterialTransferResponse:
        """
        Execute transfer - update inventory atomically.
        Moves from 'Approved' to 'Completed'.
        """
        db = get_db()
        
        # Get transfer
        transfer = db.table('material_transfers').select('*').eq('id', transfer_id).execute()
        
        if not transfer.data:
            raise NotFoundException(detail="Transfer not found")
        
        t = transfer.data[0]
        
        if t['status'] != 'Approved':
            raise ValidationException(detail=f"Can only execute approved transfers. Current status: {t['status']}")
        
        # Update inventory atomically
        try:
            # 1. Deduct from source location
            source_inv = db.table('inventory').select('*').eq(
                'product_id', t['product_id']
            ).eq('location_id', t['from_location_id']).execute()
            
            if not source_inv.data:
                raise ValidationException(detail="Source inventory not found")
            
            source = source_inv.data[0]
            new_available = Decimal(str(source['available_qty'])) - Decimal(str(t['quantity']))
            
            if new_available < 0:
                raise ValidationException(detail="Insufficient inventory at source")
            
            update_res = db.table('inventory').update({
                'available_qty': float(new_available),
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', source['id']).execute()
            
            # 2. Add to destination location (Skip if it's a WIP Stage transfer)
            is_stage_transfer = t.get('to_stage_id') is not None
            
            if not is_stage_transfer:
                dest_inv = db.table('inventory').select('*').eq(
                    'product_id', t['product_id']
                ).eq('location_id', t['to_location_id']).execute()
                
                if dest_inv.data:
                    # Update existing
                    dest = dest_inv.data[0]
                    new_dest_qty = Decimal(str(dest['available_qty'])) + Decimal(str(t['quantity']))
                    
                    db.table('inventory').update({
                        'available_qty': float(new_dest_qty),
                        'updated_at': datetime.utcnow().isoformat()
                    }).eq('id', dest['id']).execute()
                else:
                    # Insert new
                    db.table('inventory').insert({
                        'product_id': t['product_id'],
                        'location_id': t['to_location_id'],
                        'available_qty': float(t['quantity']),
                        'allocated_qty': 0
                    }).execute()
            
            # 3. Log inventory transaction (Use 'CONSUMPTION' type for WIP Stages)
            db.table('inventory_transactions').insert({
                'product_id': t['product_id'],
                'transaction_type': 'CONSUMPTION' if is_stage_transfer else 'TRANSFER',
                'quantity': float(t['quantity']),
                'from_location_id': t['from_location_id'],
                'to_location_id': t['to_location_id'] if not is_stage_transfer else None,
                'reference_id': transfer_id,
                'reference_type': 'material_transfer',
                'notes': f"Transfer {t['transfer_number']} ({'CONSUMPTION' if is_stage_transfer else 'MOVE'}) to stage: {t.get('to_stage_name', 'Unknown')}" if is_stage_transfer else f"Transfer {t['transfer_number']}",
                'created_by': user_id
            }).execute()
            
            # 4. Update transfer status
            db.table('material_transfers').update({
                'status': 'Completed',
                'executed_by': user_id,
                'executed_at': datetime.utcnow().isoformat()
            }).eq('id', transfer_id).execute()
            
            # Broadcast update
            await manager.broadcast_dashboard_update('transfers', {
                'action': 'completed',
                'transfer_id': transfer_id
            })
            
            # Also broadcast inventory update since stock moved
            await manager.broadcast_dashboard_update('inventory', {
                'action': 'transfer',
                'product_id': t['product_id']
            })
            
            return await MaterialTransferService.get_transfer_by_id(transfer_id)
            
        except Exception as e:
            raise Exception(f"Transfer execution failed: {str(e)}")
    
    @staticmethod
    async def cancel_transfer(transfer_id: str) -> dict:
        """Cancel transfer (only if Pending or Approved)"""
        db = get_db()
        
        transfer = db.table('material_transfers').select('status').eq('id', transfer_id).execute()
        
        if not transfer.data:
            raise NotFoundException(detail="Transfer not found")
        
        if transfer.data[0]['status'] not in ['Pending', 'Approved']:
            raise ValidationException(detail=f"Cannot cancel transfer with status: {transfer.data[0]['status']}")
        
        db.table('material_transfers').update({
            'status': 'Cancelled',
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transfer_id).execute()
        
        return {"message": "Transfer cancelled successfully"}
    
    # =============================================
    # WIP STAGE TRANSFER METHODS
    # =============================================
    
    @staticmethod
    async def list_wip_stages() -> List[WIPStageResponse]:
        """Get all WIP stages in sequence"""
        db = get_db()
        
        stages = db.table('wip_stages').select('*').eq('is_active', True).order('sequence_number').execute()
        
        return [
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
            for s in stages.data
        ]
    
    @staticmethod
    async def get_wip_stages_with_units() -> List[WIPStageWithUnits]:
        """Get WIP stages with grouped unit counts (Optimized)"""
        db = get_db()
        stages = db.table('wip_stages').select('*').eq('is_active', True).order('sequence_number').execute()
        if not stages.data:
            return []

        # Batch fetch all tracking data
        tracking_res = db.table('order_stage_tracking').select('current_stage_id, quantity_in_stage').execute()
        
        # Group in memory
        counts_map = {}
        for row in tracking_res.data:
            sid = row['current_stage_id']
            qty = Decimal(str(row['quantity_in_stage']))
            counts_map[sid] = counts_map.get(sid, Decimal('0')) + qty
            
        return [
            WIPStageWithUnits(
                id=s['id'],
                name=s['name'],
                code=s['code'],
                sequence_number=s['sequence_number'],
                units=int(counts_map.get(s['id'], Decimal('0'))),
                target_time_minutes=s.get('target_time_minutes')
            )
            for s in stages.data
        ]
    
    @staticmethod
    async def create_wip_stage_transfer(
        wip_transfer: WIPStageTransferCreate,
        user_id: str
    ) -> WIPStageTransferResponse:
        """
        Move working order between WIP stages.
        Updates work_order_operations status for real-time sync.
        
        VALIDATION:
        - Prevents transfers that exceed work order target quantity
        - Tracks cumulative transferred quantities
        - Ensures data integrity for production use
        """
        try:
            db = get_db()
            
            # Validate WORK ORDER exists (NOT purchase order!)
            work_order = db.table('work_orders').select('*').eq('id', wip_transfer.order_id).execute()
            if not work_order.data:
                raise NotFoundException(detail="Working order not found")
            
            wo = work_order.data[0]
            
            # CRITICAL VALIDATION 1: Cannot transfer more than available in FROM stage (Moved down)
            
            # CRITICAL VALIDATION 2: Check total transferred quantity
            target_qty = Decimal(str(wo.get('target_qty', 0)))
            if target_qty <= 0:
                raise ValidationException(detail="Work order has no target quantity set")
            
            # Get all existing transfers for this work order to the destination stage
            existing_transfers = db.table('wip_stage_transfers').select(
                'quantity'
            ).eq('order_id', wip_transfer.order_id).eq(
                'to_stage_id', wip_transfer.to_stage_id
            ).execute()
            
            # Calculate total already transferred to this stage
            total_transferred = sum(
                Decimal(str(t['quantity'])) for t in existing_transfers.data
            ) if existing_transfers.data else Decimal('0')
            
            # Check if this transfer would exceed the target quantity
            new_total = total_transferred + wip_transfer.quantity
            
            if new_total > target_qty:
                raise ValidationException(
                    detail=f"Transfer rejected: Would exceed work order quantity. Total would be: {new_total}"
                )
            
            # Validate stages
            from_stage = None
            from_stage_name = None
            if wip_transfer.from_stage_id:
                from_stage_result = db.table('wip_stages').select('*').eq('id', wip_transfer.from_stage_id).execute()
                if not from_stage_result.data:
                    raise NotFoundException(detail="Source stage not found")
                from_stage = from_stage_result.data[0]
                from_stage_name = from_stage['name']

                # CRITICAL VALIDATION 1: Cannot transfer more than available in FROM stage
                # 1. Fetch sequences to identify First Stage
                ops_result = db.table('work_order_operations').select('operation_name').eq(
                    'work_order_id', wo['id']
                ).order('sequence_number').execute()
                
                is_first = ops_result.data and from_stage_name and (ops_result.data[0]['operation_name'].lower().strip() == from_stage_name.lower().strip())

                # 2. Compute Incoming
                if is_first:
                    incoming = target_qty
                else:
                    tos = db.table('wip_stage_transfers').select('quantity').eq(
                        'order_id', wip_transfer.order_id
                    ).eq('to_stage_id', wip_transfer.from_stage_id).execute()
                    incoming = sum(Decimal(str(t['quantity'])) for t in tos.data) if tos.data else Decimal('0')

                # 3. Compute Outgoing
                froms = db.table('wip_stage_transfers').select('quantity').eq(
                    'order_id', wip_transfer.order_id
                ).eq('from_stage_id', wip_transfer.from_stage_id).execute()
                outgoing = sum(Decimal(str(t['quantity'])) for t in froms.data) if froms.data else Decimal('0')

                available_qty = incoming - outgoing
                
                if wip_transfer.quantity > available_qty:
                    raise ValidationException(
                        detail=f"Transfer rejected: Insufficient units in current stage. Available: {available_qty}, Requested: {wip_transfer.quantity}"
                    )
            
            to_stage_result = db.table('wip_stages').select('*').eq('id', wip_transfer.to_stage_id).execute()
            if not to_stage_result.data:
                raise NotFoundException(detail="Destination stage not found")
            
            to_stage = to_stage_result.data[0]
            to_stage_name = to_stage['name']
            
            # Update work_order_operations for real-time sync
            if from_stage:
                # Complete the FROM stage operation
                from_op = db.table('work_order_operations').select('*').eq(
                    'work_order_id', wo['id']
                ).eq('operation_name', from_stage_name).execute()
                
                if from_op.data:
                    db.table('work_order_operations').update({
                        'status': 'Completed',
                        'actual_end': datetime.utcnow().isoformat(),
                        'updated_at': datetime.utcnow().isoformat()
                    }).eq('id', from_op.data[0]['id']).execute()
            
            # Start the TO stage operation
            to_op = db.table('work_order_operations').select('*').eq(
                'work_order_id', wo['id']
            ).eq('operation_name', to_stage_name).execute()
            
            if to_op.data:
                # Update existing operation
                db.table('work_order_operations').update({
                    'status': 'In Progress',
                    'actual_start': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('id', to_op.data[0]['id']).execute()
            else:
                # Create new operation
                db.table('work_order_operations').insert({
                    'work_order_id': wo['id'],
                    'operation_name': to_stage_name,
                    'sequence_number': to_stage.get('sequence_number', 0),
                    'status': 'In Progress',
                    'actual_start': datetime.utcnow().isoformat()
                }).execute()
            
            # Get unit from work order (try both 'unit' and 'units' fields)
            unit = wo.get('unit') or wo.get('units') or 'units'
            
            # Create WIP stage transfer record
            wip_transfer_dict = {
                'order_id': wip_transfer.order_id,
                'from_stage_id': wip_transfer.from_stage_id,
                'to_stage_id': wip_transfer.to_stage_id,
                'quantity': float(wip_transfer.quantity),
                'unit': unit,
                'actual_time_minutes': wip_transfer.actual_time_minutes,
                'notes': wip_transfer.notes,
                'transferred_by': user_id
            }
            
            result = db.table('wip_stage_transfers').insert(wip_transfer_dict).execute()
            
            if not result.data:
                raise Exception("Failed to create WIP stage transfer record")
            
            transfer_record = result.data[0]
            
            # Update order stage tracking (for quantity tracking)
            if wip_transfer.from_stage_id:
                # Reduce quantity in previous stage
                existing_from = db.table('order_stage_tracking').select('*').eq(
                    'order_id', wip_transfer.order_id
                ).eq('current_stage_id', wip_transfer.from_stage_id).execute()
                
                if existing_from.data:
                    new_qty = Decimal(str(existing_from.data[0]['quantity_in_stage'])) - wip_transfer.quantity
                    if new_qty > 0:
                        db.table('order_stage_tracking').update({
                            'quantity_in_stage': float(new_qty),
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', existing_from.data[0]['id']).execute()
                    else:
                        # Remove if quantity reaches 0
                        db.table('order_stage_tracking').delete().eq('id', existing_from.data[0]['id']).execute()
            
            # --- PO PROGRESS PROPAGATION LOGIC ---
            # If destination stage is 'DISPATCH', update the parent Purchase Order's completion qty
            if to_stage_name.upper() == 'DISPATCH':
                # 1. Fetch parent PO via WO
                # (Note: we already have wo['purchase_order_id'] from earlier)
                po_id = wo.get('purchase_order_id')
                if po_id:
                    po_res = db.table('purchase_orders').select('id, quantity, quantity_completed').eq('id', po_id).single().execute()
                    if po_res.data:
                        po = po_res.data
                        current_comp = Decimal(str(po.get('quantity_completed') or 0))
                        target_comp = Decimal(str(po.get('quantity') or 0))
                        transfer_qty = Decimal(str(wip_transfer.quantity))
                        
                        new_comp = current_comp + transfer_qty
                        
                        # Update PO quantity_completed
                        db.table('purchase_orders').update({
                            'quantity_completed': float(new_comp),
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', po_id).execute()
                        
                        # Check for PO completion
                        if new_comp >= target_comp:
                            from app.services.purchase_order_service import purchase_order_service
                            from app.schemas.purchase_order import OrderStatusUpdate
                            
                            await purchase_order_service.update_order_status(
                                po_id,
                                OrderStatusUpdate(
                                    status='Completed', 
                                    notes=f"Auto-completed via WIP Transfer to DISPATCH (Transferred {transfer_qty} units)"
                                ),
                                user_id
                            )

            # Update main work order operation (for legacy dashboard compatibility)
            # This fixes the dashboard count without using the broken order_stage_tracking table
            try:
                db.table('work_orders').update({
                    'operation': to_stage_name,
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('id', wo['id']).execute()
            except:
                pass
            
            # Update WIP metrics
            from app.services.wip_service import WIPService
            await WIPService._update_stage_metrics()
            
            # Broadcast update
            await manager.broadcast_dashboard_update('wip', {
                'action': 'stage_transfer',
                'work_order_number': wo['work_order_number']
            })
            
            # Get user name
            user = db.table('users').select('full_name', 'username').eq('id', user_id).execute()
            user_name = user.data[0].get('full_name') or user.data[0].get('username') if user.data else None
            
            return WIPStageTransferResponse(
                id=transfer_record['id'],
                transfer_id=None,
                order_id=wip_transfer.order_id,
                order_number=wo['work_order_number'],
                from_stage_id=wip_transfer.from_stage_id,
                from_stage_name=from_stage_name,
                to_stage_id=wip_transfer.to_stage_id,
                to_stage_name=to_stage_name,
                quantity=wip_transfer.quantity,
                unit=unit,
                actual_time_minutes=wip_transfer.actual_time_minutes,
                notes=wip_transfer.notes,
                transferred_by=user_id,
                transferred_by_name=user_name,
                transferred_at=datetime.utcnow()
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise



# Singleton instance
material_transfer_service = MaterialTransferService()