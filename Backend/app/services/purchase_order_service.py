from datetime import datetime, date, timedelta
from typing import List, Optional
from decimal import Decimal
import qrcode
import io
import base64
import json
import logging
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
from app.services.bom_service import bom_service # Added import


class PurchaseOrderService:  # Changed from ProductionOrderService
    
    @staticmethod
    def _generate_order_number() -> str:
        """Generate unique order number: PO-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        prefix = f'PO-{year}-%'
        
        # Get the latest order number for this year
        result = db.table('purchase_orders').select('order_number').like('order_number', prefix).order('order_number', desc=True).limit(1).execute()
        
        if result.data:
            last_order = result.data[0]['order_number']
            try:
                # Extract sequence number
                last_seq = int(last_order.split('-')[-1])
                return f"PO-{year}-{last_seq + 1:04d}"
            except ValueError:
                # Fallback if parsing fails
                pass
        
        return f"PO-{year}-0001"
    
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
                query = query.ilike('order_number', search)
            
            # Add pagination
            query = query.order('created_at', desc=True).range(
                (page - 1) * limit, 
                page * limit - 1
            )
            
            result = query.execute()
            
            if not result.data:
                return []
                
            orders_data = result.data
            order_ids = [o['id'] for o in orders_data]
            
            # --- BATCH FETCH DEPENDENCIES ---
            
            # 1. Fetch Items with Item Products
            # Need to join products inside items to get code/name for each item
            items_by_order = {}
            if order_ids:
                try:
                    items_query = db.table('purchase_order_items').select('*, products(code, name)').in_('purchase_order_id', order_ids)
                    items_result = items_query.execute()
                    
                    for item in items_result.data:
                        oid = item['purchase_order_id']
                        if oid not in items_by_order:
                            items_by_order[oid] = []
                        items_by_order[oid].append(item)
                except Exception as e:
                    print(f"Error batch fetching items: {e}")
            
            # 2. Fetch Materials Status info
            mats_by_order = {}
            if order_ids:
                try:
                    mat_query = db.table('order_materials').select('purchase_order_id, availability_status').in_('purchase_order_id', order_ids)
                    mat_result = mat_query.execute()
                    
                    for m in mat_result.data:
                        oid = m['purchase_order_id']
                        if oid not in mats_by_order:
                            mats_by_order[oid] = []
                        mats_by_order[oid].append(m)
                except Exception as e:
                    print(f"Error batch fetching materials: {e}")
            
            # 3. Batch fetch missing main products (fallback)
            missing_prod_ids = set()
            for order in orders_data:
                product_data = order.get('products', {}) or {}
                if not product_data.get('code') and not product_data.get('name'):
                   if order.get('product_id'):
                       missing_prod_ids.add(order.get('product_id'))
            
            fallback_products = {}
            if missing_prod_ids:
                try:
                    p_query = db.table('products').select('id, code, name').in_('id', list(missing_prod_ids))
                    p_result = p_query.execute()
                    for p in p_result.data:
                        fallback_products[p['id']] = p
                except Exception as e:
                    print(f"Error batch fetching fallback products: {e}")

            # 4. Batch fetch Work Orders for Progress Calculation
            wo_progress_by_order = {}
            if order_ids:
                try:
                    wo_query = db.table('work_orders').select('purchase_order_id, target_qty, completed_qty').in_('purchase_order_id', order_ids)
                    wo_result = wo_query.execute()
                    for wo in wo_result.data:
                        oid = wo['purchase_order_id']
                        if oid not in wo_progress_by_order:
                            wo_progress_by_order[oid] = {'target': 0, 'completed': 0}
                        wo_progress_by_order[oid]['target'] += float(wo.get('target_qty') or 0)
                        wo_progress_by_order[oid]['completed'] += float(wo.get('completed_qty') or 0)
                except Exception as e:
                    print(f"Error batch fetching work orders: {e}")

            # --- ASSEMBLY ---
            orders = []
            for order in orders_data:
                try:
                    product_data = order.get('products', {}) or {}
                    product_code = product_data.get('code', '')
                    product_name = product_data.get('name', 'Unknown')

                    # Fallback if join failed
                    if not product_code and not product_name and order.get('product_id'):
                        fb = fallback_products.get(order.get('product_id'))
                        if fb:
                             product_code = fb.get('code')
                             product_name = fb.get('name')

                    product_name = product_name or 'Unknown Product'
                    product_code = product_code or ''

                    # Calculate material status
                    order_mats = mats_by_order.get(order['id'], [])
                    materials_status = 'Pending'
                    
                    if not order_mats:
                        # If no materials found in DB, check if it's because we failed to fetch or truly empty.
                        # Assuming truly empty for now (No Materials)
                        materials_status = 'No Materials'
                    else:
                        total = len(order_mats)
                        available = 0
                        shortage = 0
                        for mat in order_mats:
                            status_val = mat.get('availability_status', '').upper()
                            if status_val == 'AVAILABLE':
                                available += 1
                            if status_val in ['SHORTAGE', 'PARTIAL']:
                                shortage += 1

                        if shortage > 0:
                            materials_status = 'Material Shortage'
                        elif available == total:
                            materials_status = 'All Available'
                        else:
                            materials_status = 'Partially Available'

                    # Calculate progress percentage dynamically from work orders
                    if (order.get('status') or '').strip().lower() == 'completed':
                        progress_percentage = 100.0
                    else:
                        wo_prog = wo_progress_by_order.get(order['id'])
                        if wo_prog and wo_prog['target'] > 0:
                            progress_percentage = (wo_prog['completed'] / wo_prog['target']) * 100.0
                        else:
                            progress_percentage = PurchaseOrderService._derive_progress_percentage(order)

                    # Get items
                    items = []
                    raw_items = items_by_order.get(order['id'], [])
                    for item in raw_items:
                        try:
                            # Product details from join
                            p_data = item.get('products', {}) or {}
                            item_product_code = p_data.get('code', '')
                            item_product_name = p_data.get('name', 'Unknown')
                            
                            items.append(POItemResponse(
                                id=item.get('id'),
                                product_id=item.get('product_id'),
                                purchase_order_id=order.get('id'),
                                product_code=item_product_code,
                                product_name=item_product_name,
                                quantity=Decimal(str(item.get('quantity', 0))),
                                unit=item.get('unit', 'pcs'),
                                notes=item.get('notes'),
                                created_at=PurchaseOrderService._parse_datetime(item.get('created_at')),
                                updated_at=PurchaseOrderService._parse_datetime(item.get('updated_at'))
                            ))
                        except Exception as e:
                            print(f"Error processing item {item.get('id')}: {str(e)}")

                    # Aggregate product names for multi-SKU orders
                    if len(items) > 1:
                        all_names = [it.product_name for it in items if it.product_name]
                        if all_names:
                            # Use dict.fromkeys to maintain order and uniqueness
                            unique_names = list(dict.fromkeys(all_names))
                            product_name = ", ".join(unique_names)
                    elif len(items) == 1:
                        product_name = items[0].product_name
                        product_code = items[0].product_code
                    
                    # Calculate days until due
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
            'priority': order_data.priority.title() if order_data.priority else 'Medium',
            'status': 'Planned',
            # 'qr_code': qr_code,
            'bom_id': bom_id,
            'notes': order_data.notes,
            'customer_name': order_data.customer_name,
            # 'shift_number': order_data.shift_number, # Column does not exist in DB
            'created_by': user_id,
            # 'updated_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
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

        # Initialize WIP Board tracking - place order in first stage
        try:
            await PurchaseOrderService._initialize_wip_board_tracking(created_order['id'], user_id)
        except Exception as e:
            # Log error but don't fail order creation
            print(f"Failed to initialize WIP Board tracking for order {created_order['id']}: {str(e)}")
        
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
        total_quantity = 0.0
        material_totals = {}  # Map material_id -> {'required_qty': float, 'unit': str}
        summary_parts: list[str] = []

        # First, validate all products and calculate totals
        for item in order_data.items:
            # Look up product to get code and unit
            product_row = None
            
            # If product_code provided, use it
            if getattr(item, 'product_code', None):
                product_result = db.table('products').select('*').eq('code', item.product_code).execute()
                if product_result.data:
                    product_row = product_result.data[0]
            
            # If not found yet and product_id provided, use that
            if not product_row and item.product_id:
                product_result = db.table('products').select('*').eq('id', item.product_id).execute()
                if product_result.data:
                    product_row = product_result.data[0]
            
            if not product_row:
                 # Assuming 'logging' is imported or handled elsewhere
                 # Assuming 'ValueError' is appropriate here, or ValidationException
                 raise ValidationException(detail=f"Product not found: {item.product_code or item.product_id}")

            if product_row.get('category') != 'Finished Goods':
                raise ValidationException(detail=f"Product {product_row.get('code')} is not a finished good")

            # Get BOM for this product
            # Use the code from the looked-up product
            # Assuming 'bom_service' is imported or handled elsewhere
            bom_result = db.table('boms').select('id').eq('product_id', product_row['id']).eq('is_active', True).execute()
            if not bom_result.data:
                raise ValidationException(detail=f"No active BOM found for product {product_row.get('name')}. Please create a BOM first.")
            bom_id = bom_result.data[0]['id']


            # Use BOM Service for accurate calculation (handles batch size, scrap, etc.)
            # This replaces the manual and potentially incorrect calculation
            try:
                item_qty_float = float(item.quantity)
                mat_reqs = await bom_service.calculate_material_requirements(product_row['id'], Decimal(str(item.quantity)))
                
                for req in mat_reqs:
                    material_id = req.material_id
                    required_qty = float(req.required_quantity)
                    
                    if material_id not in material_totals:
                        material_totals[material_id] = {
                            'required_qty': required_qty,
                            'unit': req.unit,
                        }
                    else:
                        material_totals[material_id]['required_qty'] += required_qty
            except Exception as e:
                print(f"Error calculating material requirements for {product_row.get('code')}: {e}")
                raise ValidationException(detail=f"Failed to calculate material requirements for {product_row.get('code')}: {e}")

            sku_entries.append({
                'product': product_row,
                'quantity': item_qty_float,
                'unit': product_row.get('unit', 'pcs'),
                'notes': item.notes
            })
            total_quantity += item_qty_float
            summary_parts.append(f"{product_row.get('code')} ({item_qty_float} {product_row.get('unit', 'pcs')})")

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
            'priority': order_data.priority.title() if order_data.priority else 'Medium',
            'status': 'Planned',
            # 'qr_code': qr_code, # Column does not exist in DB
            'bom_id': None,
            'notes': combined_notes,
            'customer_name': order_data.customer_name,
            # 'shift_number': order_data.shift_number, # Column does not exist in DB
            'created_by': user_id,
            # 'updated_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

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
                # 'notes': item_payload.notes, # Column does not exist
                'completed_quantity': 0.0,
                'status': 'Pending',
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        if order_item_payload:
            db.table('purchase_order_items').insert(order_item_payload).execute()

        # Persist aggregated material requirements
        for material_id, info in material_totals.items():
            required_qty = float(info['required_qty'])
            # Compute real availability_status from inventory instead of hardcoding 'Shortage'
            try:
                inv_check = db.table('inventory').select('available_qty', 'allocated_qty').eq('product_id', material_id).execute()
                free_stock = sum(
                    float(r['available_qty']) - float(r['allocated_qty'])
                    for r in inv_check.data
                ) if inv_check.data else 0.0
                if free_stock < 0:
                    free_stock = 0.0
                if free_stock >= required_qty:
                    avail_status = 'Available'
                elif free_stock > 0:
                    avail_status = 'Partial'
                else:
                    avail_status = 'Shortage'
            except Exception:
                avail_status = 'Shortage'
            
            db.table('order_materials').insert({
                'purchase_order_id': created_order['id'],
                'product_id': material_id,
                'required_qty': required_qty,
                'allocated_qty': 0.0,
                'issued_qty': 0.0,
                'unit': info['unit'],
                'availability_status': avail_status,
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
        
        # Note: WIP Board tracks work_orders, not purchase_orders directly
        # This initialization should happen when a work_order is created from the PO
        # For now, we skip this step as it requires work_order_id
        # TODO: Initialize tracking when work order is created
        return
    
    @staticmethod
    async def _calculate_material_requirements(
        order_id: str,
        product_id: str,
        quantity: Decimal,
        bom_id: str
    ) -> None:
        """Calculate and save material requirements for an order using BOMService."""
        db = get_db()
        
        try:
            # Use BOM Service for accurate calculation
            mat_reqs = await bom_service.calculate_material_requirements(product_id, quantity)
            
            for req in mat_reqs:
                required_qty = float(req.required_quantity)
                
                # Compute real availability_status from inventory instead of
                # hardcoding 'Shortage'. Query free stock for this material.
                try:
                    inv_res = db.table('inventory').select('available_qty', 'allocated_qty').eq('product_id', req.material_id).execute()
                    free_stock = sum(
                        float(r['available_qty']) - float(r['allocated_qty'])
                        for r in inv_res.data
                    ) if inv_res.data else 0.0
                    if free_stock < 0:
                        free_stock = 0.0
                    
                    if free_stock >= required_qty:
                        avail_status = 'Available'
                    elif free_stock > 0:
                        avail_status = 'Partial'
                    else:
                        avail_status = 'Shortage'
                except Exception:
                    avail_status = 'Shortage'  # Safe fallback
                
                # Create material requirement
                material_data = {
                    'purchase_order_id': order_id,
                    'product_id': req.material_id,
                    'required_qty': required_qty,
                    'allocated_qty': 0.0,
                    'issued_qty': 0.0,
                    'unit': req.unit,
                    'availability_status': avail_status,
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }
                
                # Insert material requirement
                db.table('order_materials').insert(material_data).execute()
                
        except Exception as e:
            print(f"Error checking material requirements: {e}")
            # Don't fail the order creation, just log it. 
            # Requirements can be recalculated later or added manually if needed.
    
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
                order_id=mat['purchase_order_id'],  # Required field
                material_id=mat['product_id'],
                material_code=product.data[0]['code'] if product.data else '',
                material_name=product.data[0]['name'] if product.data else 'Unknown',
                required_qty=Decimal(str(mat['required_qty'])),
                allocated_qty=Decimal(str(mat.get('allocated_qty', 0))),
                issued_qty=Decimal(str(mat.get('issued_qty', 0))),
                unit=mat.get('unit', 'pcs'),
                unit_cost=Decimal(str(mat.get('unit_cost', 0))),  # Already exists in base
                total_cost=Decimal(str(mat.get('unit_cost', 0))) * Decimal(str(mat['required_qty'])),  # Required field
                status=mat.get('status', 'Pending'),  # Required field
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
        
        # Get team assignments (with error handling)
        try:
            team = await PurchaseOrderService.get_team_assignments(order_id)
        except Exception as e:
            logging.warning(f"Failed to fetch team assignments for order {order_id}: {e}")
            team = []
        
        # Calculate progress (with error handling)
        try:
            if (order.get('status') or '').strip().lower() == 'completed':
                progress_pct = 100.0
            else:
                wo_res = db.table('work_orders').select('target_qty, completed_qty').eq('purchase_order_id', order_id).execute()
                if wo_res.data:
                    total_target = sum(float(wo.get('target_qty') or 0) for wo in wo_res.data)
                    total_completed = sum(float(wo.get('completed_qty') or 0) for wo in wo_res.data)
                    if total_target > 0:
                        progress_pct = (total_completed / total_target) * 100.0
                    else:
                        progress_pct = 0.0
                else:
                    progress = await PurchaseOrderService.get_order_progress(order_id)
                    progress_pct = progress.allocation_percentage if progress else 0.0
        except Exception as e:
            logging.warning(f"Failed to fetch order progress for order {order_id}: {e}")
            progress_pct = 0.0
            
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
            progress_percentage=progress_pct,
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

        # existing = db.table('purchase_orders').select('id', 'status', 'start_date', 'completion_date').eq('id', order_id).execute()
        # Fallback to just id and status as dates might be missing from schema
        existing = db.table('purchase_orders').select('id', 'status').eq('id', order_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Purchase order not found")

        current_status = existing.data[0]['status']

        if status_data.status not in ['Planned', 'In Progress', 'Completed', 'Cancelled']:
            raise ValidationException(detail=f"Unsupported status '{status_data.status}'")

        if current_status == 'Completed' and status_data.status != 'Completed':
            raise ValidationException(detail="Completed orders cannot be moved back to another status")

        update_dict = {
            'status': status_data.status,
            # 'updated_by': user_id,
            'updated_at': datetime.utcnow().isoformat()
        }

        if status_data.notes is not None:
            update_dict['notes'] = status_data.notes

        if status_data.status == 'In Progress':
            # update_dict['start_date'] = datetime.utcnow().isoformat()
            pass
        elif status_data.status == 'Completed':
            # update_dict['completion_date'] = datetime.utcnow().isoformat()
            update_dict['progress_percentage'] = 100
            
            # --- AUTO-COMPLETE ASSOCIATED WORK ORDERS ---
            try:
                wo_res = db.table('work_orders').select('id, status').eq('purchase_order_id', order_id).neq('status', 'Completed').execute()
                if wo_res.data:
                    from app.services.wip_service import WIPService
                    from app.schemas.wip import WorkingOrderUpdate
                    for wo in wo_res.data:
                        await WIPService.update_working_order(wo['id'], WorkingOrderUpdate(status='Completed'), user_id)
            except Exception as e:
                import logging
                logging.error(f"Failed to auto-complete work orders for PO {order_id}: {e}")

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
            # 'qr_code': PurchaseOrderService._generate_qr_code(new_order_number),
            'bom_id': existing.bom_id,
            'notes': f"Duplicated from {existing.order_number}\n{existing.notes or ''}",
            'customer_name': existing.customer_name,
            # 'shift_number': existing.shift_number, # Column does not exist in DB
            # 'created_by': user_id,
            # 'updated_by': user_id,
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
        
        # Normalize priority to title case
        if 'priority' in update_dict and update_dict['priority']:
             update_dict['priority'] = update_dict['priority'].title()

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
        """Archive a purchase order by cancelling it (no archived_at column exists)."""
        return await PurchaseOrderService.cancel_purchase_order(order_id, user_id)

    @staticmethod
    async def cancel_purchase_order(order_id: str, user_id: str) -> PurchaseOrderResponse:
        """Cancel purchase order."""
        return await PurchaseOrderService.update_order_status(
            order_id=order_id, 
            status_data=OrderStatusUpdate(status='Cancelled', notes='Order cancelled by user'),
            user_id=user_id
        )

    @staticmethod
    async def delete_purchase_order(order_id: str, user_id: str) -> bool:
        """Permanently delete a purchase order if possible, or archive/cancel it."""
        db = get_db()
        existing = db.table('purchase_orders').select('status').eq('id', order_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Purchase order not found")
            
        status = existing.data[0]['status']
        
        # If it's Draft or Planned (and maybe Cancelled), we can hard delete
        if status in ['Draft', 'Planned', 'Cancelled', 'DRAFT', 'PLANNED', 'CANCELLED']:
            try:
                # Delete referencing rows first to avoid FK violations
                db.table('qc_inspections').delete().eq('purchase_order_id', order_id).execute()
                db.table('purchase_order_items').delete().eq('order_id', order_id).execute()
                db.table('purchase_orders').delete().eq('id', order_id).execute()
                return True
            except Exception as e:
                # If delete still fails (e.g. materials or work orders exist), fall back to cancel
                import logging
                logging.warning(f"Delete failed, falling back to cancel: {e}")
                await PurchaseOrderService.cancel_purchase_order(order_id, user_id)
                return False
        else:
            # Otherwise, just archive/cancel
            await PurchaseOrderService.cancel_purchase_order(order_id, user_id)
            return False

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
            
            # Get stock — inventory table uses available_qty and allocated_qty.
            # There is NO 'quantity' column on inventory. Free quantity is
            # available_qty - allocated_qty.
            stock_query = db.table('inventory').select('available_qty', 'allocated_qty').eq('product_id', item['material_id'])
            if target_location_id:
                stock_query = stock_query.eq('location_id', target_location_id)
            
            stock_res = stock_query.execute()
            available = sum(
                Decimal(str(s['available_qty'])) - Decimal(str(s['allocated_qty']))
                for s in stock_res.data
            ) if stock_res.data else Decimal('0')
            if available < Decimal('0'):
                available = Decimal('0')
            
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

        # Column is purchase_order_id, NOT order_id (order_id does not exist on order_materials)
        materials_result = db.table('order_materials').select('*').eq('purchase_order_id', order_id).execute()
        materials = []

        for mat in materials_result.data:
            product = db.table('products').select('code', 'name').eq('id', mat['product_id']).execute()
            required_qty = Decimal(str(mat['required_qty']))
            allocated_qty = Decimal(str(mat.get('allocated_qty', 0)))
            issued_qty = Decimal(str(mat.get('issued_qty', 0)))
            # order_materials has no available_qty column. Look up from inventory.
            inv_stock = db.table('inventory').select('available_qty', 'allocated_qty').eq('product_id', mat['product_id']).execute()
            if inv_stock.data:
                available_qty = sum(
                    Decimal(str(r['available_qty'])) - Decimal(str(r['allocated_qty']))
                    for r in inv_stock.data
                )
                if available_qty < Decimal('0'):
                    available_qty = Decimal('0')
            else:
                available_qty = Decimal('0')
            shortage_qty = required_qty - available_qty
            if shortage_qty < Decimal('0'):
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

        order_result = db.table('purchase_orders').select('id', 'order_number', 'status', 'due_date').eq('id', order_id).execute()
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
            user = db.table('users').select('first_name', 'last_name', 'username').eq('id', assignment['user_id']).execute()
            first_name = user.data[0].get('first_name') if user.data else ''
            last_name = user.data[0].get('last_name') if user.data else ''
            role = assignment.get('role', 'Member')
            user_name = f"{first_name} {last_name}".strip() or user.data[0].get('username', 'Unknown User') if user.data else 'Unknown User'
            
            team.append(TeamAssignment(
                user_id=assignment['user_id'],
                user_name=user_name,
                role=role,
                assigned_at=PurchaseOrderService._parse_datetime(assignment.get('assigned_at'))
            ))
        
        return team


# Singleton instance
purchase_order_service = PurchaseOrderService()
