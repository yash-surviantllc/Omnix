from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.schemas.inventory_items import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    InventoryItemListResponse, InventoryItemTransactionCreate,
    InventoryItemTransactionResponse, StockAlertItemResponse,
    InventoryItemsSummary, InventoryAdjustmentRequest
)
from app.core.exceptions import NotFoundException, ValidationException


class InventoryItemsService:
    
    @staticmethod
    async def list_inventory_items(
        page: int = 1,
        limit: int = 50,
        search: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[InventoryItemListResponse]:
        """List all inventory items with filters."""
        db = get_db()
        
        offset = (page - 1) * limit
        
        query = db.table('inventory_items').select('*')
        
        if status:
            query = query.eq('status', status)
        
        if category:
            query = query.eq('category', category)
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        # Enhanced Logic: Fetch Real-time Allocation and Transit Data
        # 1. Collect codes
        codes = [i['material_code'] for i in result.data]
        product_map = {} # code -> product_id
        
        if codes:
            try:
                prod_res = db.table('products').select('id, code').in_('code', codes).execute()
                for p in prod_res.data:
                    product_map[p['code']] = p['id']
            except Exception:
                pass
                
        items = []
        for item in result.data:
            # Apply search filter
            if search:
                search_lower = search.lower()
                if (search_lower not in item['material_code'].lower() and 
                    search_lower not in item['material_name'].lower()):
                    continue
            
            quantity = Decimal(str(item['quantity']))
            allocated = Decimal('0')
            transit = Decimal('0')
            
            # 2. Fetch Real Metrics if linked to Product
            p_id = product_map.get(item['material_code'])
            if p_id:
                try:
                    # Allocated from Inventory Table
                    inv_res = db.table('inventory').select('allocated_qty').eq('product_id', p_id).execute()
                    if inv_res.data:
                        allocated = sum(Decimal(str(r['allocated_qty'])) for r in inv_res.data)
                        print(f"Inventory: {item['material_code']}: Found allocated_qty = {allocated}")
                        
                    # Transit from PO Items (Pending or In Progress)
                    po_res = db.table('purchase_order_items').select('quantity, completed_quantity').eq('product_id', p_id).in_('status', ['Pending', 'In Progress']).execute()
                    if po_res.data:
                         transit = sum(Decimal(str(r['quantity'])) - Decimal(str(r.get('completed_quantity', 0) or 0)) for r in po_res.data)
                except Exception as e:
                    print(f"Error fetching metrics for {item['material_code']}: {e}")
            else:
                print(f"Inventory: {item['material_code']}: NOT FOUND in products table - allocated_qty will be 0")


            items.append(InventoryItemListResponse(
                id=item['id'],
                material_code=item['material_code'],
                material_name=item['material_name'],
                quantity=quantity,
                allocated_quantity=allocated,
                free_quantity=quantity - allocated,  # FIXED: Actual free stock
                unit=item['unit'],
                location=item.get('location'),
                reorder_level=Decimal(str(item.get('reorder_level', 0))),
                status=item['status'],
                unit_cost=Decimal(str(item['unit_cost'])),
                total_value=quantity * Decimal(str(item['unit_cost']))
            ))
        
        return items
    
    @staticmethod
    async def get_inventory_item(item_id: str) -> InventoryItemResponse:
        """Get inventory item by ID."""
        db = get_db()
        
        result = db.table('inventory_items').select('*').eq('id', item_id).execute()
        
        if not result.data:
            raise NotFoundException(detail="Inventory item not found")
        
        item = result.data[0]
        
        # Calculate virtual fields with Real Data
        quantity = Decimal(str(item['quantity']))
        allocated = Decimal('0')
        transit = Decimal('0')
        
        # Try to find linked product
        try:
            prod_res = db.table('products').select('id').eq('code', item['material_code']).single().execute()
            if prod_res.data:
                p_id = prod_res.data['id']
                # Allocated
                inv_res = db.table('inventory').select('allocated_qty').eq('product_id', p_id).execute()
                if inv_res.data:
                    allocated = sum(Decimal(str(r['allocated_qty'])) for r in inv_res.data)
                # Transit from PO Items (Pending or In Progress)
                po_res = db.table('purchase_order_items').select('quantity, completed_quantity').eq('product_id', p_id).in_('status', ['Pending', 'In Progress']).execute()
                if po_res.data:
                    transit = sum(Decimal(str(r['quantity'])) - Decimal(str(r.get('completed_quantity', 0) or 0)) for r in po_res.data)
        except Exception:
            pass

        item['free_quantity'] = quantity - allocated  # FIXED: Actual free stock
        item['allocated_quantity'] = allocated
        item['total_value'] = quantity * Decimal(str(item['unit_cost']))
        
        return InventoryItemResponse(**item)
    
    @staticmethod
    async def create_inventory_item(
        item_data: InventoryItemCreate,
        user_id: str
    ) -> InventoryItemResponse:
        """Create a new inventory item."""
        db = get_db()
        
        # Check for duplicate material code
        existing = db.table('inventory_items').select('id').eq(
            'material_code', item_data.material_code
        ).execute()
        
        if existing.data:
            raise ValidationException(detail="Material code already exists")
        
        # Check for duplicate material name
        existing_name = db.table('inventory_items').select('id').eq(
            'material_name', item_data.material_name
        ).execute()
        
        if existing_name.data:
            raise ValidationException(detail="Material name already exists")
        
        # Validate reorder level
        if item_data.reorder_level > item_data.quantity:
            raise ValidationException(detail="Reorder level cannot exceed available quantity")
        
        # Create item
        item_dict = item_data.model_dump()
        # FIX: Insert with 0 quantity first. The transaction trigger will update it to the correct value.
        # This prevents double counting (Insert + Trigger Update).
        target_quantity = float(item_data.quantity)
        item_dict['quantity'] = 0.0 
        item_dict['reorder_level'] = float(item_data.reorder_level)
        item_dict['unit_cost'] = float(item_data.unit_cost)
        item_dict['created_by'] = user_id
        
        # Determine initial status based on TARGET quantity
        if target_quantity == 0:
            item_dict['status'] = 'Out of Stock'
        elif target_quantity <= float(item_data.reorder_level) * 0.5:
            item_dict['status'] = 'Critical'
        elif target_quantity <= float(item_data.reorder_level):
            item_dict['status'] = 'Low Stock'
        else:
            item_dict['status'] = 'Sufficient'
        
        result = db.table('inventory_items').insert(item_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create inventory item")
        
        item = result.data[0]
        
        # --- SYNC WITH CORE INVENTORY SYSTEM ---
        try:
            # 1. Sync Product
            product_id = None
            prod_res = db.table('products').select('id').eq('code', item_data.material_code).execute()
            if prod_res.data:
                product_id = prod_res.data[0]['id']
            else:
                # Create Product
                new_prod = db.table('products').insert({
                    'code': item_data.material_code,
                    'name': item_data.material_name,
                    'category': item_data.category or 'Raw Materials',
                    'unit': item_data.unit,
                    'description': item_data.description,
                    'unit_cost': float(item_data.unit_cost)
                }).execute()
                if new_prod.data:
                    product_id = new_prod.data[0]['id']

            # 2. Sync Location & Inventory (if product exists/created)
            if product_id and item_data.location:
                # Find or Create Location
                location_id = None
                
                # Try finding by CODE first (more reliable)
                loc_code = item_data.location.upper().replace(' ', '-').strip()
                loc_res = db.table('locations').select('id').eq('code', loc_code).execute()
                
                if loc_res.data:
                    location_id = loc_res.data[0]['id']
                else:
                    # Try finding by NAME
                    loc_res_name = db.table('locations').select('id').ilike('name', item_data.location).execute()
                    if loc_res_name.data:
                        location_id = loc_res_name.data[0]['id']
                    else:
                        # Create Location
                        new_loc = db.table('locations').insert({
                            'name': item_data.location,
                            'code': loc_code,
                            'type': 'store',
                            'is_active': True
                        }).execute()
                        if new_loc.data:
                            location_id = new_loc.data[0]['id']
                
                # Update Inventory Table
                if location_id:
                    inv_res = db.table('inventory').select('*').eq('product_id', product_id).eq('location_id', location_id).execute()
                    if inv_res.data:
                        # Update
                        curr = Decimal(str(inv_res.data[0]['available_qty']))
                        # We add target_quantity because we are adding stock
                        db.table('inventory').update({
                            'available_qty': float(curr + Decimal(str(target_quantity))),
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', inv_res.data[0]['id']).execute()
                    else:
                        # Insert
                        db.table('inventory').insert({
                            'product_id': product_id,
                            'location_id': location_id,
                            'available_qty': float(target_quantity),
                            'allocated_qty': 0
                        }).execute()
        except Exception as e:
            print(f"Sync failed for {item_data.material_code}: {e}")
            # Continue - do not fail the request just because sync failed (though it's bad)

        # Create initial transaction
        # This will trigger the update to inventory_items.quantity
        if target_quantity > 0:
            await InventoryItemsService._log_transaction(
                inventory_item_id=item['id'],
                transaction_type='IN',
                quantity_before=Decimal('0'),
                quantity_change=Decimal(str(target_quantity)),
                quantity_after=Decimal(str(target_quantity)),
                unit=item_data.unit,
                unit_cost=item_data.unit_cost,
                reason='Initial stock entry',
                user_id=user_id
            )
        
        # Construct Response manually
        # Use target_quantity for quantity and free_quantity
        return InventoryItemResponse(
            id=item['id'],
            material_code=item['material_code'],
            material_name=item['material_name'],
            category=item.get('category'),
            quantity=Decimal(str(target_quantity)), # Return the target quantity (what user expects)
            unit=item['unit'],
            location=item.get('location'),
            reorder_level=Decimal(str(item.get('reorder_level', 0))),
            status=item['status'], # Status uses target quantity login
            unit_cost=Decimal(str(item['unit_cost'])),
            description=item.get('description'),
            free_quantity=Decimal(str(target_quantity)), # Initially free = total
            allocated_quantity=Decimal('0'),
            total_value=Decimal(str(target_quantity)) * Decimal(str(item['unit_cost'])),
            created_at=datetime.fromisoformat(item['created_at'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(item['updated_at'].replace('Z', '+00:00')),
            created_by=item.get('created_by'),
            updated_by=item.get('updated_by')
        )
    
    @staticmethod
    async def update_inventory_item(
        item_id: str,
        item_data: InventoryItemUpdate,
        user_id: str
    ) -> InventoryItemResponse:
        """Update an inventory item."""
        db = get_db()
        
        # Check if item exists
        existing = db.table('inventory_items').select('*').eq('id', item_id).execute()
        
        if not existing.data:
            raise NotFoundException(detail="Inventory item not found")
        
        old_item = existing.data[0]
        
        # Build update dict
        update_dict = {}
        
        if item_data.material_name is not None:
            # Check for duplicate name (excluding current item)
            name_check = db.table('inventory_items').select('id').eq(
                'material_name', item_data.material_name
            ).neq('id', item_id).execute()
            
            if name_check.data:
                raise ValidationException(detail="Material name already exists")
            
            update_dict['material_name'] = item_data.material_name
        
        if item_data.category is not None:
            update_dict['category'] = item_data.category
        
        if item_data.quantity is not None:
            update_dict['quantity'] = float(item_data.quantity)
            
            # Log transaction if quantity changed
            old_qty = Decimal(str(old_item['quantity']))
            new_qty = item_data.quantity
            
            if old_qty != new_qty:
                await InventoryItemsService._log_transaction(
                    inventory_item_id=item_id,
                    transaction_type='ADJUST',
                    quantity_before=old_qty,
                    quantity_change=new_qty - old_qty,
                    quantity_after=new_qty,
                    unit=old_item['unit'],
                    unit_cost=Decimal(str(old_item['unit_cost'])),
                    reason='Manual adjustment via update',
                    user_id=user_id
                )
        
        if item_data.unit is not None:
            update_dict['unit'] = item_data.unit
        
        if item_data.location is not None:
            update_dict['location'] = item_data.location
        
        if item_data.reorder_level is not None:
            # Validate reorder level
            current_qty = Decimal(str(update_dict.get('quantity', old_item['quantity'])))
            if item_data.reorder_level > current_qty:
                raise ValidationException(detail="Reorder level cannot exceed available quantity")
            
            update_dict['reorder_level'] = float(item_data.reorder_level)
        
        if item_data.unit_cost is not None:
            update_dict['unit_cost'] = float(item_data.unit_cost)
        
        # allocated_quantity - Dropped (Not in DB schema)
        pass
        
        if item_data.description is not None:
            update_dict['description'] = item_data.description
        
        if update_dict:
            update_dict['updated_by'] = user_id
            db.table('inventory_items').update(update_dict).eq('id', item_id).execute()
        
        return await InventoryItemsService.get_inventory_item(item_id)
    
    @staticmethod
    async def delete_inventory_item(item_id: str, user_id: str):
        """Soft delete an inventory item."""
        db = get_db()
        
        # Check if item exists
        # Hard delete as there is no is_active or deleted_at column in migration 002
        db.table('inventory_items').delete().eq('id', item_id).execute()
        
        return {"message": "Inventory item deleted successfully"}
    
    @staticmethod
    async def adjust_inventory(
        adjustment: InventoryAdjustmentRequest,
        user_id: str
    ) -> InventoryItemResponse:
        """Adjust inventory quantity."""
        db = get_db()
        
        # Get current item
        item = db.table('inventory_items').select('*').eq('id', adjustment.inventory_item_id).execute()
        
        if not item.data:
            raise NotFoundException(detail="Inventory item not found")
        
        item_data = item.data[0]
        old_qty = Decimal(str(item_data['quantity']))
        new_qty = old_qty + adjustment.adjustment_quantity
        
        if new_qty < 0:
            raise ValidationException(detail="Adjustment would result in negative quantity")
        
        # Update quantity
        db.table('inventory_items').update({
            'quantity': float(new_qty),
            'updated_by': user_id
        }).eq('id', adjustment.inventory_item_id).execute()
        
        # Log transaction
        await InventoryItemsService._log_transaction(
            inventory_item_id=adjustment.inventory_item_id,
            transaction_type='ADJUST',
            quantity_before=old_qty,
            quantity_change=adjustment.adjustment_quantity,
            quantity_after=new_qty,
            unit=item_data['unit'],
            unit_cost=Decimal(str(item_data['unit_cost'])),
            reason=adjustment.reason,
            notes=adjustment.notes,
            user_id=user_id
        )
        
        return await InventoryItemsService.get_inventory_item(adjustment.inventory_item_id)
    
    @staticmethod
    async def _log_transaction(
        inventory_item_id: str,
        transaction_type: str,
        quantity_before: Decimal,
        quantity_change: Decimal,
        quantity_after: Decimal,
        unit: str,
        unit_cost: Decimal,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_number: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        """Internal method to log inventory transaction."""
        db = get_db()
        
        transaction = {
            'inventory_item_id': inventory_item_id,
            'transaction_type': transaction_type,
            'quantity_before': float(quantity_before),
            'quantity_change': float(quantity_change),
            'quantity_after': float(quantity_after),
            'unit': unit,
            'unit_cost': float(unit_cost),
            'reason': reason,
            # 'notes': notes, - Dropped (Not in DB schema)
            'reference_type': reference_type,
            'reference_number': reference_number,
            'created_by': user_id
        }
        
        db.table('inventory_item_transactions').insert(transaction).execute()
    
    @staticmethod
    async def list_transactions(
        item_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        limit: int = 50
    ) -> List[InventoryItemTransactionResponse]:
        """List inventory item transactions."""
        db = get_db()
        
        query = db.table('inventory_item_transactions').select('*')
        
        if item_id:
            query = query.eq('inventory_item_id', item_id)
        
        if transaction_type:
            query = query.eq('transaction_type', transaction_type)
        
        result = query.order('transaction_date', desc=True).limit(limit).execute()
        
        transactions = []
        for trans in result.data:
            # Get item details
            item = db.table('inventory_items').select('material_code', 'material_name').eq('id', trans['inventory_item_id']).execute()
            
            transactions.append(InventoryItemTransactionResponse(
                **trans,
                material_code=item.data[0]['material_code'] if item.data else None,
                material_name=item.data[0]['material_name'] if item.data else None
            ))
        
        return transactions
    
    @staticmethod
    async def get_stock_alerts() -> List[StockAlertItemResponse]:
        """Get active stock alerts."""
        db = get_db()
        
        result = db.table('stock_alerts_items').select('*').eq('status', 'ACTIVE').order('created_at', desc=True).execute()
        
        alerts = []
        for alert in result.data:
            # Get item details
            item = db.table('inventory_items').select('material_code', 'material_name').eq('id', alert['inventory_item_id']).execute()
            
            alerts.append(StockAlertItemResponse(
                **alert,
                material_code=item.data[0]['material_code'] if item.data else None,
                material_name=item.data[0]['material_name'] if item.data else None
            ))
        
        return alerts
    
    @staticmethod
    async def get_inventory_summary() -> InventoryItemsSummary:
        """Get inventory summary KPIs."""
        db = get_db()
        
        result = db.table('inventory_items').select('*').execute()
        
        total_materials = len(result.data)
        low_stock_count = 0
        critical_count = 0
        out_of_stock_count = 0
        sufficient_count = 0
        total_value = Decimal('0')
        
        for item in result.data:
            status = item['status']
            
            if status == 'Out of Stock':
                out_of_stock_count += 1
            elif status == 'Critical':
                critical_count += 1
            elif status == 'Low Stock':
                low_stock_count += 1
            else:
                sufficient_count += 1
            
            total_value += (Decimal(str(item['quantity'])) * Decimal(str(item['unit_cost'])))
        
        return InventoryItemsSummary(
            total_materials=total_materials,
            low_stock_count=low_stock_count,
            critical_count=critical_count,
            out_of_stock_count=out_of_stock_count,
            sufficient_count=sufficient_count,
            total_value=total_value
        )


inventory_items_service = InventoryItemsService()
