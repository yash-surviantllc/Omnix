from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal
from app.database import get_db
from app.schemas.qc import (
    QCInspectionCreate, QCInspectionUpdate, QCInspectionResponse,
    QCDefectCreate, QCStats
)
from app.core.exceptions import NotFoundException, ValidationException
from app.services.websocket_manager import manager
from app.services.inventory_service import InventoryService
from app.schemas.inventory import InventoryTransactionCreate

class QCService:
    
    @staticmethod
    def _generate_inspection_number() -> str:
        """Generate unique inspection number: QC-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        
        # Get count of inspections this year
        result = db.table('qc_inspections').select('inspection_number', count='exact').like(
            'inspection_number', f'QC-{year}-%'
        ).execute()
        
        count = result.count if hasattr(result, 'count') else 0
        next_number = count + 1
        
        return f"QC-{year}-{next_number:04d}"

    @staticmethod
    async def create_inspection(
        data: QCInspectionCreate,
        user_id: str
    ) -> QCInspectionResponse:
        """
        Create a new QC inspection record and update related orders.
        """
        db = get_db()
        
        # 1. Validate Orders
        target_order_type = None
        target_order_id = None
        
        if data.work_order_id:
            wo = db.table('work_orders').select('id, purchase_order_id, target_qty, completed_qty, rejected_qty').eq('id', data.work_order_id).execute()
            if not wo.data:
                raise NotFoundException(detail="Working Order not found")
            target_order_type = 'work_order'
            target_order_id = data.work_order_id
            order_data = wo.data[0]
        elif data.purchase_order_id:
            po = db.table('purchase_orders').select('id, quantity, quantity_completed, rejected_qty').eq('id', data.purchase_order_id).execute()
            if not po.data:
                raise NotFoundException(detail="Purchase Order not found")
            target_order_type = 'purchase_order'
            target_order_id = data.purchase_order_id
            order_data = po.data[0]
        else:
            raise ValidationException(detail="Either Purchase Order or Working Order ID is required")

        # 2. Generate Inspection Number
        inspection_number = QCService._generate_inspection_number()
        
        # 3. Insert Inspection
        inspection_dict = {
            'inspection_number': inspection_number,
            'purchase_order_id': data.purchase_order_id,
            'work_order_id': data.work_order_id,
            'product_id': data.product_id,
            'quantity_checked': float(data.quantity_checked),
            'passed_qty': float(data.passed_qty),
            'rework_qty': float(data.rework_qty),
            'scrap_qty': float(data.scrap_qty),
            'status': data.status,
            'inspector_id': user_id,
            'notes': data.notes
        }
        
        result = db.table('qc_inspections').insert(inspection_dict).execute()
        if not result.data:
            raise Exception("Failed to create inspection")
            
        inspection_id = result.data[0]['id']
        
        # 4. Insert Defects
        if data.defects:
            defects_to_insert = []
            for defect in data.defects:
                defects_to_insert.append({
                    'inspection_id': inspection_id,
                    'defect_type': defect.defect_type,
                    'reason': defect.reason,
                    'quantity': float(defect.quantity),
                    'photo_url': defect.photo_url,
                    'notes': defect.notes
                })
            
            if defects_to_insert:
                db.table('qc_defects').insert(defects_to_insert).execute()
        
        # 5. Update Order Quantities
        passed_qty = float(data.passed_qty)
        scrap_qty = float(data.scrap_qty)
        
        # Calculate new totals
        curr_completed = float(order_data.get('completed_qty') or order_data.get('quantity_completed') or 0)
        curr_rejected = float(order_data.get('rejected_qty') or 0)
        
        new_completed = curr_completed + passed_qty
        new_rejected = curr_rejected + scrap_qty
        
        update_data = {
            ('completed_qty' if target_order_type == 'work_order' else 'quantity_completed'): new_completed,
            'rejected_qty': new_rejected,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Auto-complete if total qty reached
        target_qty = float(order_data.get('target_qty') or order_data.get('quantity') or 0)
        if new_completed + new_rejected >= target_qty:
            update_data['status'] = 'Completed'
            if target_order_type == 'work_order':
                update_data['actual_end'] = datetime.utcnow().isoformat()
                
        db.table('work_orders' if target_order_type == 'work_order' else 'purchase_orders').update(update_data).eq('id', target_order_id).execute()

        # 6. Record Scrap Transaction (Inventory Sync)
        if scrap_qty > 0:
            try:
                # Determine Source Location
                source_location_id = None
                if target_order_type == 'work_order':
                    # Get workstation location
                    wo_details = db.table('work_orders').select('workstation_id').eq('id', target_order_id).single().execute()
                    if wo_details.data and wo_details.data.get('workstation_id'):
                        ws_res = db.table('workstations').select('location_id').eq('id', wo_details.data['workstation_id']).single().execute()
                        if ws_res.data:
                            source_location_id = ws_res.data['location_id']
                
                # Fallback / PO logic: Main Store
                if not source_location_id:
                    # Find 'MAIN-STORE' or first 'store'
                    loc_res = db.table('locations').select('id').eq('code', 'MAIN-STORE').execute()
                    if not loc_res.data:
                        loc_res = db.table('locations').select('id').eq('type', 'store').limit(1).execute()
                    if loc_res.data:
                        source_location_id = loc_res.data[0]['id']

                if source_location_id:
                    await InventoryService.record_transaction(
                        transaction_data=InventoryTransactionCreate(
                            product_id=data.product_id,
                            transaction_type='SCRAP',
                            from_location_id=source_location_id,
                            quantity=Decimal(str(scrap_qty)),
                            reference_id=inspection_id,
                            reference_type='QC_INSPECTION',
                            notes=f"Scrapped during QC {inspection_number}"
                        ),
                        user_id=user_id
                    )
            except Exception as e:
                import logging
                logging.error(f"Failed to record scrap inventory: {e}")

        # 7. Broadcast update via WebSocket
        await manager.broadcast_dashboard_update('qc', {
            'action': 'created',
            'inspection_number': inspection_number,
            'passed': passed_qty,
            'scrap': scrap_qty,
            'order_type': target_order_type,
            'order_id': target_order_id
        })

        return await QCService.get_inspection_by_id(inspection_id)

    @staticmethod
    async def get_inspection_by_id(inspection_id: str) -> QCInspectionResponse:
        """Get full details of an inspection."""
        db = get_db()
        
        # Fetch Inspection
        insp_res = db.table('qc_inspections').select('*').eq('id', inspection_id).execute()
        if not insp_res.data:
            raise NotFoundException(detail="Inspection not found")
        
        inspection = insp_res.data[0]
        
        # Fetch Defects
        defects_res = db.table('qc_defects').select('*').eq('inspection_id', inspection_id).execute()
        
        # Fetch Related Names
        product_res = db.table('products').select('name, code').eq('id', inspection['product_id']).execute()
        product_name = product_res.data[0]['name'] if product_res.data else "Unknown"
        product_code = product_res.data[0]['code'] if product_res.data else "Unknown"
        
        po_number = None
        if inspection.get('purchase_order_id'):
            po_res = db.table('purchase_orders').select('order_number').eq('id', inspection['purchase_order_id']).execute()
            if po_res.data:
                po_number = po_res.data[0]['order_number']
                
        wo_number = None
        if inspection.get('work_order_id'):
            wo_res = db.table('work_orders').select('work_order_number').eq('id', inspection['work_order_id']).execute()
            if wo_res.data:
                wo_number = wo_res.data[0]['work_order_number']

        inspector_name = None
        if inspection.get('inspector_id'):
            user_res = db.table('users').select('full_name, username').eq('id', inspection['inspector_id']).execute()
            if user_res.data:
                inspector_name = user_res.data[0].get('full_name') or user_res.data[0].get('username')

        # Construct Response
        return QCInspectionResponse(
            id=inspection['id'],
            inspection_number=inspection['inspection_number'],
            purchase_order_id=inspection['purchase_order_id'],
            purchase_order_number=po_number,
            work_order_id=inspection['work_order_id'],
            work_order_number=wo_number,
            product_id=inspection['product_id'],
            product_name=product_name,
            product_code=product_code,
            quantity_checked=Decimal(str(inspection['quantity_checked'])),
            passed_qty=Decimal(str(inspection['passed_qty'])),
            rework_qty=Decimal(str(inspection['rework_qty'])),
            scrap_qty=Decimal(str(inspection['scrap_qty'])),
            status=inspection['status'],
            inspector_id=inspection['inspector_id'],
            inspector_name=inspector_name,
            notes=inspection['notes'],
            created_at=datetime.fromisoformat(inspection['created_at'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(inspection['updated_at'].replace('Z', '+00:00')),
            defects=[{**d, 'id': str(d['id']), 'inspection_id': str(d['inspection_id'])} for d in defects_res.data]
        )

    @staticmethod
    async def list_inspections(
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None
    ) -> List[QCInspectionResponse]:
        """List inspections with pagination."""
        db = get_db()
        offset = (page - 1) * limit
        
        query = db.table('qc_inspections').select('id', count='exact')
        if status:
            query = query.eq('status', status)
            
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        inspections = []
        for row in result.data:
            inspections.append(await QCService.get_inspection_by_id(row['id']))
            
        return inspections

    @staticmethod
    async def get_stats() -> QCStats:
        """Get Real Dashboard Stats for QC using SQL."""
        db = get_db()
        
        # 1. Basic Counts
        total_res = db.table('qc_inspections').select('id', count='exact').execute()
        total_inspections = total_res.count if hasattr(total_res, 'count') else 0
        
        today_start = datetime.utcnow().date().isoformat()
        today_res = db.table('qc_inspections').select('id', count='exact').gte('created_at', today_start).execute()
        today_inspections = today_res.count if hasattr(today_res, 'count') else 0
        
        # 2. Aggregates for Pass Rate
        # Since supabase-py doesn't do SUM well, we can fetch the last 100 inspections and calculate
        # Or use a RPC if available. For now, let's pull the last 100 and average.
        recent = db.table('qc_inspections').select('passed_qty, quantity_checked').order('created_at', desc=True).limit(100).execute()
        
        pass_rate = 0.0
        if recent.data:
            total_checked = sum(float(r['quantity_checked']) for r in recent.data)
            total_passed = sum(float(r['passed_qty']) for r in recent.data)
            if total_checked > 0:
                pass_rate = round((total_passed / total_checked) * 100, 2)
        
        # 3. Pending Rework
        # Sum of rework_qty where it hasn't been re-inspected? 
        # Simplified: Current total of rework_qty in last 30 days
        rework_res = db.table('qc_inspections').select('rework_qty').execute()
        pending_rework = sum(int(float(r['rework_qty'])) for r in rework_res.data) if rework_res.data else 0
        
        return QCStats(
            total_inspections=total_inspections or 0,
            today_inspections=today_inspections or 0,
            pending_rework=pending_rework or 0,
            pass_rate=pass_rate
        )

    @staticmethod
    async def lookup_order(order_number: str) -> Dict[str, Any]:
        """
        Lookup a Purchase Order or Working Order by number.
        Returns order details for QC inspection.
        """
        db = get_db()
        order_number = order_number.upper().strip()
        
        # Try Working Order
        wo_result = db.table('work_orders').select('*, products(name, code)').ilike('work_order_number', f'%{order_number}%').limit(1).execute()
        if wo_result.data:
            wo = wo_result.data[0]
            prod = wo.get('products') or {}
            
            return {
                'order_type': 'work_order',
                'order_id': wo['id'],
                'order_number': wo['work_order_number'],
                'product_id': wo['product_id'],
                'product_name': prod.get('name'),
                'product_code': prod.get('code'),
                'quantity': float(wo.get('target_qty', 0)),
                'completed_qty': float(wo.get('completed_qty', 0)),
                'status': wo['status']
            }
        
        # Try Purchase Order
        po_result = db.table('purchase_orders').select('*, products(name, code)').ilike('order_number', f'%{order_number}%').limit(1).execute()
        if po_result.data:
            po = po_result.data[0]
            prod = po.get('products') or {}
            
            return {
                'order_type': 'purchase_order',
                'order_id': po['id'],
                'order_number': po['order_number'],
                'product_id': po['product_id'],
                'product_name': prod.get('name'),
                'product_code': prod.get('code'),
                'quantity': float(po.get('quantity', 0)),
                'completed_qty': float(po.get('quantity_completed', 0)),
                'status': po['status']
            }
        
        raise ValueError(f"Order '{order_number}' not found")

