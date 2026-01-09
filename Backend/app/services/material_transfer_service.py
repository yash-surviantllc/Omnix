from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional
from decimal import Decimal
from postgrest.exceptions import APIError
from app.database import get_db
from app.schemas.material_transfer import (
    MaterialTransferCreate,
    MaterialTransferUpdate,
    MaterialTransferResponse,
    MaterialTransferListItem,
    TransferStatusUpdate,
    TransferApprovalRequest,
    MaterialTransferItemCreate,
    MaterialTransferItemResponse,
    MaterialTransferApprovalEntry,
    MaterialTransferAuditEntry,
    MaterialTransferSlipResponse,
    MaterialTransferSlipItem,
    WIPStageTransferCreate,
    WIPStageTransferResponse,
    WIPStageResponse,
    WIPStageWithUnits,
    OrderStageStatus,
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
        Create material transfer request with one or more line items.
        Status starts as 'Pending'.
        """
        db = get_db()
        
        if transfer_data.from_location_id == transfer_data.to_location_id:
            raise ValidationException(detail="Source and destination locations cannot be the same")
        
        MaterialTransferService._ensure_location_exists(db, transfer_data.from_location_id, "Source location")
        MaterialTransferService._ensure_location_exists(db, transfer_data.to_location_id, "Destination location")

        prepared_items = MaterialTransferService._prepare_items(
            db,
            transfer_data.items,
            transfer_data.from_location_id
        )

        # Generate transfer number
        transfer_number = MaterialTransferService._generate_transfer_number()
        
        # Create transfer
        transfer_dict = {
            'transfer_number': transfer_number,
            'from_location_id': transfer_data.from_location_id,
            'to_location_id': transfer_data.to_location_id,
            'priority': transfer_data.priority,
            'reason': transfer_data.reason,
            'notes': transfer_data.notes,
            'reference_order_id': transfer_data.reference_order_id,
            'status': 'Pending',
            'transfer_type': transfer_data.transfer_type,
            'requested_by': user_id
        }
        
        result = db.table('material_transfers').insert(transfer_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create transfer")
        
        transfer_id = result.data[0]['id']

        items_payload = [
            {
                'transfer_id': transfer_id,
                'product_id': item['product_id'],
                'quantity': float(item['quantity']),
                'unit': item['unit'],
                'source_inventory_id': item['inventory_id'],
                'notes': item.get('notes')
            }
            for item in prepared_items
        ]

        db.table('material_transfer_items').insert(items_payload).execute()

        MaterialTransferService._log_audit(
            db,
            transfer_id,
            'CREATED',
            'Transfer created',
            {
                'item_count': len(items_payload),
                'from_location_id': transfer_data.from_location_id,
                'to_location_id': transfer_data.to_location_id
            },
            user_id
        )
        
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
            transfer_ids = MaterialTransferService._get_transfer_ids_for_product(db, product_id)
            if not transfer_ids:
                return []
            query = query.in_('id', transfer_ids)
        
        result = query.order('requested_at', desc=True).range(offset, offset + limit - 1).execute()
        records = result.data or []
        if not records:
            return []

        transfer_ids = [row['id'] for row in records]
        items_map = MaterialTransferService._fetch_items_grouped(db, transfer_ids)
        location_names = MaterialTransferService._fetch_location_names(
            db,
            {row['from_location_id'] for row in records} | {row['to_location_id'] for row in records}
        )

        transfers: List[MaterialTransferListItem] = []
        for transfer in records:
            items = items_map.get(transfer['id'], [])
            total_quantity = MaterialTransferService._compute_total_quantity(items)
            material_summary = MaterialTransferService._build_material_summary(items)

            if search:
                search_lower = search.lower()
                if (
                    search_lower not in transfer['transfer_number'].lower()
                    and search_lower not in material_summary.lower()
                    and search_lower not in location_names.get(transfer['from_location_id'], 'Unknown').lower()
                    and search_lower not in location_names.get(transfer['to_location_id'], 'Unknown').lower()
                ):
                    continue

            if transfer['status'] == 'Completed' and transfer.get('executed_at'):
                date_to_show = datetime.fromisoformat(transfer['executed_at'].replace('Z', '+00:00'))
            else:
                date_to_show = datetime.fromisoformat(transfer['requested_at'].replace('Z', '+00:00'))

            transfers.append(
                MaterialTransferListItem(
                    id=transfer['id'],
                    transfer_number=transfer['transfer_number'],
                    material_summary=material_summary,
                    total_quantity=total_quantity,
                    item_count=len(items),
                    from_location=location_names.get(transfer['from_location_id'], 'Unknown'),
                    to_location=location_names.get(transfer['to_location_id'], 'Unknown'),
                    status=transfer['status'],
                    date=date_to_show,
                )
            )
        
        return transfers
    
    @staticmethod
    async def get_transfer_by_id(transfer_id: str) -> MaterialTransferResponse:
        """Get transfer by ID with all details"""
        db = get_db()
        
        # Get transfer
        transfer = (
            db.table('material_transfers')
            .select('*')
            .eq('id', transfer_id)
            .single()
            .execute()
        )
        
        if not transfer.data:
            raise NotFoundException(detail="Transfer not found")
        
        if isinstance(transfer.data, list):
            if not transfer.data:
                raise NotFoundException(detail="Transfer not found")
            t = transfer.data[0]
        else:
            t = transfer.data
        
        location_names = MaterialTransferService._fetch_location_names(
            db, {t['from_location_id'], t['to_location_id']}
        )
        requested_by_name = MaterialTransferService._get_user_display_name(db, t.get('requested_by'))
        approved_by_name = MaterialTransferService._get_user_display_name(db, t.get('approved_by'))
        executed_by_name = MaterialTransferService._get_user_display_name(db, t.get('executed_by'))
        
        items = MaterialTransferService._fetch_transfer_items(db, transfer_id)
        approvals = MaterialTransferService._fetch_transfer_approvals(db, transfer_id)
        audit_log = MaterialTransferService._fetch_transfer_audit(db, transfer_id)
        
        return MaterialTransferResponse(
            id=t['id'],
            transfer_number=t['transfer_number'],
            from_location_id=t['from_location_id'],
            from_location_name=location_names.get(t['from_location_id']),
            to_location_id=t['to_location_id'],
            to_location_name=location_names.get(t['to_location_id']),
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
            cancelled_at=datetime.fromisoformat(t['cancelled_at'].replace('Z', '+00:00')) if t.get('cancelled_at') else None,
            created_at=datetime.fromisoformat(t['created_at'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(t['updated_at'].replace('Z', '+00:00')),
            items=[MaterialTransferItemResponse(**item) for item in items],
            approvals=[MaterialTransferApprovalEntry(**entry) for entry in approvals],
            audit_log=[MaterialTransferAuditEntry(**entry) for entry in audit_log],
        )
    
    @staticmethod
    async def generate_transfer_slip(transfer_id: str) -> MaterialTransferSlipResponse:
        """Build slip payload for printing or PDF generation"""
        transfer = await MaterialTransferService.get_transfer_by_id(transfer_id)

        slip_items = [
            MaterialTransferSlipItem(
                product_code=item.product_code,
                product_name=item.product_name,
                quantity=item.quantity,
                unit=item.unit,
                notes=item.notes,
            )
            for item in transfer.items
        ]

        return MaterialTransferSlipResponse(
            transfer_number=transfer.transfer_number,
            barcode_value=transfer.transfer_number,
            from_location=transfer.from_location_name or "",
            to_location=transfer.to_location_name or "",
            requested_by=transfer.requested_by_name,
            approved_by=transfer.approved_by_name,
            items=slip_items,
            generated_at=datetime.utcnow(),
            notes=transfer.notes,
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
        
        action = 'APPROVED' if approval.approve else 'REJECTED'
        now = datetime.utcnow().isoformat()

        update_dict = {
            'status': 'Approved' if approval.approve else 'Rejected',
            'approved_by': user_id,
            'approved_at': now
        }

        if approval.notes:
            update_dict['notes'] = approval.notes
        if not approval.approve:
            update_dict['rejection_reason'] = approval.notes or 'Rejected'

        db.table('material_transfers').update(update_dict).eq('id', transfer_id).execute()

        db.table('material_transfer_approvals').insert({
            'transfer_id': transfer_id,
            'approver_id': user_id,
            'action': action,
            'notes': approval.notes
        }).execute()

        MaterialTransferService._log_audit(
            db,
            transfer_id,
            action,
            f"Transfer {action.lower()}",
            {'notes': approval.notes} if approval.notes else None,
            user_id
        )
        
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
        
        items = MaterialTransferService._fetch_transfer_item_rows(db, transfer_id)
        if not items:
            raise ValidationException(detail="Transfer has no line items to execute")
        
        try:
            for item in items:
                MaterialTransferService._apply_inventory_transfer(db, t, item, user_id)
            
            db.table('material_transfers').update({
                'status': 'Completed',
                'executed_by': user_id,
                'executed_at': datetime.utcnow().isoformat()
            }).eq('id', transfer_id).execute()

            MaterialTransferService._log_audit(
                db,
                transfer_id,
                'COMPLETED',
                'Transfer executed',
                {'item_count': len(items)},
                user_id
            )
            
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
            'cancelled_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transfer_id).execute()
        
        MaterialTransferService._log_audit(
            db,
            transfer_id,
            'CANCELLED',
            'Transfer cancelled',
            None,
            None
        )
        
        return {"message": "Transfer cancelled successfully"}
    
    # =============================================
    # INTERNAL HELPERS
    # =============================================

    @staticmethod
    def _ensure_location_exists(db, location_id: str, label: str) -> None:
        try:
            result = (
                db.table('locations')
                .select('id')
                .eq('id', location_id)
                .single()
                .execute()
            )
        except APIError as exc:
            # PostgREST raises PGRST116 when .single() receives 0 rows
            if exc.code == 'PGRST116':
                raise NotFoundException(detail=f"{label} not found")
            raise

        if not result.data:
            raise NotFoundException(detail=f"{label} not found")

    @staticmethod
    def _prepare_items(db, items: List[MaterialTransferItemCreate], from_location_id: str) -> List[Dict]:
        if not items:
            raise ValidationException(detail="At least one line item is required")

        prepared: List[Dict] = []
        reserved_per_inventory: Dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

        for item in items:
            product = (
                db.table('products')
                .select('id, unit, code, name')
                .eq('id', item.product_id)
                .single()
                .execute()
            )
            if not product.data:
                raise NotFoundException(detail=f"Product {item.product_id} not found")

            inventory = (
                db.table('inventory')
                .select('id, available_qty, allocated_qty')
                .eq('product_id', item.product_id)
                .eq('location_id', from_location_id)
                .single()
                .execute()
            )
            if not inventory.data:
                raise ValidationException(detail=f"No inventory found for product at source location")

            available_qty = Decimal(str(inventory.data.get('available_qty') or 0))
            allocated_qty = Decimal(str(inventory.data.get('allocated_qty') or 0))
            free_qty = available_qty - allocated_qty

            inventory_id = inventory.data['id']
            reserved_per_inventory[inventory_id] += item.quantity

            if free_qty < reserved_per_inventory[inventory_id]:
                raise ValidationException(
                    detail=f"Insufficient inventory for product {product.data.get('code') or item.product_id}"
                )

            prepared.append(
                {
                    'product_id': item.product_id,
                    'quantity': item.quantity,
                    'unit': item.unit or product.data.get('unit') or '',
                    'inventory_id': inventory_id,
                    'notes': item.notes,
                }
            )

        return prepared

    @staticmethod
    def _fetch_products(db, product_ids: set) -> Dict[str, Dict]:
        if not product_ids:
            return {}
        result = (
            db.table('products')
            .select('id, code, name, unit')
            .in_('id', list(product_ids))
            .execute()
        )
        return {row['id']: row for row in (result.data or [])}

    @staticmethod
    def _get_user_display_name(db, user_id: Optional[str]) -> Optional[str]:
        if not user_id:
            return None
        user = db.table('users').select('full_name, username').eq('id', user_id).single().execute()
        if not user.data:
            return None
        return user.data.get('full_name') or user.data.get('username')

    @staticmethod
    def _fetch_location_names(db, location_ids: set) -> Dict[str, str]:
        result = (
            db.table('locations')
            .select('id, name')
            .in_('id', list(location_ids))
            .execute()
        )
        return {row['id']: row['name'] for row in (result.data or [])}

    @staticmethod
    def _fetch_transfer_items(db, transfer_id: str) -> List[Dict]:
        result = (
            db.table('material_transfer_items')
            .select('*')
            .eq('transfer_id', transfer_id)
            .execute()
        )
        rows = result.data or []
        product_map = MaterialTransferService._fetch_products(db, {row['product_id'] for row in rows})

        items: List[Dict] = []
        for row in rows:
            product = product_map.get(row['product_id'], {})
            items.append(
                {
                    'id': row['id'],
                    'product_id': row['product_id'],
                    'quantity': Decimal(str(row['quantity'])),
                    'unit': row['unit'],
                    'product_code': product.get('code'),
                    'product_name': product.get('name'),
                    'source_inventory_id': row.get('source_inventory_id'),
                    'notes': row.get('notes'),
                }
            )
        return items

    @staticmethod
    def _fetch_transfer_item_rows(db, transfer_id: str) -> List[Dict]:
        result = (
            db.table('material_transfer_items')
            .select('*')
            .eq('transfer_id', transfer_id)
            .execute()
        )
        return result.data or []

    @staticmethod
    def _apply_inventory_transfer(db, transfer: Dict, item: Dict, user_id: str) -> None:
        quantity = Decimal(str(item.get('quantity') or 0))
        if quantity <= 0:
            raise ValidationException(detail="Transfer item quantity must be greater than zero")

        source_inventory_id = item.get('source_inventory_id')
        if not source_inventory_id:
            raise ValidationException(detail="Transfer item missing source inventory reference")

        source_inventory = (
            db.table('inventory')
            .select('id, product_id, location_id, available_qty, allocated_qty')
            .eq('id', source_inventory_id)
            .single()
            .execute()
        )
        if not source_inventory.data:
            raise ValidationException(detail="Source inventory record not found for transfer item")

        available_qty = Decimal(str(source_inventory.data.get('available_qty') or 0))
        allocated_qty = Decimal(str(source_inventory.data.get('allocated_qty') or 0))
        free_qty = available_qty - allocated_qty

        if free_qty < quantity:
            raise ValidationException(
                detail=f"Insufficient stock for product {item.get('product_id')} at source location"
            )

        timestamp = datetime.utcnow().isoformat()

        # Deduct from source location
        db.table('inventory').update(
            {
                'available_qty': float(available_qty - quantity),
                'updated_at': timestamp,
                'last_transaction_at': timestamp,
            }
        ).eq('id', source_inventory_id).execute()

        # Add to destination location
        destination = (
            db.table('inventory')
            .select('id, available_qty')
            .eq('product_id', item['product_id'])
            .eq('location_id', transfer['to_location_id'])
            .limit(1)
            .execute()
        )

        if destination.data:
            dest_row = destination.data[0]
            dest_available = Decimal(str(dest_row.get('available_qty') or 0))
            db.table('inventory').update(
                {
                    'available_qty': float(dest_available + quantity),
                    'updated_at': timestamp,
                    'last_transaction_at': timestamp,
                }
            ).eq('id', dest_row['id']).execute()
        else:
            db.table('inventory').insert(
                {
                    'product_id': item['product_id'],
                    'location_id': transfer['to_location_id'],
                    'available_qty': float(quantity),
                    'allocated_qty': 0,
                    'last_transaction_at': timestamp,
                }
            ).execute()

        # Record inventory transaction
        db.table('inventory_transactions').insert(
            {
                'product_id': item['product_id'],
                'transaction_type': 'TRANSFER',
                'quantity': float(quantity),
                'from_location_id': transfer['from_location_id'],
                'to_location_id': transfer['to_location_id'],
                'reference_id': transfer['id'],
                'reference_type': 'material_transfer',
                'notes': item.get('notes') or transfer.get('reason'),
                'performed_by': user_id,
            }
        ).execute()

    @staticmethod
    def _fetch_transfer_approvals(db, transfer_id: str) -> List[Dict]:
        result = (
            db.table('material_transfer_approvals')
            .select('*')
            .eq('transfer_id', transfer_id)
            .order('created_at', desc=True)
            .execute()
        )
        rows = result.data or []
        approvals: List[Dict] = []
        for row in rows:
            approver_name = MaterialTransferService._get_user_display_name(db, row['approver_id'])
            approvals.append(
                {
                    'id': row['id'],
                    'approver_id': row['approver_id'],
                    'approver_name': approver_name,
                    'action': row['action'],
                    'notes': row.get('notes'),
                    'created_at': datetime.fromisoformat(row['created_at'].replace('Z', '+00:00')),
                }
            )
        return approvals

    @staticmethod
    def _fetch_transfer_audit(db, transfer_id: str) -> List[Dict]:
        result = (
            db.table('material_transfer_audit_log')
            .select('*')
            .eq('transfer_id', transfer_id)
            .order('created_at', desc=True)
            .execute()
        )

        rows = result.data or []
        audit: List[Dict] = []
        for row in rows:
            audit.append(
                {
                    'id': row['id'],
                    'event_type': row['event_type'],
                    'description': row.get('description'),
                    'metadata': row.get('metadata'),
                    'created_by': row.get('created_by'),
                    'created_by_name': MaterialTransferService._get_user_display_name(db, row.get('created_by')),
                    'created_at': datetime.fromisoformat(row['created_at'].replace('Z', '+00:00')),
                }
            )
        return audit

    @staticmethod
    def _log_audit(
        db,
        transfer_id: str,
        event_type: str,
        description: Optional[str],
        metadata: Optional[Dict],
        user_id: Optional[str],
    ) -> None:
        payload = {
            'transfer_id': transfer_id,
            'event_type': event_type,
            'description': description,
            'metadata': metadata,
            'created_by': user_id,
        }
        db.table('material_transfer_audit_log').insert(payload).execute()

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
        Move purchase order between WIP stages.
        Creates material transfer + WIP tracking.
        """
        db = get_db()
        
        # Validate order exists
        order = db.table('purchase_orders').select('*').eq('id', wip_transfer.order_id).execute()
        if not order.data:
            raise NotFoundException(detail="Purchase order not found")
        
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