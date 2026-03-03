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
    def _compute_status(
        quantity: Decimal,
        reorder_level: Decimal,
        min_stock_level: Decimal = Decimal('0')
    ) -> str:
        """
        Compute inventory status from quantity, reorder_level, and min_stock_level.
        Returns Title Case string matching frontend expectations.

        Thresholds:
          qty <= 0                               -> 'Out of Stock'
          min_stock_level > 0:
            qty <= min_stock_level               -> 'Critical'  (below safety stock)
          else (min_stock_level not set):
            qty <= reorder_level * 0.25          -> 'Critical'  (25% heuristic)
          qty <= reorder_level                   -> 'Low Stock'  (below reorder point)
          qty >  reorder_level                   -> 'Sufficient'
        """
        if quantity <= Decimal('0'):
            return 'Out of Stock'
        # Use min_stock_level (safety stock) when explicitly configured (> 0)
        if min_stock_level > Decimal('0'):
            if quantity <= min_stock_level:
                return 'Critical'
        elif reorder_level > Decimal('0') and quantity <= reorder_level * Decimal('0.25'):
            # Fallback heuristic: 25% of reorder level
            return 'Critical'
        if reorder_level > Decimal('0') and quantity <= reorder_level:
            return 'Low Stock'
        return 'Sufficient'
    
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
            # Use ilike for case-insensitive matching (handles legacy lowercase rows)
            query = query.ilike('status', status)
        
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
                min_stock_level=Decimal(str(item.get('min_stock_level', 0) or 0)),
                max_stock_level=Decimal(str(item.get('max_stock_level'))) if item.get('max_stock_level') is not None else None,
                # Normalize status to Title Case — DB may have legacy lowercase values.
                # _compute_status recalculates from quantity+reorder_level+min_stock_level
                # always producing correct Title Case without depending on stale DB status.
                status=InventoryItemsService._compute_status(
                    quantity,
                    Decimal(str(item.get('reorder_level', 0))),
                    Decimal(str(item.get('min_stock_level', 0) or 0))
                ),
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
        # Normalize status to Title Case regardless of what the DB stored (Fix 15),
        # and use min_stock_level for accurate Critical threshold (Fix 16)
        item['status'] = InventoryItemsService._compute_status(
            quantity,
            Decimal(str(item.get('reorder_level', 0))),
            Decimal(str(item.get('min_stock_level', 0) or 0))
        )
        
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
        
        # Validate inputs — NOTE: reorder_level > quantity is NOT an error.
        # A reorder level higher than current stock simply means we're already
        # below the reorder threshold and should reorder. Do not block creation.
        
        # Create item
        item_dict = item_data.model_dump()
        # FIX: Insert with 0 quantity first. The transaction trigger will update it to the correct value.
        # This prevents double counting (Insert + Trigger Update).
        target_quantity = Decimal(str(item_data.quantity))
        item_dict['quantity'] = 0.0
        item_dict['reorder_level'] = float(item_data.reorder_level)
        item_dict['min_stock_level'] = float(item_data.min_stock_level) if item_data.min_stock_level is not None else 0.0
        item_dict['max_stock_level'] = float(item_data.max_stock_level) if item_data.max_stock_level is not None else None
        item_dict['unit_cost'] = float(item_data.unit_cost)
        item_dict['created_by'] = user_id
        
        # Determine initial status based on TARGET quantity using shared helper
        item_dict['status'] = InventoryItemsService._compute_status(
            target_quantity,
            Decimal(str(item_data.reorder_level)),
            Decimal(str(item_data.min_stock_level or 0))
        )
        
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
            # Do NOT add quantity to update_dict.
            # The DB trigger apply_inventory_item_transaction (BEFORE INSERT on
            # inventory_item_transactions) is the sole authority for updating
            # inventory_items.quantity. Adding quantity to update_dict AND logging
            # a transaction would apply the change twice.
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
                # Recalculate and persist status based on new quantity
                new_status = InventoryItemsService._compute_status(
                    new_qty,
                    Decimal(str(old_item['reorder_level'])),
                    Decimal(str(old_item.get('min_stock_level', 0) or 0))
                )
                update_dict['status'] = new_status
        
        if item_data.unit is not None:
            update_dict['unit'] = item_data.unit
        
        if item_data.location is not None:
            update_dict['location'] = item_data.location
        
        if item_data.reorder_level is not None:
            # No quantity floor check here — reorder level CAN legitimately exceed
            # current quantity; that is precisely the condition that signals reordering
            # is needed. We do recalculate status if reorder_level changes.
            update_dict['reorder_level'] = float(item_data.reorder_level)
            # Recompute status in case new reorder_level changes the threshold bracket
            current_qty_for_status = Decimal(str(old_item['quantity']))
            new_status = InventoryItemsService._compute_status(
                current_qty_for_status,
                item_data.reorder_level,
                Decimal(str(old_item.get('min_stock_level', 0) or 0))
            )
            update_dict['status'] = new_status
        
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
        
        # Do NOT update quantity directly here.
        # The DB trigger apply_inventory_item_transaction (BEFORE INSERT on
        # inventory_item_transactions) reads current quantity and applies
        # quantity_change atomically. A direct UPDATE here followed by the
        # transaction INSERT would apply the change twice (double-update bug).
        
        # Log transaction — trigger handles the quantity update
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
        
        # Recalculate and persist status based on new quantity
        new_status = InventoryItemsService._compute_status(
            new_qty,
            Decimal(str(item_data['reorder_level'])),
            Decimal(str(item_data.get('min_stock_level', 0) or 0))
        )
        db.table('inventory_items').update({
            'status': new_status,
            'updated_by': user_id
        }).eq('id', adjustment.inventory_item_id).execute()
        
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
        
        result = query.order('created_at', desc=True).limit(limit).execute()
        
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
            
            # Compare case-insensitively to handle legacy lowercase DB values
            # ('sufficient') and current Title Case values ('Sufficient', etc.)
            status_lower = status.lower() if status else ''
            if status_lower == 'out of stock':
                out_of_stock_count += 1
            elif status_lower == 'critical':
                critical_count += 1
            elif status_lower == 'low stock':
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
