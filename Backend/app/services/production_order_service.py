from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
import qrcode
import io
import base64
import json
from app.database import get_db
from app.schemas.production_order import (
    ProductionOrderCreate, ProductionOrderUpdate, ProductionOrderResponse,
    ProductionOrderListItem, OrderMaterialResponse, OrderStatusUpdate,
    OrderAssignment, OrderAssignmentResponse, OrderProgress,
    MaterialAllocationRequest, ProductionOrderValidation  
)
from app.core.exceptions import NotFoundException, ValidationException


class ProductionOrderService:
    
    @staticmethod
    def _generate_order_number() -> str:
        """Generate unique order number: PO-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        
        # Get count of orders this year
        result = db.table('production_orders').select('order_number', count='exact').like(
            'order_number', f'PO-{year}-%'
        ).execute()
        
        count = result.count if hasattr(result, 'count') else 0
        next_number = count + 1
        
        return f"PO-{year}-{next_number:04d}"
    
    @staticmethod
    def _generate_qr_code(order_number: str) -> str:
        """Generate QR code as base64 string"""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(order_number)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    @staticmethod
    async def duplicate_production_order(
        order_id: str,
        user_id: str
    ) -> ProductionOrderResponse:
        """
        Duplicate an existing production order.
        Creates a new order with same product, quantity, and BOM but new order number.
        """
        db = get_db()
        
        # Get existing order
        existing_order = db.table('production_orders').select('*').eq('id', order_id).execute()
        
        if not existing_order.data:
            raise NotFoundException(detail="Production order not found")
        
        order = existing_order.data[0]
        
        # Create new order data from existing order
        from app.schemas.production_order import ProductionOrderCreate
        from decimal import Decimal
        from datetime import date, timedelta
        
        # Set due date to 7 days from now by default
        new_due_date = date.today() + timedelta(days=7)
        
        new_order_data = ProductionOrderCreate(
            product_id=order['product_id'],
            quantity=Decimal(str(order['quantity'])),
            due_date=new_due_date,
            priority=order.get('priority', 'Medium'),
            notes=f"Duplicated from {order['order_number']}" + (f"\n\n{order['notes']}" if order.get('notes') else ""),
            customer_name=order.get('customer_name'),
            assigned_team=order.get('assigned_team'),
            shift_number=order.get('shift_number'),
            production_stage=order.get('production_stage')
        )
        
        # Create the new order using existing create method
        return await ProductionOrderService.create_production_order(new_order_data, user_id)
    
    @staticmethod
    async def create_production_order(
        order_data: ProductionOrderCreate,
        user_id: str
    ) -> ProductionOrderResponse:
        """
        Create production order with automatic material calculation from BOM.
        """
        db = get_db()
        
        # Validate product exists and is finished goods
        product = db.table('products').select('id', 'category', 'unit').eq(
            'id', order_data.product_id
        ).execute()
        
        if not product.data:
            raise NotFoundException(detail="Product not found")
        
        if product.data[0]['category'] != 'Finished Goods':
            raise ValidationException(detail="Production orders can only be created for finished goods")
        
        product_unit = product.data[0]['unit']
        
        # Get active BOM for product with version
        bom = db.table('boms').select('id', 'version', 'batch_size').eq('product_id', order_data.product_id).eq(
            'is_active', True
        ).execute()
        
        if not bom.data:
            raise ValidationException(detail="No active BOM found for this product. Please create a BOM first.")
        
        bom_data = bom.data[0]
        bom_id = bom_data['id']
        bom_version = bom_data.get('version', 1)
        
        # Get BOM materials for snapshot
        bom_materials = db.table('bom_materials').select('*').eq('bom_id', bom_id).execute()
        bom_snapshot = {
            'bom_id': bom_id,
            'version': bom_version,
            'batch_size': bom_data.get('batch_size', 100),
            'materials': bom_materials.data if bom_materials.data else [],
            'captured_at': datetime.utcnow().isoformat()
        }
        
        # Generate order number and QR code
        order_number = ProductionOrderService._generate_order_number()
        qr_code = ProductionOrderService._generate_qr_code(order_number)
        
        # Create production order with BOM version tracking
        order_dict = {
            'order_number': order_number,
            'product_id': order_data.product_id,
            'bom_id': bom_id,
            'bom_version': bom_version,
            'bom_snapshot': json.dumps(bom_snapshot),  # Serialize dict to JSON string
            'quantity': float(order_data.quantity),
            'unit': product_unit,
            'due_date': order_data.due_date.isoformat(),
            'priority': order_data.priority,
            'status': 'Planned',
            'notes': order_data.notes,
            'customer_name': order_data.customer_name,
            'assigned_team': order_data.assigned_team,
            'shift_number': order_data.shift_number,
            'production_stage': order_data.production_stage,
            'start_time': order_data.start_time.isoformat() if order_data.start_time else None,
            'end_time': order_data.end_time.isoformat() if order_data.end_time else None,
            'qr_code': qr_code,
            'created_by': user_id
        }
        
        order_result = db.table('production_orders').insert(order_dict).execute()
        
        if not order_result.data:
            raise Exception("Failed to create production order")
        
        created_order = order_result.data[0]
        
        # Calculate material requirements from BOM
        await ProductionOrderService._calculate_material_requirements(
            order_id=created_order['id'],
            product_id=order_data.product_id,
            quantity=order_data.quantity,
            bom_id=bom_id
        )
        
        return await ProductionOrderService.get_order_by_id(created_order['id'])
    
    @staticmethod
    async def _calculate_material_requirements(
        order_id: str,
        product_id: str,
        quantity: Decimal,
        bom_id: str
    ):
        """Calculate and store material requirements from BOM"""
        db = get_db()
        
        # Get BOM details
        bom = db.table('boms').select('batch_size').eq('id', bom_id).execute()
        batch_size = Decimal(str(bom.data[0]['batch_size'])) if bom.data else Decimal('100')
        
        # Get BOM materials
        materials = db.table('bom_materials').select('*').eq('bom_id', bom_id).execute()
        
        for mat in materials.data:
            mat_quantity = Decimal(str(mat['quantity']))
            scrap_pct = Decimal(str(mat.get('scrap_percentage', 0)))
            unit_cost = Decimal(str(mat.get('unit_cost', 0)))
            
            # Calculate required quantity: (order_qty / batch_size) * mat_qty * (1 + scrap%)
            required_qty = (quantity / batch_size) * mat_quantity * (1 + scrap_pct / 100)
            total_cost = required_qty * unit_cost
            
            # Insert order material
            db.table('order_materials').insert({
                'order_id': order_id,
                'product_id': mat['material_id'],
                'required_qty': float(required_qty),
                'unit': mat['unit']
            }).execute()
    
    @staticmethod
    async def list_production_orders(
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        product_id: Optional[str] = None,
        overdue_only: bool = False,
        search: Optional[str] = None
    ) -> List[ProductionOrderListItem]:
        """List production orders with filters"""
        db = get_db()
        
        offset = (page - 1) * limit
        
        query = db.table('production_orders').select('*')
        
        if status:
            query = query.eq('status', status)
        
        if priority:
            query = query.eq('priority', priority)
        
        if product_id:
            query = query.eq('product_id', product_id)
        
        if overdue_only:
            today = date.today().isoformat()
            query = query.lt('due_date', today).neq('status', 'Completed').neq('status', 'Cancelled')
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        orders = []
        for order in result.data:
            # Get product info
            product = db.table('products').select('code', 'name').eq('id', order['product_id']).execute()
            
            if not product.data:
                continue
            
            # Get materials status
            materials = db.table('order_materials').select('availability_status').eq('order_id', order['id']).execute()
            
            total_materials = len(materials.data)
            shortage = sum(1 for m in materials.data if m['availability_status'] == 'Shortage')
            available = sum(1 for m in materials.data if m['availability_status'] == 'Available')
            
            if total_materials == 0:
                materials_status = "No Materials"
            elif shortage > 0:
                materials_status = "Material Shortage"
            elif available == total_materials:
                materials_status = "All Available"
            else:
                materials_status = "Partially Available"
            
            # Calculate days until due
            due_date_obj = datetime.fromisoformat(order['due_date']).date() if isinstance(order['due_date'], str) else order['due_date']
            days_until_due = (due_date_obj - date.today()).days
            is_overdue = days_until_due < 0 and order['status'] not in ['Completed', 'Cancelled']
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if (search_lower not in order['order_number'].lower() and
                    search_lower not in product.data[0]['code'].lower() and
                    search_lower not in product.data[0]['name'].lower()):
                    continue
            
            orders.append(ProductionOrderListItem(
                id=order['id'],
                order_number=order['order_number'],
                product_id=order['product_id'],
                product_code=product.data[0]['code'],
                product_name=product.data[0]['name'],
                quantity=Decimal(str(order['quantity'])),
                unit=order['unit'],
                due_date=due_date_obj,
                priority=order['priority'],
                status=order['status'],
                materials_status=materials_status,
                days_until_due=days_until_due,
                is_overdue=is_overdue,
                created_at=datetime.fromisoformat(order['created_at'].replace('Z', '+00:00'))
            ))
        
        return orders
    
    @staticmethod
    async def get_order_by_id(order_id: str) -> ProductionOrderResponse:
        """Get production order by ID with all materials"""
        db = get_db()
        
        # Get order
        order_result = db.table('production_orders').select('*').eq('id', order_id).execute()
        
        if not order_result.data:
            raise NotFoundException(detail="Production order not found")
        
        order = order_result.data[0]
        
        # Get product info
        product = db.table('products').select('code', 'name').eq('id', order['product_id']).execute()
        product_code = product.data[0]['code'] if product.data else None
        product_name = product.data[0]['name'] if product.data else None
        
        # Get order materials
        materials_result = db.table('order_materials').select('*').eq('order_id', order_id).execute()
        
        materials = []
        total_cost = Decimal('0')
        
        for mat in materials_result.data:
            # Get material product info (order_materials uses 'product_id' column)
            mat_product = db.table('products').select('code', 'name').eq('id', mat['product_id']).execute()
            
            mat_total_cost = Decimal('0')  # total_cost column doesn't exist in schema
            
            materials.append(OrderMaterialResponse(
                id=mat['id'],
                order_id=mat['order_id'],
                material_id=mat['product_id'],  # Map product_id to material_id for response
                material_code=mat_product.data[0]['code'] if mat_product.data else None,
                material_name=mat_product.data[0]['name'] if mat_product.data else None,
                required_qty=Decimal(str(mat['required_qty'])),
                allocated_qty=Decimal(str(mat.get('allocated_qty', 0))),
                issued_qty=Decimal(str(mat.get('issued_qty', 0))),
                unit=mat['unit'],
                unit_cost=Decimal('0'),  # unit_cost column doesn't exist in schema
                total_cost=mat_total_cost,
                status=mat.get('availability_status', 'Available'),
                created_at=datetime.fromisoformat(mat['created_at'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(mat['updated_at'].replace('Z', '+00:00'))
            ))
        
        return ProductionOrderResponse(
            id=order['id'],
            order_number=order['order_number'],
            product_id=order['product_id'],
            product_code=product_code,
            product_name=product_name,
            bom_id=order.get('bom_id'),
            quantity=Decimal(str(order['quantity'])),
            unit=order['unit'],
            due_date=datetime.fromisoformat(str(order['due_date'])).date() if order.get('due_date') else None,
            priority=order['priority'],
            status=order['status'],
            notes=order.get('notes'),
            qr_code=order.get('qr_code'),
            materials=materials,
            total_material_cost=total_cost,
            started_at=datetime.fromisoformat(str(order['started_at']).replace('Z', '+00:00')) if order.get('started_at') else None,
            completed_at=datetime.fromisoformat(str(order['completed_at']).replace('Z', '+00:00')) if order.get('completed_at') else None,
            created_at=datetime.fromisoformat(str(order['created_at']).replace('Z', '+00:00')) if order.get('created_at') else datetime.utcnow(),
            updated_at=datetime.fromisoformat(str(order['updated_at']).replace('Z', '+00:00')) if order.get('updated_at') else datetime.utcnow(),
            created_by=order.get('created_by'),
            updated_by=order.get('updated_by')
        )
    
    @staticmethod
    async def update_production_order(
        order_id: str,
        update_data: ProductionOrderUpdate,
        user_id: str
    ) -> ProductionOrderResponse:
        """Update production order"""
        db = get_db()
        
        # Check if order exists
        existing = db.table('production_orders').select('id', 'status').eq('id', order_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Production order not found")
        
        # Don't allow updates to completed/cancelled orders
        if existing.data[0]['status'] in ['Completed', 'Cancelled']:
            raise ValidationException(detail=f"Cannot update {existing.data[0]['status'].lower()} order")
        
        update_dict = {'updated_by': user_id}
        
        if update_data.quantity is not None:
            update_dict['quantity'] = float(update_data.quantity)
        
        if update_data.due_date is not None:
            update_dict['due_date'] = update_data.due_date.isoformat()
        
        if update_data.priority is not None:
            update_dict['priority'] = update_data.priority
        
        if update_data.status is not None:
            update_dict['status'] = update_data.status
            
            # Set timestamps based on status
            if update_data.status == 'In Progress' and not existing.data[0].get('started_at'):
                update_dict['started_at'] = datetime.utcnow().isoformat()
            elif update_data.status == 'Completed':
                update_dict['completed_at'] = datetime.utcnow().isoformat()
        
        if update_data.notes is not None:
            update_dict['notes'] = update_data.notes
        
        if update_data.customer_name is not None:
            update_dict['customer_name'] = update_data.customer_name
        
        if update_data.assigned_team is not None:
            update_dict['assigned_team'] = update_data.assigned_team
        
        if update_data.shift_number is not None:
            update_dict['shift_number'] = update_data.shift_number
        
        if update_data.production_stage is not None:
            update_dict['production_stage'] = update_data.production_stage
        
        db.table('production_orders').update(update_dict).eq('id', order_id).execute()
        
        return await ProductionOrderService.get_order_by_id(order_id)
    
    @staticmethod
    async def archive_production_order(
        order_id: str,
        user_id: str
    ) -> ProductionOrderResponse:
        """Archive a production order"""
        db = get_db()
        
        # Check if order exists
        existing = db.table('production_orders').select('id', 'status', 'is_archived').eq('id', order_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Production order not found")
        
        if existing.data[0].get('is_archived'):
            raise ValidationException(detail="Order is already archived")
        
        # Only allow archiving completed or cancelled orders
        if existing.data[0]['status'] not in ['Completed', 'Cancelled']:
            raise ValidationException(detail="Only completed or cancelled orders can be archived")
        
        # Archive the order
        update_dict = {
            'is_archived': True,
            'archived_at': datetime.utcnow().isoformat(),
            'archived_by': user_id
        }
        
        db.table('production_orders').update(update_dict).eq('id', order_id).execute()
        
        return await ProductionOrderService.get_order_by_id(order_id)
    
    @staticmethod
    async def delete_production_order(order_id: str) -> dict:
        """Delete (cancel) production order"""
        db = get_db()
        
        # Check if order exists
        existing = db.table('production_orders').select('id', 'status').eq('id', order_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Production order not found")
        
        # Can only cancel if not completed
        if existing.data[0]['status'] == 'Completed':
            raise ValidationException(detail="Cannot delete completed order")
        
        # Update status to Cancelled
        db.table('production_orders').update({
            'status': 'Cancelled',
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', order_id).execute()
        
        return {"message": "Production order cancelled successfully"}
    
    @staticmethod
    async def update_order_status(
        order_id: str,
        status_update: OrderStatusUpdate,
        user_id: str
    ) -> ProductionOrderResponse:
        """Update order status"""
        update_data = ProductionOrderUpdate(
            status=status_update.status,
            notes=status_update.notes
        )
        
        return await ProductionOrderService.update_production_order(order_id, update_data, user_id)
    
    @staticmethod
    async def get_order_progress(order_id: str) -> OrderProgress:
        """Get order progress summary"""
        db = get_db()
        
        # Get order
        order = db.table('production_orders').select('order_number', 'status', 'due_date').eq('id', order_id).execute()
        
        if not order.data:
            raise NotFoundException(detail="Production order not found")
        
        # Get materials status
        materials = db.table('order_materials').select('availability_status', 'required_qty', 'allocated_qty', 'issued_qty').eq('order_id', order_id).execute()
        
        total_materials = len(materials.data)
        allocated_materials = sum(1 for m in materials.data if Decimal(str(m.get('allocated_qty', 0))) > 0)
        issued_materials = sum(1 for m in materials.data if Decimal(str(m.get('issued_qty', 0))) > 0)
        completed_materials = sum(1 for m in materials.data if m.get('availability_status') == 'Available')
        
        allocation_pct = (allocated_materials / total_materials * 100) if total_materials > 0 else 0
        
        # Calculate days until due
        due_date_obj = datetime.fromisoformat(order.data[0]['due_date']).date() if isinstance(order.data[0]['due_date'], str) else order.data[0]['due_date']
        days_until_due = (due_date_obj - date.today()).days
        is_overdue = days_until_due < 0 and order.data[0]['status'] not in ['Completed', 'Cancelled']
        
        return OrderProgress(
            order_id=order_id,
            order_number=order.data[0]['order_number'],
            status=order.data[0]['status'],
            total_materials=total_materials,
            allocated_materials=allocated_materials,
            issued_materials=issued_materials,
            completed_materials=completed_materials,
            allocation_percentage=round(allocation_pct, 2),
            days_until_due=days_until_due,
            is_overdue=is_overdue
        )

    @staticmethod
    async def validate_production_feasibility(
        product_id: str,
        quantity: Decimal,
        target_location_id: Optional[str] = None
    ) -> ProductionOrderValidation:
        """
        Validate if production order can be fulfilled with current inventory.
        Uses BOM shortage calculation.
        """
        from app.services.bom_service import bom_service
        from app.schemas.production_order import OrderMaterialWithShortage, ProductionOrderValidation
        
        db = get_db()
        
        # Get product details
        product = db.table('products').select('code', 'name').eq('id', product_id).execute()
        
        if not product.data:
            raise NotFoundException(detail="Product not found")
        
        product_code = product.data[0]['code']
        product_name = product.data[0]['name']
        
        # Use BOM service to calculate shortages
        shortage_calc = await bom_service.calculate_requirements_with_shortages(
            product_id=product_id,
            quantity=quantity,
            target_location_id=target_location_id,
            include_allocated=False
        )
        
        # Convert BOM shortage details to order material format
        materials = []
        for mat in shortage_calc.materials:
            materials.append(OrderMaterialWithShortage(
                material_id=mat.material_id,
                material_code=mat.material_code,
                material_name=mat.material_name,
                required_qty=mat.required_qty,
                unit=mat.unit,
                available_qty=mat.available_qty,
                allocated_qty=mat.allocated_qty,
                issued_qty=Decimal('0'),  # Not issued yet
                free_qty=mat.free_qty,
                shortage_qty=mat.shortage_qty,
                shortage_status=mat.shortage_status,
                procurement_needed=mat.procurement_needed
            ))
        
        return ProductionOrderValidation(
            can_produce=shortage_calc.summary['can_produce'],
            product_id=product_id,
            product_code=product_code,
            product_name=product_name,
            quantity=quantity,
            total_materials=shortage_calc.summary['total_materials'],
            sufficient_materials=shortage_calc.summary['sufficient'],
            shortage_materials=shortage_calc.summary['total_shortage_items'],
            materials=materials,
            summary=shortage_calc.summary
        )

# Singleton instance
production_order_service = ProductionOrderService()