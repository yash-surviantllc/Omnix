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
        
        # Validate locations exist
        from_loc = db.table('locations').select('id').eq('id', transfer_data.from_location_id).execute()
        to_loc = db.table('locations').select('id').eq('id', transfer_data.to_location_id).execute()
        
        if not from_loc.data:
            raise NotFoundException(detail="Source location not found")
        if not to_loc.data:
            raise NotFoundException(detail="Destination location not found")
        
        if transfer_data.from_location_id == transfer_data.to_location_id:
            raise ValidationException(detail="Source and destination locations cannot be the same")
        
        # Check inventory availability at source
        inv = db.table('inventory').select('available_qty', 'allocated_qty').eq(
            'product_id', transfer_data.product_id
        ).eq('location_id', transfer_data.from_location_id).execute()
        
        if not inv.data:
            raise ValidationException(detail="No inventory found at source location")
        
        free_qty = Decimal(str(inv.data[0]['available_qty'])) - Decimal(str(inv.data[0]['allocated_qty']))
        
        if free_qty < transfer_data.quantity:
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
            'to_location_id': transfer_data.to_location_id,
            'quantity': float(transfer_data.quantity),
            'unit': transfer_data.unit,
            'priority': transfer_data.priority,
            'reason': transfer_data.reason,
            'notes': transfer_data.notes,
            'reference_order_id': transfer_data.reference_order_id,
            'status': 'Pending',
            'transfer_type': 'Standard',
            'requested_by': user_id
        }
        
        result = db.table('material_transfers').insert(transfer_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create transfer")
        
        return await MaterialTransferService.get_transfer_by_id(result.data[0]['id'])
    
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
        """List material transfers with filters"""
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
        
        transfers = []
        for transfer in result.data:
            # Get product info
            product = db.table('products').select('name').eq('id', transfer['product_id']).execute()
            product_name = product.data[0]['name'] if product.data else 'Unknown'
            
            # Get location names
            from_loc = db.table('locations').select('name').eq('id', transfer['from_location_id']).execute()
            to_loc = db.table('locations').select('name').eq('id', transfer['to_location_id']).execute()
            
            from_location_name = from_loc.data[0]['name'] if from_loc.data else 'Unknown'
            to_location_name = to_loc.data[0]['name'] if to_loc.data else 'Unknown'
            
            # Determine date to show based on status
            if transfer['status'] == 'Completed' and transfer.get('executed_at'):
                date_to_show = datetime.fromisoformat(transfer['executed_at'].replace('Z', '+00:00'))
            else:
                date_to_show = datetime.fromisoformat(transfer['requested_at'].replace('Z', '+00:00'))
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if (search_lower not in transfer['transfer_number'].lower() and
                    search_lower not in product_name.lower() and
                    search_lower not in from_location_name.lower() and
                    search_lower not in to_location_name.lower()):
                    continue
            
            transfers.append(MaterialTransferListItem(
                id=transfer['id'],
                transfer_number=transfer['transfer_number'],
                material=product_name,
                quantity=Decimal(str(transfer['quantity'])),
                unit=transfer['unit'],
                from_location=from_location_name,
                to_location=to_location_name,
                status=transfer['status'],
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
        to_loc = db.table('locations').select('name').eq('id', t['to_location_id']).execute()
        
        from_location_name = from_loc.data[0]['name'] if from_loc.data else None
        to_location_name = to_loc.data[0]['name'] if to_loc.data else None
        
        # Get user names
        requested_by_name = None
        approved_by_name = None
        executed_by_name = None
        
        if t.get('requested_by'):
            user = db.table('users').select('full_name', 'username').eq('id', t['requested_by']).execute()
            requested_by_name = user.data[0].get('full_name') or user.data[0].get('username') if user.data else None
        
        if t.get('approved_by'):
            user = db.table('users').select('full_name', 'username').eq('id', t['approved_by']).execute()
            approved_by_name = user.data[0].get('full_name') or user.data[0].get('username') if user.data else None
        
        if t.get('executed_by'):
            user = db.table('users').select('full_name', 'username').eq('id', t['executed_by']).execute()
            executed_by_name = user.data[0].get('full_name') or user.data[0].get('username') if user.data else None
        
        return MaterialTransferResponse(
            id=t['id'],
            transfer_number=t['transfer_number'],
            product_id=t['product_id'],
            product_code=product_code,
            product_name=product_name,
            from_location_id=t['from_location_id'],
            from_location_name=from_location_name,
            to_location_id=t['to_location_id'],
            to_location_name=to_location_name,
            quantity=Decimal(str(t['quantity'])),
            unit=t['unit'],
            status=t['status'],
            transfer_type=t.get('transfer_type', 'Standard'),
            priority=t['priority'],
            reason=t.get('reason'),
            notes=t.get('notes'),
            reference_order_id=t.get('reference_order_id'),
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
            
            db.table('inventory').update({
                'available_qty': float(new_available),
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', source['id']).execute()
            
            # 2. Add to destination location
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
            
            # 3. Log inventory transaction
            db.table('inventory_transactions').insert({
                'product_id': t['product_id'],
                'transaction_type': 'TRANSFER',
                'quantity': float(t['quantity']),
                'from_location_id': t['from_location_id'],
                'to_location_id': t['to_location_id'],
                'reference_id': transfer_id,
                'reference_type': 'material_transfer',
                'notes': f"Transfer {t['transfer_number']}",
                'performed_by': user_id
            }).execute()
            
            # 4. Update transfer status
            db.table('material_transfers').update({
                'status': 'Completed',
                'executed_by': user_id,
                'executed_at': datetime.utcnow().isoformat()
            }).eq('id', transfer_id).execute()
            
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
        """Get WIP stages with current unit counts (for UI display)"""
        db = get_db()
        
        stages = db.table('wip_stages').select('*').eq('is_active', True).order('sequence_number').execute()
        
        result = []
        for stage in stages.data:
            # Count units in this stage
            tracking = db.table('order_stage_tracking').select('quantity_in_stage').eq(
                'current_stage_id', stage['id']
            ).execute()
            
            total_units = sum(Decimal(str(t['quantity_in_stage'])) for t in tracking.data) if tracking.data else Decimal('0')
            
            result.append(WIPStageWithUnits(
                id=stage['id'],
                name=stage['name'],
                code=stage['code'],
                sequence_number=stage['sequence_number'],
                units=int(total_units),
                target_time_minutes=stage.get('target_time_minutes')
            ))
        
        return result
    
    @staticmethod
    async def create_wip_stage_transfer(
        wip_transfer: WIPStageTransferCreate,
        user_id: str
    ) -> WIPStageTransferResponse:
        """
        Move production order between WIP stages.
        Creates material transfer + WIP tracking.
        """
        db = get_db()
        
        # Validate order exists
        order = db.table('production_orders').select('*').eq('id', wip_transfer.order_id).execute()
        if not order.data:
            raise NotFoundException(detail="Production order not found")
        
        # Validate stages
        to_stage = db.table('wip_stages').select('*').eq('id', wip_transfer.to_stage_id).execute()
        if not to_stage.data:
            raise NotFoundException(detail="Destination stage not found")
        
        from_stage_name = None
        if wip_transfer.from_stage_id:
            from_stage = db.table('wip_stages').select('name').eq('id', wip_transfer.from_stage_id).execute()
            from_stage_name = from_stage.data[0]['name'] if from_stage.data else None
        
        # Create WIP stage transfer record
        wip_transfer_dict = {
            'order_id': wip_transfer.order_id,
            'from_stage_id': wip_transfer.from_stage_id,
            'to_stage_id': wip_transfer.to_stage_id,
            'quantity': float(wip_transfer.quantity),
            'unit': order.data[0]['unit'],
            'actual_time_minutes': wip_transfer.actual_time_minutes,
            'notes': wip_transfer.notes,
            'transferred_by': user_id
        }
        
        result = db.table('wip_stage_transfers').insert(wip_transfer_dict).execute()
        
        # Update order stage tracking
        if wip_transfer.from_stage_id:
            # Reduce quantity in previous stage
            db.table('order_stage_tracking').update({
                'quantity_in_stage': Decimal(str(wip_transfer.quantity)) * -1,  # Reduce
                'updated_at': datetime.utcnow().isoformat()
            }).eq('order_id', wip_transfer.order_id).eq('current_stage_id', wip_transfer.from_stage_id).execute()
        
        # Add to new stage
        existing_tracking = db.table('order_stage_tracking').select('*').eq(
            'order_id', wip_transfer.order_id
        ).eq('current_stage_id', wip_transfer.to_stage_id).execute()
        
        if existing_tracking.data:
            # Update existing
            new_qty = Decimal(str(existing_tracking.data[0]['quantity_in_stage'])) + wip_transfer.quantity
            db.table('order_stage_tracking').update({
                'quantity_in_stage': float(new_qty),
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', existing_tracking.data[0]['id']).execute()
        else:
            # Insert new
            db.table('order_stage_tracking').insert({
                'order_id': wip_transfer.order_id,
                'current_stage_id': wip_transfer.to_stage_id,
                'quantity_in_stage': float(wip_transfer.quantity),
                'entered_stage_at': datetime.utcnow().isoformat()
            }).execute()
        
        # Get user name
        user = db.table('users').select('full_name', 'username').eq('id', user_id).execute()
        user_name = user.data[0].get('full_name') or user.data[0].get('username') if user.data else None
        
        return WIPStageTransferResponse(
            id=result.data[0]['id'],
            transfer_id=None,
            order_id=wip_transfer.order_id,
            order_number=order.data[0]['order_number'],
            from_stage_id=wip_transfer.from_stage_id,
            from_stage_name=from_stage_name,
            to_stage_id=wip_transfer.to_stage_id,
            to_stage_name=to_stage.data[0]['name'],
            quantity=wip_transfer.quantity,
            unit=order.data[0]['unit'],
            actual_time_minutes=wip_transfer.actual_time_minutes,
            notes=wip_transfer.notes,
            transferred_by=user_id,
            transferred_by_name=user_name,
            transferred_at=datetime.utcnow()
        )


# Singleton instance
material_transfer_service = MaterialTransferService()