from datetime import datetime, date, timedelta
from typing import List, Optional
from decimal import Decimal
import qrcode
import io
import base64
import json
from app.database import get_db
from app.schemas.purchase_order import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListItem, OrderMaterialResponse, OrderStatusUpdate,
    OrderAssignment, OrderAssignmentResponse, OrderProgress,
    MaterialAllocationRequest, PurchaseOrderValidation,
    PurchaseOrderMultiSKUCreate, POItemResponse, OrderMaterialWithShortage,
    MaterialRequirement, TeamAssignment, PurchaseOrderWithShortages,
    PurchaseOrderValidation # Added
)
from app.core.exceptions import NotFoundException, ValidationException


class PurchaseOrderService:  # Changed from ProductionOrderService
    
    @staticmethod
    def _generate_order_number() -> str:
        """Generate unique order number: PO-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        
        # Get count of orders this year
        result = db.table('purchase_orders').select('order_number', count='exact').like(
            'order_number', f'PO-{year}-%'
        ).execute()
        
        count = result.count or 0
        return f"PO-{year}-{count + 1:04d}"
    
    @staticmethod
    def _generate_qr_code(data: str) -> str:
        """Generate QR code as base64 string"""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    @staticmethod
    async def list_purchase_orders(
        page: int = 1,
        limit: int = 10,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        product_id: Optional[str] = None,
        overdue_only: bool = False,
        search: Optional[str] = None
    ) -> List[PurchaseOrderListItem]:
        """List purchase orders with filters"""
        try:
            db = get_db()
            
            # Input validation
            if page < 1:
                raise ValidationException(detail="Page must be greater than 0")
            if limit < 1 or limit > 100:
                raise ValidationException(detail="Limit must be between 1 and 100")
            
            # Join with products to get code/name
            query = db.table('purchase_orders').select('*, products(code, name)')
            
            # Apply filters
            if status:
                query = query.eq('status', status)
            if priority:
                query = query.eq('priority', priority)
            if product_id:
                query = query.eq('product_id', product_id)
            if overdue_only:
                query = query.lt('due_date', date.today().isoformat())
                query = query.neq('status', 'Completed')
            
            # Apply search
            if search:
                search = f"%{search}%"
                # Searching in joined table requires embedding logic, but for simplicity
                # we'll search locally or just rely on order_number.
                # Supabase filter on joined columns is tricky with simple syntax.
                # Let's search order_number only for now to ensure stability.
                query = query.ilike('order_number', search)
            
            # Add pagination
            query = query.order('created_at', desc=True).range(
                (page - 1) * limit, 
                page * limit - 1
            )
            
            result = query.execute()
            
            orders = []
            for order in result.data:
                try:
                    product_data = order.get('products', {}) or {}
                    product_code = product_data.get('code', '')
                    product_name = product_data.get('name', 'Unknown')

                    if not product_code or not product_name:
                        product_lookup = db.table('products').select('code', 'name').eq('id', order.get('product_id')).execute()
                        if product_lookup.data:
                            product_row = product_lookup.data[0]
                            product_code = product_code or product_row.get('code')
                            product_name = product_name or product_row.get('name')

                    product_name = product_name or 'Unknown Product'
                    product_code = product_code or ''

                    materials_status = order.get('materials_status')
                    if not materials_status:
                        materials_status = PurchaseOrderService._derive_materials_status(db, order.get('id'))

                    progress_percentage = PurchaseOrderService._derive_progress_percentage(order)

                    # Get order items
                    items_result = db.table('purchase_order_items').select('*').eq('purchase_order_id', order.get('id')).execute()
                    items = []
                    for item in items_result.data:
                        try:
                            items.append(POItemResponse(
                                id=item.get('id'),
                                product_id=item.get('product_id'),
                                purchase_order_id=order.get('id'),
                                quantity=Decimal(str(item.get('quantity', 0))),
                                unit=item.get('unit', 'pcs'),
                                notes=item.get('notes'),
                                created_at=PurchaseOrderService._parse_datetime(item.get('created_at')),
                                updated_at=PurchaseOrderService._parse_datetime(item.get('updated_at'))
                            ))
                        except Exception as e:
                            print(f"Error processing item {item.get('id')}: {str(e)}")
                    
                    # Calculate days until due with error handling
                    try:
                        due_date = PurchaseOrderService._parse_datetime(order.get('due_date')).date() if order.get('due_date') else date.today()
                        days_until_due = (due_date - date.today()).days
                        is_overdue = days_until_due < 0 and order.get('status') not in ['Completed', 'Cancelled']
                    except Exception as e:
                        print(f"Error calculating due date for order {order.get('id')}: {str(e)}")
                        days_until_due = 0
                        is_overdue = False
                    
                    # Create order response
                    order_response = PurchaseOrderListItem(
                        id=order.get('id'),
                        order_number=order.get('order_number', ''),
                        product_id=order.get('product_id'),
                        product_code=product_code,
                        product_name=product_name,
                        quantity=Decimal(str(order.get('quantity', 0))),
                        unit=order.get('unit', 'pcs'),
                        due_date=due_date,
                        priority=order.get('priority', 'Medium'),
                        status=order.get('status', 'Draft'),
                        materials_status=materials_status,
                        days_until_due=days_until_due,
                        is_overdue=is_overdue,
                        items=items,
                        progress_percentage=progress_percentage,
                        created_at=PurchaseOrderService._parse_datetime(order.get('created_at'))
                    )
                    
                    orders.append(order_response)
                    
                except Exception as e:
                    print(f"Error processing order {order.get('id')}: {str(e)}")
                    continue
            
            return orders
            
        except Exception as e:
            print(f"Error in list_purchase_orders: {str(e)}")
            raise

    @staticmethod
    def _derive_materials_status(db, order_id: str) -> str:
        if not order_id:
            return 'Pending'

        try:
            materials_result = (
                db.table('order_materials')
                .select('availability_status')
                .eq('purchase_order_id', order_id)
                .execute()
            )
        except Exception:
            materials_result = None

        if not materials_result or not materials_result.data:
            return 'No Materials'

        total = len(materials_result.data)
        available = 0
        shortage = 0
        for mat in materials_result.data:
            status = mat.get('availability_status', '').upper()
            if status == 'AVAILABLE':
                available += 1
            if status in ['SHORTAGE', 'PARTIAL']:
                shortage += 1

        if shortage > 0:
            return 'Material Shortage'
        if available == total:
            return 'All Available'
        return 'Partially Available'

    @staticmethod
    def _derive_progress_percentage(order_row: dict) -> float:
        raw_progress = order_row.get('progress_percentage')
        if raw_progress is not None:
            try:
                return float(raw_progress)
            except (TypeError, ValueError):
                pass

        status = (order_row.get('status') or '').lower()
        status_map = {
            'planned': 5,
            'in progress': 60,
            'on hold': 35,
            'completed': 100,
            'cancelled': 0
        }
        return float(status_map.get(status, 0))

    @staticmethod
    async def create_purchase_order(
        order_data: PurchaseOrderCreate,
        user_id: str
    ) -> PurchaseOrderResponse:
        """Create purchase order with automatic material calculation from BOM."""
        db = get_db()
        
        # Get product details
        product = db.table('products').select('*').eq('id', order_data.product_id).execute()
        if not product.data:
            raise NotFoundException(detail=f"Product with ID {order_data.product_id} not found")
        
        product = product.data[0]
        
        # Get BOM for the product
        bom = db.table('boms').select('*').eq('product_id', order_data.product_id).eq('is_active', True).execute()
        if not bom.data:
            raise ValidationException(detail=f"No active BOM found for product {product.get('name')}")
        
        bom_id = bom.data[0]['id']
        
        # Generate order number and QR code
        order_number = PurchaseOrderService._generate_order_number()
        qr_code = PurchaseOrderService._generate_qr_code(order_number)
        
        # Create purchase order
        order_dict = {
            'order_number': order_number,
            'product_id': order_data.product_id,
            # 'product_code': product.get('code'), # Removed as not in DB
            # 'product_name': product.get('name'), # Removed as not in DB
            'quantity': float(order_data.quantity),
            'unit': product.get('unit', 'pcs'),
            'due_date': order_data.due_date.isoformat(),
            'priority': order_data.priority,
            'status': 'Planned',
            'qr_code': qr_code,
            'bom_id': bom_id,
            'notes': order_data.notes,
            'customer_name': order_data.customer_name,
            'shift_number': order_data.shift_number,
            'created_by': user_id,
            'updated_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Add optional fields if provided
        if order_data.start_time:
            order_dict['start_time'] = order_data.start_time.isoformat()
        if order_data.end_time:
            order_dict['end_time'] = order_data.end_time.isoformat()
        
        # Insert order
        order_result = db.table('purchase_orders').insert(order_dict).execute()
        created_order = order_result.data[0]
        
        # Calculate material requirements from BOM
        await PurchaseOrderService._calculate_material_requirements(
            order_id=created_order['id'],
            product_id=order_data.product_id,
            quantity=order_data.quantity,
            bom_id=bom_id
        )
        
        return await PurchaseOrderService.get_order_by_id(created_order['id'])
    
    @staticmethod
    async def create_multi_sku_order(
        order_data: PurchaseOrderMultiSKUCreate,
        user_id: str
    ) -> PurchaseOrderResponse:
        """Create a purchase order that bundles multiple SKU lines."""
        if not order_data.items:
            raise ValidationException(detail="At least one SKU item is required")

        db = get_db()
        material_totals: dict[str, dict[str, Decimal | str]] = {}
        sku_entries = []
        total_quantity = Decimal('0')
        summary_parts: list[str] = []

        for idx, item in enumerate(order_data.items, start=1):
            item_quantity = Decimal(str(item.quantity))
            if item_quantity <= 0:
                raise ValidationException(detail="SKU item quantity must be greater than zero")

            product_result = db.table('products').select('*').eq('id', item.product_id).execute()
            if not product_result.data:
                raise NotFoundException(detail=f"Product with ID {item.product_id} not found")
            product_row = product_result.data[0]
            if product_row.get('category') != 'Finished Goods':
                raise ValidationException(detail=f"Product {product_row.get('code')} is not a finished good")

            bom_result = db.table('boms').select('id').eq('product_id', item.product_id).eq('is_active', True).execute()
            if not bom_result.data:
                raise ValidationException(detail=f"No active BOM found for product {product_row.get('name')}")
            bom_id = bom_result.data[0]['id']

            bom_items = db.table('bom_materials').select('*').eq('bom_id', bom_id).execute()
            for bom_item in bom_items.data:
                material_id = bom_item['material_id']
                bom_quantity = Decimal(str(bom_item['quantity']))
                scrap_pct = Decimal(str(bom_item.get('scrap_percentage', 0)))
                required_qty = bom_quantity * item_quantity * (Decimal('1') + scrap_pct / Decimal('100'))
                unit = bom_item.get('unit', 'pcs')
                unit_cost = Decimal(str(bom_item.get('unit_cost', 0)))

                if material_id not in material_totals:
                    material_totals[material_id] = {
                        'required_qty': required_qty,
                        'unit': unit,
                        'scrap_percentage': scrap_pct
                    }
                else:
                    material_totals[material_id]['required_qty'] += required_qty

            sku_entries.append({
                'product': product_row,
                'quantity': item_quantity,
                'unit': product_row.get('unit', 'pcs'),
                'notes': item.notes
            })
            total_quantity += item_quantity
            summary_parts.append(f"{product_row.get('code')} ({item_quantity} {product_row.get('unit', 'pcs')})")

        primary_product = sku_entries[0]['product']
        product_name = primary_product.get('name', 'Multi-SKU Order')
        if len(sku_entries) > 1:
            product_name = f"{product_name} (+{len(sku_entries) - 1} SKU{'s' if len(sku_entries) - 1 > 1 else ''})"

        order_number = PurchaseOrderService._generate_order_number()
        qr_code = PurchaseOrderService._generate_qr_code(order_number)

        summary_text = "Multi-SKU Items: " + ", ".join(summary_parts)
        combined_notes = order_data.notes or ''
        combined_notes = (combined_notes + '\n\n' + summary_text).strip()

        order_dict = {
            'order_number': order_number,
            'product_id': primary_product.get('id'),
            # 'product_code': primary_product.get('code'), # Removed
            # 'product_name': product_name, # Removed
            'quantity': float(total_quantity),
            'unit': primary_product.get('unit', 'pcs'),
            'due_date': order_data.due_date.isoformat(),
            'priority': order_data.priority,
            'status': 'Planned',
            'qr_code': qr_code,
            'bom_id': None,
            'notes': combined_notes,
            'customer_name': order_data.customer_name,
            'shift_number': order_data.shift_number,
            'created_by': user_id,
            'updated_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        if order_data.start_time:
            order_dict['start_time'] = order_data.start_time.isoformat()
        if order_data.end_time:
            order_dict['end_time'] = order_data.end_time.isoformat()

        order_result = db.table('purchase_orders').insert(order_dict).execute()
        created_order = order_result.data[0]

        # Persist SKU line items
        order_item_payload = []
        for sku_entry, item_payload in zip(sku_entries, order_data.items):
            order_item_payload.append({
                'purchase_order_id': created_order['id'],
                'product_id': sku_entry['product']['id'],
                'quantity': float(sku_entry['quantity']),
                'unit': sku_entry['unit'],
                'notes': item_payload.notes
            })
        if order_item_payload:
            db.table('purchase_order_items').insert(order_item_payload).execute()

        # Persist aggregated material requirements
        for material_id, info in material_totals.items():
            db.table('order_materials').insert({
                'purchase_order_id': created_order['id'],
                'product_id': material_id,
                'required_qty': float(info['required_qty']),
                'allocated_qty': 0.0,
                'issued_qty': 0.0,
                'unit': info['unit'],
                'availability_status': 'SHORTAGE',
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }).execute()

        # Initialize WIP Board tracking - place order in first stage
        try:
            await PurchaseOrderService._initialize_wip_board_tracking(created_order['id'], user_id)
        except Exception as e:
            # Log error but don't fail order creation
            print(f"Failed to initialize WIP Board tracking for order {created_order['id']}: {str(e)}")

        return await PurchaseOrderService.get_order_by_id(created_order['id'])
    
    @staticmethod
    async def _initialize_wip_board_tracking(order_id: str, user_id: str) -> None:
        """Initialize WIP Board tracking by placing order in the first stage (Material Planning)"""
        from app.services.wip_board_service import wip_board_service
        
        db = get_db()
        
        # Get the first stage (Material Planning)
        stages = await wip_board_service.list_stages()
        first_stage = next((s for s in stages if s.sequence_number == 1), None)
        if not first_stage:
            return
            
        # Get order quantity
        order_result = db.table('purchase_orders').select('quantity', 'unit').eq('id', order_id).execute()
        if not order_result.data:
            return
            
        order = order_result.data[0]
        quantity = order['quantity']
        unit = order.get('unit', 'pcs')
        
        # Place order in first stage
        transfer_payload = {
            'purchase_order_id': order_id,
            'from_stage_id': None,  # Starting from nothing
            'to_stage_id': first_stage.id,
            'quantity': quantity,
            'unit': unit,
            'notes': 'Order initialized in Material Planning stage'
        }
        
        try:
            await wip_board_service.record_transfer(transfer_payload, user_id)
        except Exception as e:
            # Log error but don't fail order creation
            print(f"Failed to initialize WIP Board tracking for order {order_id}: {str(e)}")
    
    @staticmethod
    async def _calculate_material_requirements(
        order_id: str,
        product_id: str,
        quantity: Decimal,
        bom_id: str
    ) -> None:
        """Calculate and save material requirements for an order."""
        db = get_db()
        
        # Get BOM items
        bom_items = db.table('bom_materials').select('*').eq('bom_id', bom_id).execute()
        
        for item in bom_items.data:
            # Calculate required quantity
            required_qty = Decimal(str(item['quantity'])) * quantity
            
            # Get current stock
            stock = db.table('inventory').select('*').eq('product_id', item['material_id']).execute()
            available_qty = Decimal('0')
            
            if stock.data:
                available_qty = Decimal(str(stock.data[0].get('quantity', 0)))
            
            # Create material requirement
            material_data = {
                'purchase_order_id': order_id,
                'product_id': item['material_id'],
                'required_qty': float(required_qty),
                'allocated_qty': 0.0,
                'issued_qty': 0.0,
                'unit': item.get('unit', 'pcs'),
                'availability_status': 'SHORTAGE',
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Insert material requirement
            db.table('order_materials').insert(material_data).execute()
    
    @staticmethod
    async def get_order_by_id(order_id: str) -> PurchaseOrderResponse:
        """Get purchase order by ID with all related data."""
        db = get_db()
        
        # Get order with product details
        order_result = db.table('purchase_orders').select('*, products(code, name)').eq('id', order_id).execute()
        if not order_result.data:
            raise NotFoundException(detail=f"Purchase order {order_id} not found")
        
        order = order_result.data[0]
        product_data = order.get('products', {}) or {}
        
        # Get order materials
        materials_result = db.table('order_materials').select('*').eq('purchase_order_id', order_id).execute()
        materials = []
        
        for mat in materials_result.data:
            # Get material details
            product = db.table('products').select('code', 'name').eq('id', mat['product_id']).execute()
            
            materials.append(OrderMaterialResponse(
                id=mat['id'],
                purchase_order_id=mat['purchase_order_id'],
                material_id=mat['product_id'],
                material_code=product.data[0]['code'] if product.data else '',
                material_name=product.data[0]['name'] if product.data else 'Unknown',
                required_qty=Decimal(str(mat['required_qty'])),
                allocated_qty=Decimal(str(mat.get('allocated_qty', 0))),
                issued_qty=Decimal(str(mat.get('issued_qty', 0))),
                unit=mat.get('unit', 'pcs'),
                availability_status=mat.get('availability_status', 'SHORTAGE'),
                created_at=PurchaseOrderService._parse_datetime(mat.get('created_at')),
                updated_at=PurchaseOrderService._parse_datetime(mat.get('updated_at'))
            ))
        
        # Get order items
        items_result = db.table('purchase_order_items').select('*').eq('purchase_order_id', order_id).execute()
        items = []
        
        for item in items_result.data:
            # Get product details
            product = db.table('products').select('code', 'name').eq('id', item['product_id']).execute()
            
            items.append(POItemResponse(
                id=item['id'],
                purchase_order_id=item['purchase_order_id'],
                product_id=item['product_id'],
                product_code=product.data[0]['code'] if product.data else '',
                product_name=product.data[0]['name'] if product.data else 'Unknown',
                quantity=Decimal(str(item['quantity'])),
                unit=item.get('unit', 'pcs'),
                notes=item.get('notes'),
                created_at=PurchaseOrderService._parse_datetime(item.get('created_at')),
                updated_at=PurchaseOrderService._parse_datetime(item.get('updated_at'))
            ))
        
        # Get team assignments
        team = await PurchaseOrderService.get_team_assignments(order_id)
        
        # Calculate progress
        progress = await PurchaseOrderService.get_order_progress(order_id)
        
        # Create response
        return PurchaseOrderResponse(
            id=order['id'],
            order_number=order['order_number'],
            product_id=order['product_id'],
            product_code=product_data.get('code'),
            product_name=product_data.get('name'),
            quantity=Decimal(str(order['quantity'])),
            unit=order.get('unit', 'pcs'),
            due_date=PurchaseOrderService._parse_datetime(order.get('due_date')).date() if order.get('due_date') else None,
            priority=order.get('priority', 'Medium'),
            status=order.get('status', 'Draft'),
            notes=order.get('notes'),
            customer_name=order.get('customer_name'),
            shift_number=order.get('shift_number'),
            qr_code=order.get('qr_code'),
            bom_id=order.get('bom_id'),
            materials=materials,
            items=items,
            team=team,
            progress_percentage=progress.allocation_percentage if progress else 0,
            started_at=PurchaseOrderService._parse_datetime(order.get('start_date')) if order.get('start_date') else None,
            completed_at=PurchaseOrderService._parse_datetime(order.get('completion_date')) if order.get('completion_date') else None,
            created_at=PurchaseOrderService._parse_datetime(order.get('created_at')),
            updated_at=PurchaseOrderService._parse_datetime(order.get('updated_at')),
            created_by=order.get('created_by'),
            updated_by=order.get('updated_by')
        )
    
    @staticmethod
    def _parse_datetime(dt_str):
        """Safely parse datetime from various formats"""
        if not dt_str:
            return datetime.utcnow()
        
        # Convert to string if it's not already
        dt_str = str(dt_str)
        
        # Handle different formats
        try:
            # Try ISO format with Z
            if dt_str.endswith('Z'):
                return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            # Try ISO format without Z
            elif 'T' in dt_str and ('+' in dt_str or '-' in dt_str):
                return datetime.fromisoformat(dt_str)
            # Try just date format
            else:
                return datetime.fromisoformat(dt_str + 'T00:00:00+00:00')
        except (ValueError, TypeError):
            # Fallback to current time
            return datetime.utcnow()
    
    @staticmethod
    async def update_order_status(
        order_id: str,
        status_data: OrderStatusUpdate,
        user_id: str
    ) -> PurchaseOrderResponse:
        """Update only the status (and optional notes) for an order."""
        db = get_db()

        existing = db.table('purchase_orders').select('id', 'status', 'start_date', 'completion_date').eq('id', order_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Purchase order not found")

        current_status = existing.data[0]['status']

        if status_data.status not in ['Planned', 'In Progress', 'Completed', 'Cancelled']:
            raise ValidationException(detail=f"Unsupported status '{status_data.status}'")

        if current_status == 'Completed' and status_data.status != 'Completed':
            raise ValidationException(detail="Completed orders cannot be moved back to another status")

        update_dict = {
            'status': status_data.status,
            'updated_by': user_id,
            'updated_at': datetime.utcnow().isoformat()
        }

        if status_data.notes is not None:
            update_dict['notes'] = status_data.notes

        if status_data.status == 'In Progress' and not existing.data[0].get('start_date'):
            update_dict['start_date'] = datetime.utcnow().isoformat()
        elif status_data.status == 'Completed':
            update_dict['completion_date'] = datetime.utcnow().isoformat()
            update_dict['progress_percentage'] = 100

        db.table('purchase_orders').update(update_dict).eq('id', order_id).execute()

        return await PurchaseOrderService.get_order_by_id(order_id)
    
    @staticmethod
    async def duplicate_purchase_order(order_id: str, user_id: str) -> PurchaseOrderResponse:
        """Duplicate an existing purchase order."""
        existing = await PurchaseOrderService.get_order_by_id(order_id)
        
        # Create new order data
        new_order_number = PurchaseOrderService._generate_order_number()
        new_due_date = (date.today() + timedelta(days=7)).isoformat()
        
        db = get_db()
        order_dict = {
            'order_number': new_order_number,
            'product_id': existing.product_id,
            # 'product_code': existing.product_code, # Removed
            # 'product_name': existing.product_name, # Removed
            'quantity': float(existing.quantity),
            'unit': existing.unit,
            'due_date': new_due_date,
            'priority': existing.priority,
            'status': 'Planned',
            'qr_code': PurchaseOrderService._generate_qr_code(new_order_number),
            'bom_id': existing.bom_id,
            'notes': f"Duplicated from {existing.order_number}\n{existing.notes or ''}",
            'customer_name': existing.customer_name,
            'shift_number': existing.shift_number,
            'created_by': user_id,
            'updated_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        result = db.table('purchase_orders').insert(order_dict).execute()
        new_order = result.data[0]
        
        # If it was a multi-SKU order, duplicate items
        if existing.items:
            item_payloads = []
            for item in existing.items:
                item_payloads.append({
                    'purchase_order_id': new_order['id'],
                    'product_id': item.product_id,
                    'quantity': float(item.quantity),
                    'unit': item.unit,
                    'notes': item.notes
                })
            db.table('purchase_order_items').insert(item_payloads).execute()
            
        # Re-derive material requirements
        if existing.bom_id:
            await PurchaseOrderService._calculate_material_requirements(
                order_id=new_order['id'],
                product_id=existing.product_id,
                quantity=existing.quantity,
                bom_id=existing.bom_id
            )
        
        return await PurchaseOrderService.get_order_by_id(new_order['id'])

    @staticmethod
    async def update_purchase_order(order_id: str, update_data: PurchaseOrderUpdate, user_id: str) -> PurchaseOrderResponse:
        """Update purchase order (only if status is Planned/Draft)."""
        db = get_db()
        existing = db.table('purchase_orders').select('status', 'quantity', 'product_id', 'bom_id').eq('id', order_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Purchase order not found")
            
        order = existing.data[0]
        if order['status'] not in ['Planned', 'Draft', 'DRAFT', 'PLANNED']:
             raise ValidationException(detail=f"Cannot update order in '{order['status']}' status")
             
        update_dict = update_data.model_dump(exclude_unset=True)
        if 'due_date' in update_dict and update_dict['due_date']:
            update_dict['due_date'] = update_dict['due_date'].isoformat()
            
        update_dict['updated_by'] = user_id
        update_dict['updated_at'] = datetime.utcnow().isoformat()
        
        db.table('purchase_orders').update(update_dict).eq('id', order_id).execute()
        
        # If quantity changed, recalculate materials
        if 'quantity' in update_dict and order['bom_id']:
            # Delete old requirements
            db.table('order_materials').delete().eq('purchase_order_id', order_id).execute()
            # Recalculate
            await PurchaseOrderService._calculate_material_requirements(
                order_id=order_id,
                product_id=order['product_id'],
                quantity=Decimal(str(update_dict['quantity'])),
                bom_id=order['bom_id']
            )
            
        return await PurchaseOrderService.get_order_by_id(order_id)

    @staticmethod
    async def archive_purchase_order(order_id: str, user_id: str) -> PurchaseOrderResponse:
        """Archive a purchase order."""
        db = get_db()
        update_dict = {
            'is_archived': True,
            'archived_at': datetime.utcnow().isoformat(),
            'archived_by': user_id,
            'updated_by': user_id,
            'updated_at': datetime.utcnow().isoformat()
        }
        db.table('purchase_orders').update(update_dict).eq('id', order_id).execute()
        return await PurchaseOrderService.get_order_by_id(order_id)

    @staticmethod
    async def cancel_purchase_order(order_id: str, user_id: str) -> PurchaseOrderResponse:
        """Cancel purchase order."""
        return await PurchaseOrderService.update_order_status(
            order_id=order_id, 
            status_data=OrderStatusUpdate(status='Cancelled', notes='Order cancelled by user'),
            user_id=user_id
        )

    @staticmethod
    async def validate_production_feasibility(
        product_id: str, 
        quantity: Decimal, 
        target_location_id: Optional[str] = None
    ) -> PurchaseOrderValidation:
        """Validate if purchase order can be fulfilled with current inventory."""
        db = get_db()
        
        product = db.table('products').select('code', 'name').eq('id', product_id).execute()
        if not product.data:
            raise NotFoundException(detail="Product not found")
            
        bom = db.table('boms').select('id').eq('product_id', product_id).eq('is_active', True).execute()
        if not bom.data:
            raise ValidationException(detail="No active BOM found")
            
        bom_materials = db.table('bom_materials').select('*').eq('bom_id', bom.data[0]['id']).execute()
        
        materials_with_shortage = []
        can_produce = True
        total_materials = len(bom_materials.data)
        sufficient_materials = 0
        
        for item in bom_materials.data:
            required = Decimal(str(item['quantity'])) * quantity
            
            # Get stock
            stock_query = db.table('inventory').select('quantity').eq('product_id', item['material_id'])
            if target_location_id:
                stock_query = stock_query.eq('location_id', target_location_id)
            
            stock_res = stock_query.execute()
            available = sum(Decimal(str(s['quantity'])) for s in stock_res.data) if stock_res.data else Decimal('0')
            
            shortage = required - available
            if shortage < 0: shortage = Decimal('0')
            
            if shortage > 0:
                can_produce = False
            else:
                sufficient_materials += 1
                
            mat_product = db.table('products').select('code', 'name').eq('id', item['material_id']).execute()
            
            materials_with_shortage.append(OrderMaterialWithShortage(
                material_id=item['material_id'],
                material_code=mat_product.data[0]['code'] if mat_product.data else '',
                material_name=mat_product.data[0]['name'] if mat_product.data else '',
                required_qty=required,
                unit=item.get('unit', 'pcs'),
                available_qty=available,
                shortage_qty=shortage,
                shortage_status='SHORTAGE' if shortage > 0 else 'AVAILABLE'
            ))
            
        return PurchaseOrderValidation(
            can_produce=can_produce,
            product_id=product_id,
            product_code=product.data[0]['code'],
            product_name=product.data[0]['name'],
            quantity=quantity,
            total_materials=total_materials,
            sufficient_materials=sufficient_materials,
            shortage_materials=total_materials - sufficient_materials,
            materials=materials_with_shortage,
            summary={
                'can_produce': can_produce,
                'shortage_count': total_materials - sufficient_materials
            }
        )
    
    @staticmethod
    async def get_order_materials(order_id: str) -> List[MaterialRequirement]:
        """Return detailed material requirements for an order."""
        db = get_db()

        order = db.table('purchase_orders').select('id').eq('id', order_id).execute()
        if not order.data:
            raise NotFoundException(detail="Purchase order not found")

        materials_result = db.table('order_materials').select('*').eq('order_id', order_id).execute()
        materials = []

        for mat in materials_result.data:
            product = db.table('products').select('code', 'name').eq('id', mat['product_id']).execute()
            required_qty = Decimal(str(mat['required_qty']))
            allocated_qty = Decimal(str(mat.get('allocated_qty', 0)))
            issued_qty = Decimal(str(mat.get('issued_qty', 0)))
            available_qty = Decimal(str(mat.get('available_qty', allocated_qty)))
            shortage_qty = required_qty - available_qty
            if shortage_qty < 0:
                shortage_qty = Decimal('0')

            materials.append(MaterialRequirement(
                material_id=mat['product_id'],
                material_code=product.data[0]['code'] if product.data else '',
                material_name=product.data[0]['name'] if product.data else '',
                required_qty=required_qty,
                unit=mat['unit'],
                available_qty=available_qty,
                allocated_qty=allocated_qty,
                issued_qty=issued_qty,
                shortage_qty=shortage_qty,
                availability_status=mat.get('availability_status', 'SHORTAGE')
            ))

        return materials
    
    @staticmethod
    async def get_order_progress(order_id: str) -> OrderProgress:
        """Summarize order progress using material allocation data."""
        db = get_db()

        order_result = db.table('purchase_orders').select('id', 'order_number', 'status', 'due_date', 'progress_percentage').eq('id', order_id).execute()
        if not order_result.data:
            raise NotFoundException(detail="Purchase order not found")

        order = order_result.data[0]

        materials_result = db.table('order_materials').select('required_qty', 'allocated_qty', 'issued_qty').eq('purchase_order_id', order_id).execute()
        total_materials = len(materials_result.data)

        allocated_materials = 0
        issued_materials = 0

        for mat in materials_result.data:
            required = Decimal(str(mat['required_qty']))
            allocated = Decimal(str(mat.get('allocated_qty', 0)))
            issued = Decimal(str(mat.get('issued_qty', 0)))

            if allocated >= required:
                allocated_materials += 1
            if issued >= required:
                issued_materials += 1

        completed_materials = issued_materials
        allocation_percentage = float((allocated_materials / total_materials) * 100) if total_materials else 0.0

        due_date = PurchaseOrderService._parse_datetime(order['due_date']).date() if order.get('due_date') else date.today()
        days_until_due = (due_date - date.today()).days
        is_overdue = days_until_due < 0 and order['status'] not in ['Completed', 'Cancelled']

        return OrderProgress(
            order_id=order['id'],
            order_number=order['order_number'],
            status=order['status'],
            total_materials=total_materials,
            allocated_materials=allocated_materials,
            issued_materials=issued_materials,
            completed_materials=completed_materials,
            allocation_percentage=allocation_percentage,
            days_until_due=days_until_due,
            is_overdue=is_overdue
        )
    
    @staticmethod
    async def assign_team(order_id: str, user_ids: List[str], assigned_by: str) -> dict:
        """Assign one or more team members to an order."""
        if not user_ids:
            raise ValidationException(detail="No user ids provided for assignment")

        db = get_db()

        order = db.table('purchase_orders').select('id').eq('id', order_id).execute()
        if not order.data:
            raise NotFoundException(detail="Purchase order not found")

        for user_id in set(user_ids):
            db.table('order_team_assignments').upsert({
                'purchase_order_id': order_id,
                'user_id': user_id,
                'assigned_by': assigned_by,
                'assigned_at': datetime.utcnow().isoformat()
            }, on_conflict='purchase_order_id,user_id').execute()

        return {"message": "Team assignment updated", "assigned_count": len(set(user_ids))}
    
    @staticmethod
    async def get_team_assignments(order_id: str) -> List[TeamAssignment]:
        """Fetch team members assigned to an order."""
        db = get_db()

        order = db.table('purchase_orders').select('id').eq('id', order_id).execute()
        if not order.data:
            raise NotFoundException(detail="Purchase order not found")

        assignments = db.table('order_team_assignments').select('*').eq('purchase_order_id', order_id).order('assigned_at', desc=False).execute()
        team: List[TeamAssignment] = []

        for assignment in assignments.data:
            user = db.table('users').select('first_name', 'last_name', 'role').eq('id', assignment['user_id']).execute()
            first_name = user.data[0].get('first_name') if user.data else ''
            last_name = user.data[0].get('last_name') if user.data else ''
            role = user.data[0].get('role', 'Member') if user.data else 'Member'
            user_name = f"{first_name} {last_name}".strip() or 'Unknown User'

            team.append(TeamAssignment(
                user_id=assignment['user_id'],
                user_name=user_name,
                role=role,
                assigned_at=PurchaseOrderService._parse_datetime(assignment.get('assigned_at'))
            ))

        return team


# Singleton instance
purchase_order_service = PurchaseOrderService()
