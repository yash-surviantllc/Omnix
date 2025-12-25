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
        
        query = db.table('inventory_items').select('*').eq('is_active', True)
        
        if status:
            query = query.eq('status', status)
        
        if category:
            query = query.eq('category', category)
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        items = []
        for item in result.data:
            # Apply search filter
            if search:
                search_lower = search.lower()
                if (search_lower not in item['material_code'].lower() and 
                    search_lower not in item['material_name'].lower()):
                    continue
            
            # Handle backward compatibility for allocated_quantity and free_quantity
            quantity = Decimal(str(item['quantity']))
            allocated = Decimal(str(item.get('allocated_quantity', 0)))
            free = Decimal(str(item.get('free_quantity', quantity)))
            
            items.append(InventoryItemListResponse(
                id=item['id'],
                material_code=item['material_code'],
                material_name=item['material_name'],
                quantity=quantity,
                allocated_quantity=allocated,
                free_quantity=free,
                unit=item['unit'],
                location=item.get('location'),
                reorder_level=Decimal(str(item['reorder_level'])),
                status=item['status'],
                unit_cost=Decimal(str(item['unit_cost'])),
                total_value=Decimal(str(item['total_value']))
            ))
        
        return items
    
    @staticmethod
    async def get_inventory_item(item_id: str) -> InventoryItemResponse:
        """Get inventory item by ID."""
        db = get_db()
        
        result = db.table('inventory_items').select('*').eq('id', item_id).eq('is_active', True).execute()
        
        if not result.data:
            raise NotFoundException(detail="Inventory item not found")
        
        item = result.data[0]
        
        # Handle backward compatibility for allocated_quantity and free_quantity
        if 'allocated_quantity' not in item:
            item['allocated_quantity'] = 0
        if 'free_quantity' not in item:
            item['free_quantity'] = item['quantity']
        
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
        ).eq('is_active', True).execute()
        
        if existing.data:
            raise ValidationException(detail="Material code already exists")
        
        # Check for duplicate material name
        existing_name = db.table('inventory_items').select('id').eq(
            'material_name', item_data.material_name
        ).eq('is_active', True).execute()
        
        if existing_name.data:
            raise ValidationException(detail="Material name already exists")
        
        # Validate reorder level
        if item_data.reorder_level > item_data.quantity:
            raise ValidationException(detail="Reorder level cannot exceed available quantity")
        
        # Create item
        item_dict = item_data.model_dump()
        item_dict['quantity'] = float(item_data.quantity)
        item_dict['reorder_level'] = float(item_data.reorder_level)
        item_dict['unit_cost'] = float(item_data.unit_cost)
        item_dict['created_by'] = user_id
        
        # Determine initial status
        if item_data.quantity == 0:
            item_dict['status'] = 'out_of_stock'
        elif item_data.quantity <= item_data.reorder_level * Decimal('0.5'):
            item_dict['status'] = 'critical'
        elif item_data.quantity <= item_data.reorder_level:
            item_dict['status'] = 'low'
        else:
            item_dict['status'] = 'sufficient'
        
        result = db.table('inventory_items').insert(item_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create inventory item")
        
        item = result.data[0]
        
        # Create initial transaction
        if item_data.quantity > 0:
            await InventoryItemsService._log_transaction(
                inventory_item_id=item['id'],
                transaction_type='IN',
                quantity_before=Decimal('0'),
                quantity_change=item_data.quantity,
                quantity_after=item_data.quantity,
                unit=item_data.unit,
                unit_cost=item_data.unit_cost,
                reason='Initial stock entry',
                user_id=user_id
            )
        
        return await InventoryItemsService.get_inventory_item(item['id'])
    
    @staticmethod
    async def update_inventory_item(
        item_id: str,
        item_data: InventoryItemUpdate,
        user_id: str
    ) -> InventoryItemResponse:
        """Update an inventory item."""
        db = get_db()
        
        # Check if item exists
        existing = db.table('inventory_items').select('*').eq('id', item_id).eq('is_active', True).execute()
        
        if not existing.data:
            raise NotFoundException(detail="Inventory item not found")
        
        old_item = existing.data[0]
        
        # Build update dict
        update_dict = {}
        
        if item_data.material_name is not None:
            # Check for duplicate name (excluding current item)
            name_check = db.table('inventory_items').select('id').eq(
                'material_name', item_data.material_name
            ).neq('id', item_id).eq('is_active', True).execute()
            
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
        
        if item_data.allocated_quantity is not None:
            # Validate allocated quantity doesn't exceed available quantity
            current_qty = Decimal(str(update_dict.get('quantity', old_item['quantity'])))
            if item_data.allocated_quantity > current_qty:
                raise ValidationException(detail="Allocated quantity cannot exceed available quantity")
            
            update_dict['allocated_quantity'] = float(item_data.allocated_quantity)
        
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
        existing = db.table('inventory_items').select('id').eq('id', item_id).eq('is_active', True).execute()
        
        if not existing.data:
            raise NotFoundException(detail="Inventory item not found")
        
        # Soft delete
        db.table('inventory_items').update({
            'is_active': False,
            'deleted_at': datetime.utcnow().isoformat(),
            'updated_by': user_id
        }).eq('id', item_id).execute()
        
        return {"message": "Inventory item deleted successfully"}
    
    @staticmethod
    async def adjust_inventory(
        adjustment: InventoryAdjustmentRequest,
        user_id: str
    ) -> InventoryItemResponse:
        """Adjust inventory quantity."""
        db = get_db()
        
        # Get current item
        item = db.table('inventory_items').select('*').eq('id', adjustment.inventory_item_id).eq('is_active', True).execute()
        
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
            'notes': notes,
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
        
        result = db.table('inventory_items').select('*').eq('is_active', True).execute()
        
        total_materials = len(result.data)
        low_stock_count = 0
        critical_count = 0
        out_of_stock_count = 0
        sufficient_count = 0
        total_value = Decimal('0')
        
        for item in result.data:
            status = item['status']
            
            if status == 'out_of_stock':
                out_of_stock_count += 1
            elif status == 'critical':
                critical_count += 1
            elif status == 'low':
                low_stock_count += 1
            else:
                sufficient_count += 1
            
            total_value += Decimal(str(item['total_value']))
        
        return InventoryItemsSummary(
            total_materials=total_materials,
            low_stock_count=low_stock_count,
            critical_count=critical_count,
            out_of_stock_count=out_of_stock_count,
            sufficient_count=sufficient_count,
            total_value=total_value
        )


inventory_items_service = InventoryItemsService()
