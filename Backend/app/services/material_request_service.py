from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.schemas.material_request import (
    MaterialRequestCreate, MaterialRequestUpdate, MaterialRequestResponse,
    MaterialRequestListItem, RequestItemResponse, ReviewRequest,
    ApprovalRequest, PickListResponse, PickListItem, QuickRequestTemplate,
    StockAvailabilityCheck, StockAvailabilityResponse
)
from app.core.exceptions import NotFoundException, ValidationException


class MaterialRequestService:
    
    @staticmethod
    def _generate_request_number() -> str:
        """Generate unique request number: MR-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        
        # Get count of requests this year
        result = db.table('material_requests').select('request_number', count='exact').like(
            'request_number', f'MR-{year}-%'
        ).execute()
        
        count = result.count if hasattr(result, 'count') else 0
        next_number = count + 1
        
        return f"MR-{year}-{next_number:04d}"
    
    @staticmethod
    async def check_stock_availability(
        stock_check: StockAvailabilityCheck
    ) -> List[StockAvailabilityResponse]:
        """Check stock availability for requested items"""
        db = get_db()
        
        results = []
        
        for item in stock_check.items:
            # Get product info
            product = db.table('products').select('code', 'name').eq('id', item['product_id']).execute()
            
            if not product.data:
                continue
            
            # Get available stock across all locations
            inv = db.table('inventory').select('available_qty', 'allocated_qty').eq(
                'product_id', item['product_id']
            ).execute()
            
            available_qty = Decimal('0')
            for i in inv.data:
                free = Decimal(str(i['available_qty'])) - Decimal(str(i['allocated_qty']))
                available_qty += free
            
            requested_qty = Decimal(str(item['requested_qty']))
            
            # Determine status
            if available_qty >= requested_qty:
                status = 'Available'
            elif available_qty > 0:
                status = 'Partial'
            else:
                status = 'Shortage'
            
            results.append(StockAvailabilityResponse(
                product_id=item['product_id'],
                product_code=product.data[0]['code'],
                product_name=product.data[0]['name'],
                requested_qty=requested_qty,
                available_qty=available_qty,
                status=status
            ))
        
        return results
    
    @staticmethod
    async def create_request(
        request_data: MaterialRequestCreate,
        user_id: str
    ) -> MaterialRequestResponse:
        """
        Create material request with items.
        Checks stock availability for each item.
        """
        db = get_db()
        
        # Generate request number
        request_number = MaterialRequestService._generate_request_number()
        
        # Create request
        request_dict = {
            'request_number': request_number,
            'department': request_data.department,
            'shift': request_data.shift,
            'request_date': request_data.request_date.isoformat(),
            'required_date': request_data.required_date.isoformat() if request_data.required_date else None,
            'start_time': request_data.start_time.isoformat() if request_data.start_time else None,
            'end_time': request_data.end_time.isoformat() if request_data.end_time else None,
            'delivery_instructions': request_data.delivery_instructions,
            'priority': request_data.priority,
            'reference_order_id': request_data.reference_order_id,
            'requested_by': user_id,
            'requested_by_name': request_data.requested_by_name,
            'reviewed_by_name': request_data.reviewed_by_name,
            'approved_by_name': request_data.approved_by_name,
            'status': 'Pending'
        }
        
        result = db.table('material_requests').insert(request_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create material request")
        
        request_id = result.data[0]['id']
        
        # Create request items with stock availability check
        for item in request_data.items:
            # Check stock availability
            inv = db.table('inventory').select('available_qty', 'allocated_qty').eq(
                'product_id', item.product_id
            ).execute()
            
            available_stock = Decimal('0')
            for i in inv.data:
                free = Decimal(str(i['available_qty'])) - Decimal(str(i['allocated_qty']))
                available_stock += free
            
            requested_qty = item.requested_qty
            
            # Determine availability status
            if available_stock >= requested_qty:
                availability_status = 'Available'
            elif available_stock > 0:
                availability_status = 'Partial'
            else:
                availability_status = 'Shortage'
            
            item_dict = {
                'request_id': request_id,
                'product_id': item.product_id,
                'item_code': item.item_code,
                'material_description': item.material_description,
                'requested_qty': float(item.requested_qty),
                'unit': item.unit,
                'required_date': item.required_date.isoformat() if item.required_date else None,
                'location': item.location,
                'priority': item.priority,
                'availability_status': availability_status,
                'available_stock': float(available_stock),
                'notes': item.notes,
                'status': 'Pending'
            }
            
            db.table('request_items').insert(item_dict).execute()
        
        return await MaterialRequestService.get_request_by_id(request_id)
    
    @staticmethod
    async def list_requests(
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        department: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None
    ) -> List[MaterialRequestListItem]:
        """List material requests with filters"""
        db = get_db()
        
        offset = (page - 1) * limit
        
        query = db.table('material_requests').select('*')
        
        if status:
            query = query.eq('status', status)
        
        if department:
            query = query.eq('department', department)
        
        if start_date:
            query = query.gte('request_date', start_date.isoformat())
        
        if end_date:
            query = query.lte('request_date', end_date.isoformat())
        
        result = query.order('request_date', desc=True).range(offset, offset + limit - 1).execute()
        
        requests = []
        for req in result.data:
            # Get first item or count
            items = db.table('request_items').select('product_id', 'requested_qty').eq(
                'request_id', req['id']
            ).limit(1).execute()
            
            if items.data:
                # Get product name
                product = db.table('products').select('name').eq('id', items.data[0]['product_id']).execute()
                material_name = product.data[0]['name'] if product.data else 'Unknown'
                quantity = Decimal(str(items.data[0]['requested_qty']))
            else:
                material_name = 'No items'
                quantity = Decimal('0')
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if (search_lower not in req['request_number'].lower() and
                    search_lower not in req['department'].lower() and
                    search_lower not in material_name.lower()):
                    continue
            
            requests.append(MaterialRequestListItem(
                id=req['id'],
                request_number=req['request_number'],
                department=req['department'],
                material=material_name,
                quantity=quantity,
                date=datetime.fromisoformat(req['request_date']).date() if isinstance(req['request_date'], str) else req['request_date'],
                status=req['status']
            ))
        
        return requests
    
    @staticmethod
    async def get_request_by_id(request_id: str) -> MaterialRequestResponse:
        """Get material request by ID with all items"""
        db = get_db()
        
        # Get request
        request = db.table('material_requests').select('*').eq('id', request_id).execute()
        
        if not request.data:
            raise NotFoundException(detail="Material request not found")
        
        req = request.data[0]
        
        # Get request items
        items_result = db.table('request_items').select('*').eq('request_id', request_id).execute()
        
        items = []
        for item in items_result.data:
            # Get product info
            product = db.table('products').select('code', 'name').eq('id', item['product_id']).execute()
            
            items.append(RequestItemResponse(
                id=item['id'],
                request_id=item['request_id'],
                product_id=item['product_id'],
                product_code=product.data[0]['code'] if product.data else None,
                product_name=product.data[0]['name'] if product.data else None,
                item_code=item.get('item_code'),
                material_description=item.get('material_description'),
                requested_qty=Decimal(str(item['requested_qty'])),
                approved_qty=Decimal(str(item.get('approved_qty', 0))),
                issued_qty=Decimal(str(item.get('issued_qty', 0))),
                unit=item['unit'],
                required_date=datetime.fromisoformat(item['required_date']).date() if item.get('required_date') else None,
                location=item.get('location'),
                priority=item.get('priority', 'Normal'),
                availability_status=item.get('availability_status'),
                available_stock=Decimal(str(item.get('available_stock', 0))),
                status=item['status'],
                notes=item.get('notes'),
                created_at=datetime.fromisoformat(item['created_at'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(item['updated_at'].replace('Z', '+00:00'))
            ))
        
        return MaterialRequestResponse(
            id=req['id'],
            request_number=req['request_number'],
            department=req['department'],
            shift=req.get('shift'),
            request_date=datetime.fromisoformat(req['request_date']).date() if isinstance(req['request_date'], str) else req['request_date'],
            required_date=datetime.fromisoformat(req['required_date']).date() if req.get('required_date') else None,
            start_time=datetime.fromisoformat(req['start_time'].replace('Z', '+00:00')) if req.get('start_time') else None,
            end_time=datetime.fromisoformat(req['end_time'].replace('Z', '+00:00')) if req.get('end_time') else None,
            delivery_instructions=req.get('delivery_instructions'),
            status=req['status'],
            priority=req.get('priority', 'Normal'),
            reference_order_id=req.get('reference_order_id'),
            requested_by_name=req.get('requested_by_name'),
            reviewed_by_name=req.get('reviewed_by_name'),
            approved_by_name=req.get('approved_by_name'),
            items=items,
            requested_by=req.get('requested_by'),
            reviewed_by=req.get('reviewed_by'),
            approved_by=req.get('approved_by'),
            requested_at=datetime.fromisoformat(req['requested_at'].replace('Z', '+00:00')),
            reviewed_at=datetime.fromisoformat(req['reviewed_at'].replace('Z', '+00:00')) if req.get('reviewed_at') else None,
            approved_at=datetime.fromisoformat(req['approved_at'].replace('Z', '+00:00')) if req.get('approved_at') else None,
            fulfilled_at=datetime.fromisoformat(req['fulfilled_at'].replace('Z', '+00:00')) if req.get('fulfilled_at') else None,
            created_at=datetime.fromisoformat(req['created_at'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(req['updated_at'].replace('Z', '+00:00'))
        )
    
    @staticmethod
    async def review_request(
        request_id: str,
        review: ReviewRequest,
        user_id: str
    ) -> MaterialRequestResponse:
        """Review material request (Store Reviewer)"""
        db = get_db()
        
        # Get request
        request = db.table('material_requests').select('status').eq('id', request_id).execute()
        
        if not request.data:
            raise NotFoundException(detail="Material request not found")
        
        if request.data[0]['status'] != 'Pending':
            raise ValidationException(detail=f"Cannot review request with status: {request.data[0]['status']}")
        
        # Update request
        db.table('material_requests').update({
            'status': 'Reviewed',
            'reviewed_by': user_id,
            'reviewed_at': datetime.utcnow().isoformat()
        }).eq('id', request_id).execute()
        
        return await MaterialRequestService.get_request_by_id(request_id)
    
    @staticmethod
    async def approve_request(
        request_id: str,
        approval: ApprovalRequest,
        user_id: str
    ) -> MaterialRequestResponse:
        """
        Approve material request (full or partial).
        Auto-creates material transfers if enabled.
        """
        db = get_db()
        
        # Get request
        request = db.table('material_requests').select('*').eq('id', request_id).execute()
        
        if not request.data:
            raise NotFoundException(detail="Material request not found")
        
        req = request.data[0]
        
        if req['status'] not in ['Pending', 'Reviewed']:
            raise ValidationException(detail=f"Cannot approve request with status: {req['status']}")
        
        # Update request items
        if approval.approve_all:
            # Approve all items with full quantities
            items = db.table('request_items').select('*').eq('request_id', request_id).execute()
            
            for item in items.data:
                db.table('request_items').update({
                    'approved_qty': item['requested_qty'],
                    'status': 'Approved'
                }).eq('id', item['id']).execute()
            
            request_status = 'Approved'
        else:
            # Partial approval with specific quantities
            has_partial = False
            has_full = False
            
            for item_approval in approval.item_approvals or []:
                item_id = item_approval['item_id']
                approved_qty = Decimal(str(item_approval['approved_qty']))
                
                # Get item
                item = db.table('request_items').select('*').eq('id', item_id).execute()
                
                if item.data:
                    requested_qty = Decimal(str(item.data[0]['requested_qty']))
                    
                    if approved_qty == 0:
                        item_status = 'Rejected'
                    elif approved_qty < requested_qty:
                        item_status = 'Partially Approved'
                        has_partial = True
                    else:
                        item_status = 'Approved'
                        has_full = True
                    
                    db.table('request_items').update({
                        'approved_qty': float(approved_qty),
                        'status': item_status
                    }).eq('id', item_id).execute()
            
            if has_partial:
                request_status = 'Partially Approved'
            elif has_full:
                request_status = 'Approved'
            else:
                request_status = 'Rejected'
        
        # Update request
        db.table('material_requests').update({
            'status': request_status,
            'approved_by': user_id,
            'approved_at': datetime.utcnow().isoformat()
        }).eq('id', request_id).execute()
        
        # Auto-create material transfers if enabled
        if approval.auto_create_transfer and request_status in ['Approved', 'Partially Approved']:
            await MaterialRequestService._auto_create_transfers(request_id, user_id)
        
        return await MaterialRequestService.get_request_by_id(request_id)
    
    @staticmethod
    async def _auto_create_transfers(request_id: str, user_id: str):
        """Auto-create material transfers for approved items"""
        db = get_db()
        
        # Get request details
        request = db.table('material_requests').select('*').eq('id', request_id).execute()
        
        if not request.data:
            return
        
        req = request.data[0]
        
        # Get approved items
        items = db.table('request_items').select('*').eq('request_id', request_id).in_(
            'status', ['Approved', 'Partially Approved']
        ).execute()
        
        # Get default source location (Main Store)
        from_location = db.table('locations').select('id').eq('code', 'STORE-01').execute()
        
        if not from_location.data:
            return
        
        from_location_id = from_location.data[0]['id']
        
        # Create transfer for each item
        for item in items.data:
            if Decimal(str(item['approved_qty'])) > 0:
                # Find destination location based on department
                to_location = db.table('locations').select('id').ilike('name', f"%{req['department']}%").execute()
                
                if to_location.data:
                    to_location_id = to_location.data[0]['id']
                    
                    # Generate transfer number
                    from app.services.material_transfer_service import MaterialTransferService
                    transfer_number = MaterialTransferService._generate_transfer_number()
                    
                    # Create transfer
                    db.table('material_transfers').insert({
                        'transfer_number': transfer_number,
                        'product_id': item['product_id'],
                        'from_location_id': from_location_id,
                        'to_location_id': to_location_id,
                        'quantity': float(item['approved_qty']),
                        'unit': item['unit'],
                        'priority': req.get('priority', 'Normal'),
                        'reason': f"Material Request {req['request_number']}",
                        'reference_order_id': req.get('reference_order_id'),
                        'status': 'Approved',  # Auto-approved
                        'transfer_type': 'Material Request',
                        'requested_by': user_id,
                        'approved_by': user_id,
                        'approved_at': datetime.utcnow().isoformat()
                    }).execute()
    
    @staticmethod
    async def reject_request(request_id: str, notes: Optional[str], user_id: str) -> dict:
        """Reject material request"""
        db = get_db()
        
        request = db.table('material_requests').select('status').eq('id', request_id).execute()
        
        if not request.data:
            raise NotFoundException(detail="Material request not found")
        
        if request.data[0]['status'] not in ['Pending', 'Reviewed']:
            raise ValidationException(detail=f"Cannot reject request with status: {request.data[0]['status']}")
        
        # Update request
        db.table('material_requests').update({
            'status': 'Rejected',
            'approved_by': user_id,
            'approved_at': datetime.utcnow().isoformat()
        }).eq('id', request_id).execute()
        
        # Update all items to rejected
        db.table('request_items').update({
            'status': 'Rejected'
        }).eq('request_id', request_id).execute()
        
        return {"message": "Material request rejected"}
    
    @staticmethod
    async def generate_pick_list(request_id: str) -> PickListResponse:
        """Generate pick list for approved request"""
        db = get_db()
        
        # Get request
        request = await MaterialRequestService.get_request_by_id(request_id)
        
        if request.status not in ['Approved', 'Partially Approved']:
            raise ValidationException(detail="Can only generate pick list for approved requests")
        
        # Get approved items
        pick_items = []
        for item in request.items:
            if item.approved_qty > 0:
                pick_items.append(PickListItem(
                    item_code=item.item_code or item.product_code or '',
                    material_name=item.product_name or '',
                    requested_qty=item.requested_qty,
                    approved_qty=item.approved_qty,
                    unit=item.unit,
                    location=item.location or 'Main Store',
                    picked=False
                ))
        
        return PickListResponse(
            request_number=request.request_number,
            department=request.department,
            shift=request.shift,
            requested_by=request.requested_by_name or 'Unknown',
            approved_by=request.approved_by_name or 'Unknown',
            items=pick_items,
            generated_at=datetime.utcnow()
        )
    
    @staticmethod
    async def get_quick_templates() -> List[QuickRequestTemplate]:
        """Get quick request templates for quick actions"""
        db = get_db()
        
        templates = db.table('quick_request_templates').select('*').eq('is_active', True).execute()
        
        result = []
        for tmpl in templates.data:
            # Get product info
            product = db.table('products').select('code', 'name').eq('id', tmpl['product_id']).execute()
            
            result.append(QuickRequestTemplate(
                id=tmpl['id'],
                name=tmpl['name'],
                product_id=tmpl['product_id'],
                product_code=product.data[0]['code'] if product.data else None,
                product_name=product.data[0]['name'] if product.data else None,
                default_quantity=Decimal(str(tmpl['default_quantity'])),
                unit=tmpl['unit'],
                destination_location=tmpl.get('destination_location'),
                department=tmpl.get('department')
            ))
        
        return result


# Singleton instance
material_request_service = MaterialRequestService()