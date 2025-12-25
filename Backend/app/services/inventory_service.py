from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.schemas.inventory import (
    InventoryCreate, InventoryUpdate, InventoryResponse,
    InventoryListItem, StockByProduct, InventoryTransactionCreate,
    InventoryTransactionResponse, StockAlertCreate, StockAlertUpdate,
    StockAlertResponse, ShortageAlert, StockAdjustment, LocationResponse, StockMovementSummary
)
from app.core.exceptions import NotFoundException, ValidationException


class InventoryService:
    
    @staticmethod
    async def list_locations(
        is_active: Optional[bool] = True,
        location_type: Optional[str] = None
    ) -> List[LocationResponse]:
        """List all locations with optional filters."""
        db = get_db()
        
        query = db.table('locations').select('*')
        
        if is_active is not None:
            query = query.eq('is_active', is_active)
        
        if location_type:
            query = query.eq('type', location_type)
        
        result = query.execute()
        
        return [LocationResponse(**loc) for loc in result.data]

    @staticmethod
    async def get_location_by_id(location_id: str) -> LocationResponse:
        """Get location by ID."""
        db = get_db()
        
        result = db.table('locations').select('*').eq('id', location_id).execute()
        
        if not result.data:
            raise NotFoundException(detail="Location not found")
        
        return LocationResponse(**result.data[0])
    
    @staticmethod
    async def get_inventory_by_product_location(
        product_id: str, 
        location_id: str, 
        lot_number: Optional[str] = None
    ) -> Optional[InventoryResponse]:
        """Get inventory for specific product, location, and optional lot."""
        db = get_db()
        
        query = db.table('inventory').select('*').eq('product_id', product_id).eq('location_id', location_id)
        
        if lot_number:
            query = query.eq('lot_number', lot_number)
        
        result = query.execute()
        
        if not result.data:
            return None
        
        inv = result.data[0]
        
        # Get product and location details
        product = db.table('products').select('code', 'name').eq('id', product_id).execute()
        location = db.table('locations').select('code', 'name').eq('id', location_id).execute()
        
        available = Decimal(str(inv['available_qty']))
        allocated = Decimal(str(inv['allocated_qty']))
        
        return InventoryResponse(
            **inv,
            free_qty=available - allocated,
            product_code=product.data[0]['code'] if product.data else None,
            product_name=product.data[0]['name'] if product.data else None,
            location_code=location.data[0]['code'] if location.data else None,
            location_name=location.data[0]['name'] if location.data else None
        )
    
    # @staticmethod
    # async def list_inventory(
    #     page: int = 1,
    #     limit: int = 50,
    #     product_id: Optional[str] = None,
    #     location_id: Optional[str] = None,
    #     search: Optional[str] = None,
    #     low_stock_only: bool = False
    # ) -> List[InventoryListItem]:
    #     """List inventory with filters."""
    #     db = get_db()
        
    #     offset = (page - 1) * limit
        
    #     # Build query
    #     query = db.table('inventory').select('*')
        
    #     if product_id:
    #         query = query.eq('product_id', product_id)
        
    #     if location_id:
    #         query = query.eq('location_id', location_id)
        
    #     result = query.range(offset, offset + limit - 1).execute()
        
    #     inventory_items = []
        
    #     for inv in result.data:
    #         # Get product details
    #         product = db.table('products').select('code', 'name', 'unit').eq('id', inv['product_id']).execute()
    #         if not product.data:
    #             continue
            
    #         # Get location details
    #         location = db.table('locations').select('code', 'name').eq('id', inv['location_id']).execute()
    #         if not location.data:
    #             continue
            
    #         product_data = product.data[0]
    #         location_data = location.data[0]
            
    #         # Apply search filter
    #         if search:
    #             search_lower = search.lower()
    #             if (search_lower not in product_data['code'].lower() and 
    #                 search_lower not in product_data['name'].lower()):
    #                 continue
            
    #         available = Decimal(str(inv['available_qty']))
    #         allocated = Decimal(str(inv['allocated_qty']))
    #         free_qty = available - allocated
            
    #         # Apply low stock filter
    #         if low_stock_only:
    #             # Check if there's a stock alert
    #             alert = db.table('stock_alerts').select('min_qty').eq(
    #                 'product_id', inv['product_id']
    #             ).eq('location_id', inv['location_id']).eq('is_active', True).execute()
                
    #             if alert.data:
    #                 min_qty = Decimal(str(alert.data[0]['min_qty']))
    #                 if available >= min_qty:
    #                     continue
            
    #         inventory_items.append(InventoryListItem(
    #             id=inv['id'],
    #             product_id=inv['product_id'],
    #             product_code=product_data['code'],
    #             product_name=product_data['name'],
    #             location_id=inv['location_id'],
    #             location_code=location_data['code'],
    #             location_name=location_data['name'],
    #             available_qty=available,
    #             allocated_qty=allocated,
    #             free_qty=free_qty,
    #             unit=product_data['unit'],
    #             lot_number=inv.get('lot_number')
    #         ))
        
    #     return inventory_items
    
    @staticmethod
    async def get_stock_by_product(product_id: str) -> StockByProduct:
        """Get stock summary for a product across all locations."""
        db = get_db()
        
        # Get product details
        product = db.table('products').select('code', 'name', 'category', 'unit').eq('id', product_id).execute()
        if not product.data:
            raise NotFoundException(detail="Product not found")
        
        product_data = product.data[0]
        
        # Get inventory across all locations
        inventory = db.table('inventory').select('*').eq('product_id', product_id).execute()
        
        total_available = Decimal('0')
        total_allocated = Decimal('0')
        locations_data = []
        
        for inv in inventory.data:
            location = db.table('locations').select('code', 'name').eq('id', inv['location_id']).execute()
            
            available = Decimal(str(inv['available_qty']))
            allocated = Decimal(str(inv['allocated_qty']))
            
            total_available += available
            total_allocated += allocated
            
            locations_data.append({
                'location_id': inv['location_id'],
                'location_code': location.data[0]['code'] if location.data else '',
                'location_name': location.data[0]['name'] if location.data else '',
                'available_qty': float(available),
                'allocated_qty': float(allocated),
                'free_qty': float(available - allocated),
                'lot_number': inv.get('lot_number')
            })
        
        return StockByProduct(
            product_id=product_id,
            product_code=product_data['code'],
            product_name=product_data['name'],
            category=product_data['category'],
            unit=product_data['unit'],
            total_available=total_available,
            total_allocated=total_allocated,
            total_free=total_available - total_allocated,
            locations=locations_data
        )
    
    @staticmethod
    async def record_transaction(
        transaction_data: InventoryTransactionCreate,
        user_id: str
    ) -> InventoryTransactionResponse:
        """Record an inventory transaction and update stock levels."""
        db = get_db()
        
        # Validate transaction type
        valid_types = ['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT']
        if transaction_data.transaction_type not in valid_types:
            raise ValidationException(detail=f"Invalid transaction type. Must be one of: {', '.join(valid_types)}")
        
        # Create transaction record
        trans_dict = transaction_data.model_dump()
        trans_dict['performed_by'] = user_id
        trans_dict['quantity'] = float(transaction_data.quantity)
        
        trans_result = db.table('inventory_transactions').insert(trans_dict).execute()
        
        if not trans_result.data:
            raise Exception("Failed to create transaction")
        
        transaction = trans_result.data[0]
        
        # Update inventory based on transaction type
        if transaction_data.transaction_type == 'RECEIPT':
            # Add stock to location
            await InventoryService._update_stock(
                product_id=transaction_data.product_id,
                location_id=transaction_data.to_location_id,
                quantity_change=transaction_data.quantity,
                lot_number=transaction_data.lot_number
            )
        
        elif transaction_data.transaction_type == 'ISSUE':
            # Remove stock from location
            await InventoryService._update_stock(
                product_id=transaction_data.product_id,
                location_id=transaction_data.from_location_id,
                quantity_change=-transaction_data.quantity,
                lot_number=transaction_data.lot_number
            )
        
        elif transaction_data.transaction_type == 'TRANSFER':
            # Remove from source, add to destination
            await InventoryService._update_stock(
                product_id=transaction_data.product_id,
                location_id=transaction_data.from_location_id,
                quantity_change=-transaction_data.quantity,
                lot_number=transaction_data.lot_number
            )
            await InventoryService._update_stock(
                product_id=transaction_data.product_id,
                location_id=transaction_data.to_location_id,
                quantity_change=transaction_data.quantity,
                lot_number=transaction_data.lot_number
            )
        
        elif transaction_data.transaction_type == 'ADJUSTMENT':
            # Adjust stock at location
            await InventoryService._update_stock(
                product_id=transaction_data.product_id,
                location_id=transaction_data.to_location_id or transaction_data.from_location_id,
                quantity_change=transaction_data.quantity,
                lot_number=transaction_data.lot_number
            )
        
        # Get complete transaction details
        return await InventoryService.get_transaction_by_id(transaction['id'])
    
    @staticmethod
    async def _update_stock(
        product_id: str,
        location_id: str,
        quantity_change: Decimal,
        lot_number: Optional[str] = None
    ):
        """Internal method to update stock levels."""
        db = get_db()
        
        # Find existing inventory
        query = db.table('inventory').select('*').eq('product_id', product_id).eq('location_id', location_id)
        
        if lot_number:
            query = query.eq('lot_number', lot_number)
        else:
            query = query.is_('lot_number', 'null')
        
        existing = query.execute()
        
        if existing.data:
            # Update existing
            inv = existing.data[0]
            new_available = Decimal(str(inv['available_qty'])) + quantity_change
            
            if new_available < 0:
                raise ValidationException(detail="Insufficient stock for this operation")
            
            db.table('inventory').update({
                'available_qty': float(new_available),
                'last_updated': datetime.utcnow().isoformat()
            }).eq('id', inv['id']).execute()
        else:
            # Create new inventory record
            if quantity_change < 0:
                raise ValidationException(detail="Cannot create inventory with negative quantity")
            
            db.table('inventory').insert({
                'product_id': product_id,
                'location_id': location_id,
                'available_qty': float(quantity_change),
                'allocated_qty': 0,
                'in_transit_qty': 0,
                'lot_number': lot_number
            }).execute()
    
    @staticmethod
    async def get_transaction_by_id(transaction_id: str) -> InventoryTransactionResponse:
        """Get transaction details."""
        db = get_db()
        
        trans = db.table('inventory_transactions').select('*').eq('id', transaction_id).execute()
        
        if not trans.data:
            raise NotFoundException(detail="Transaction not found")
        
        trans_data = trans.data[0]
        
        # Get product, locations, user details
        product = db.table('products').select('code', 'name').eq('id', trans_data['product_id']).execute()
        
        from_location = None
        if trans_data.get('from_location_id'):
            from_location = db.table('locations').select('name').eq('id', trans_data['from_location_id']).execute()
        
        to_location = None
        if trans_data.get('to_location_id'):
            to_location = db.table('locations').select('name').eq('id', trans_data['to_location_id']).execute()
        
        user = None
        if trans_data.get('performed_by'):
            user = db.table('users').select('full_name').eq('id', trans_data['performed_by']).execute()
        
        return InventoryTransactionResponse(
            **trans_data,
            product_code=product.data[0]['code'] if product.data else None,
            product_name=product.data[0]['name'] if product.data else None,
            from_location_name=from_location.data[0]['name'] if from_location and from_location.data else None,
            to_location_name=to_location.data[0]['name'] if to_location and to_location.data else None,
            performed_by_name=user.data[0]['full_name'] if user and user.data else None
        )
    
    @staticmethod
    async def list_transactions(
        page: int = 1,
        limit: int = 50,
        product_id: Optional[str] = None,
        location_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> List[InventoryTransactionResponse]:
        """List inventory transactions with filters."""
        db = get_db()
        
        offset = (page - 1) * limit
        
        query = db.table('inventory_transactions').select('*')
        
        if product_id:
            query = query.eq('product_id', product_id)
        
        if location_id:
            query = query.or_(f'from_location_id.eq.{location_id},to_location_id.eq.{location_id}')
        
        if transaction_type:
            query = query.eq('transaction_type', transaction_type)
        
        if date_from:
            query = query.gte('transaction_date', date_from)
        
        if date_to:
            query = query.lte('transaction_date', date_to)
        
        result = query.order('transaction_date', desc=True).range(offset, offset + limit - 1).execute()
        
        transactions = []
        for trans in result.data:
            # Get product details
            product = db.table('products').select('code', 'name').eq('id', trans['product_id']).execute()
            
            from_location = None
            if trans.get('from_location_id'):
                from_location = db.table('locations').select('name').eq('id', trans['from_location_id']).execute()
            
            to_location = None
            if trans.get('to_location_id'):
                to_location = db.table('locations').select('name').eq('id', trans['to_location_id']).execute()
            
            user = None
            if trans.get('performed_by'):
                user = db.table('users').select('full_name').eq('id', trans['performed_by']).execute()
            
            transactions.append(InventoryTransactionResponse(
                **trans,
                product_code=product.data[0]['code'] if product.data else None,
                product_name=product.data[0]['name'] if product.data else None,
                from_location_name=from_location.data[0]['name'] if from_location and from_location.data else None,
                to_location_name=to_location.data[0]['name'] if to_location and to_location.data else None,
                performed_by_name=user.data[0]['full_name'] if user and user.data else None
            ))
        
        return transactions
    
    @staticmethod
    async def create_stock_alert(
        alert_data: StockAlertCreate,
        user_id: str
    ) -> StockAlertResponse:
        """Create a new stock alert."""
        db = get_db()
        
        # Check if alert already exists for this product-location combination
        existing = db.table('stock_alerts').select('id').eq(
            'product_id', alert_data.product_id
        )
        
        if alert_data.location_id:
            existing = existing.eq('location_id', alert_data.location_id)
        else:
            existing = existing.is_('location_id', 'null')
        
        existing_result = existing.execute()
        
        if existing_result.data:
            raise ValidationException(detail="Stock alert already exists for this product and location")
        
        # Create alert
        alert_dict = alert_data.model_dump()
        alert_dict['min_qty'] = float(alert_data.min_qty)
        
        if alert_data.max_qty:
            alert_dict['max_qty'] = float(alert_data.max_qty)
        
        if alert_data.reorder_qty:
            alert_dict['reorder_qty'] = float(alert_data.reorder_qty)
        
        result = db.table('stock_alerts').insert(alert_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create stock alert")
        
        return await InventoryService.get_stock_alert_by_id(result.data[0]['id'])

    @staticmethod
    async def list_stock_alerts(
        is_active: Optional[bool] = True,
        product_id: Optional[str] = None,
        location_id: Optional[str] = None
    ) -> List[StockAlertResponse]:
        """List stock alerts with filters."""
        db = get_db()
        
        query = db.table('stock_alerts').select('*')
        
        if is_active is not None:
            query = query.eq('is_active', is_active)
        
        if product_id:
            query = query.eq('product_id', product_id)
        
        if location_id:
            query = query.eq('location_id', location_id)
        
        result = query.execute()
        
        alerts = []
        for alert in result.data:
            # Get product details
            product = db.table('products').select('code', 'name').eq('id', alert['product_id']).execute()
            
            location_name = None
            if alert.get('location_id'):
                location = db.table('locations').select('name').eq('id', alert['location_id']).execute()
                location_name = location.data[0]['name'] if location.data else None
            
            alerts.append(StockAlertResponse(
                **alert,
                product_code=product.data[0]['code'] if product.data else None,
                product_name=product.data[0]['name'] if product.data else None,
                location_name=location_name
            ))
        
        return alerts

    @staticmethod
    async def get_stock_alert_by_id(alert_id: str) -> StockAlertResponse:
        """Get stock alert by ID."""
        db = get_db()
        
        result = db.table('stock_alerts').select('*').eq('id', alert_id).execute()
        
        if not result.data:
            raise NotFoundException(detail="Stock alert not found")
        
        alert = result.data[0]
        
        # Get product details
        product = db.table('products').select('code', 'name').eq('id', alert['product_id']).execute()
        
        location_name = None
        if alert.get('location_id'):
            location = db.table('locations').select('name').eq('id', alert['location_id']).execute()
            location_name = location.data[0]['name'] if location.data else None
        
        return StockAlertResponse(
            **alert,
            product_code=product.data[0]['code'] if product.data else None,
            product_name=product.data[0]['name'] if product.data else None,
            location_name=location_name
        )

    @staticmethod
    async def update_stock_alert(
        alert_id: str,
        alert_data: StockAlertUpdate,
        user_id: str
    ) -> StockAlertResponse:
        """Update stock alert."""
        db = get_db()
        
        # Check if alert exists
        existing = db.table('stock_alerts').select('id').eq('id', alert_id).execute()
        
        if not existing.data:
            raise NotFoundException(detail="Stock alert not found")
        
        # Build update dict
        update_dict = {}
        
        if alert_data.min_qty is not None:
            update_dict['min_qty'] = float(alert_data.min_qty)
        
        if alert_data.max_qty is not None:
            update_dict['max_qty'] = float(alert_data.max_qty)
        
        if alert_data.reorder_qty is not None:
            update_dict['reorder_qty'] = float(alert_data.reorder_qty)
        
        if alert_data.is_active is not None:
            update_dict['is_active'] = alert_data.is_active
        
        if update_dict:
            update_dict['updated_at'] = datetime.utcnow().isoformat()
            db.table('stock_alerts').update(update_dict).eq('id', alert_id).execute()
        
        return await InventoryService.get_stock_alert_by_id(alert_id)

    @staticmethod
    async def delete_stock_alert(alert_id: str):
        """Delete stock alert."""
        db = get_db()
        
        result = db.table('stock_alerts').delete().eq('id', alert_id).execute()
        
        if not result.data:
            raise NotFoundException(detail="Stock alert not found")
        
        return {"message": "Stock alert deleted successfully"}
    
    @staticmethod
    async def get_shortage_alerts() -> List[ShortageAlert]:
        """Get all items below minimum stock level."""
        db = get_db()
        
        # Get all active stock alerts
        alerts = db.table('stock_alerts').select('*').eq('is_active', True).execute()
        
        shortages = []
        
        for alert in alerts.data:
            # Get current stock
            inv_query = db.table('inventory').select('available_qty').eq('product_id', alert['product_id'])
            
            if alert.get('location_id'):
                inv_query = inv_query.eq('location_id', alert['location_id'])
            
            inv_result = inv_query.execute()
            
            current_stock = sum(Decimal(str(i['available_qty'])) for i in inv_result.data) if inv_result.data else Decimal('0')
            min_qty = Decimal(str(alert['min_qty']))
            
            if current_stock < min_qty:
                # Get product details
                product = db.table('products').select('code', 'name', 'unit').eq('id', alert['product_id']).execute()
                
                location_name = None
                if alert.get('location_id'):
                    location = db.table('locations').select('name').eq('id', alert['location_id']).execute()
                    location_name = location.data[0]['name'] if location.data else None
                
                shortage_qty = min_qty - current_stock
                
                # Determine priority
                if current_stock == 0:
                    priority = 'CRITICAL'
                elif current_stock < (min_qty * Decimal('0.5')):
                    priority = 'HIGH'
                else:
                    priority = 'MEDIUM'
                
                if product.data:
                    shortages.append(ShortageAlert(
                        product_id=alert['product_id'],
                        product_code=product.data[0]['code'],
                        product_name=product.data[0]['name'],
                        location_id=alert.get('location_id'),
                        location_name=location_name,
                        current_stock=current_stock,
                        min_qty=min_qty,
                        shortage_qty=shortage_qty,
                        unit=product.data[0]['unit'],
                        priority=priority
                    ))
        
        return shortages

    @staticmethod
    async def get_inventory_summary() -> dict:
        """Get inventory summary KPIs for dashboard cards."""
        db = get_db()
        
        # Get all inventory items
        inventory = db.table('inventory').select('*').execute()
        
        total_materials = len(inventory.data)
        low_stock_count = 0
        critical_count = 0
        sufficient_count = 0
        
        for inv in inventory.data:
            # Check stock alert for this product-location
            alert = db.table('stock_alerts').select('min_qty').eq(
                'product_id', inv['product_id']
            ).eq('location_id', inv['location_id']).eq('is_active', True).execute()
            
            available = Decimal(str(inv['available_qty']))
            
            if alert.data:
                min_qty = Decimal(str(alert.data[0]['min_qty']))
                
                if available == 0:
                    critical_count += 1
                elif available < min_qty:
                    low_stock_count += 1
                else:
                    sufficient_count += 1
            else:
                sufficient_count += 1
        
        return {
            "total_materials": total_materials,
            "low_stock_count": low_stock_count,
            "critical_count": critical_count,
            "sufficient_count": sufficient_count
        }


    @staticmethod
    async def list_inventory(
        page: int = 1,
        limit: int = 50,
        product_id: Optional[str] = None,
        location_id: Optional[str] = None,
        search: Optional[str] = None,
        low_stock_only: bool = False
    ) -> List[InventoryListItem]:
        """List inventory with filters."""
        db = get_db()
        
        offset = (page - 1) * limit
        
        # Build query
        query = db.table('inventory').select('*')
        
        if product_id:
            query = query.eq('product_id', product_id)
        
        if location_id:
            query = query.eq('location_id', location_id)
        
        result = query.range(offset, offset + limit - 1).execute()
        
        inventory_items = []
        
        for inv in result.data:
            # Get product details
            product = db.table('products').select('code', 'name', 'unit').eq('id', inv['product_id']).execute()
            if not product.data:
                continue
            
            # Get location details
            location = db.table('locations').select('code', 'name').eq('id', inv['location_id']).execute()
            if not location.data:
                continue
            
            product_data = product.data[0]
            location_data = location.data[0]
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if (search_lower not in product_data['code'].lower() and 
                    search_lower not in product_data['name'].lower()):
                    continue
            
            available = Decimal(str(inv['available_qty']))
            allocated = Decimal(str(inv['allocated_qty']))
            free_qty = available - allocated
            
            # Check stock alert to determine status and reorder level
            alert = db.table('stock_alerts').select('min_qty').eq(
                'product_id', inv['product_id']
            ).eq('location_id', inv['location_id']).eq('is_active', True).execute()
            
            status = "Sufficient"
            reorder_level = None
            
            if alert.data:
                min_qty = Decimal(str(alert.data[0]['min_qty']))
                reorder_level = min_qty
                
                # Determine status
                if available == 0:
                    status = "Critical"
                elif available < min_qty:
                    status = "Low Stock"
                else:
                    status = "Sufficient"
                
                # Apply low stock filter
                if low_stock_only and status == "Sufficient":
                    continue
            
            inventory_items.append(InventoryListItem(
                id=inv['id'],
                product_id=inv['product_id'],
                product_code=product_data['code'],
                product_name=product_data['name'],
                location_id=inv['location_id'],
                location_code=location_data['code'],
                location_name=location_data['name'],
                available_qty=available,
                allocated_qty=allocated,
                free_qty=free_qty,
                unit=product_data['unit'],
                lot_number=inv.get('lot_number'),
                reorder_level=reorder_level,
                status=status
            ))
        
        return inventory_items

    @staticmethod
    async def log_transaction(
        product_id: str,
        transaction_type: str,
        quantity: Decimal,
        user_id: str,
        from_location_id: Optional[str] = None,
        to_location_id: Optional[str] = None,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        notes: Optional[str] = None
    ):
        """Log inventory transaction for audit trail."""
        db = get_db()
        
        transaction = {
            'product_id': product_id,
            'transaction_type': transaction_type,
            'quantity': float(quantity),
            'from_location_id': from_location_id,
            'to_location_id': to_location_id,
            'reference_id': reference_id,
            'reference_type': reference_type,
            'notes': notes,
            'performed_by': user_id
        }
        
        result = db.table('inventory_transactions').insert(transaction).execute()
        return result.data[0] if result.data else None


    @staticmethod
    async def get_transaction_history(
        product_id: Optional[str] = None,
        location_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50
    ) -> List[InventoryTransactionResponse]:
        """Get inventory transaction history with filters."""
        db = get_db()
        
        query = db.table('inventory_transactions').select('*')
        
        if product_id:
            query = query.eq('product_id', product_id)
        
        if transaction_type:
            query = query.eq('transaction_type', transaction_type)
        
        if location_id:
            query = query.or_(f'from_location_id.eq.{location_id},to_location_id.eq.{location_id}')
        
        if start_date:
            query = query.gte('created_at', start_date.isoformat())
        
        if end_date:
            query = query.lte('created_at', end_date.isoformat())
        
        result = query.order('created_at', desc=True).limit(limit).execute()
        
        transactions = []
        for trans in result.data:
            # Get product info
            product = db.table('products').select('code', 'name').eq('id', trans['product_id']).execute()
            
            # Get location names
            from_loc = None
            to_loc = None
            
            if trans.get('from_location_id'):
                from_loc_data = db.table('locations').select('name').eq('id', trans['from_location_id']).execute()
                from_loc = from_loc_data.data[0]['name'] if from_loc_data.data else None
            
            if trans.get('to_location_id'):
                to_loc_data = db.table('locations').select('name').eq('id', trans['to_location_id']).execute()
                to_loc = to_loc_data.data[0]['name'] if to_loc_data.data else None
            
            transactions.append(InventoryTransactionResponse(
                id=trans['id'],
                product_id=trans['product_id'],
                product_code=product.data[0]['code'] if product.data else None,
                product_name=product.data[0]['name'] if product.data else None,
                transaction_type=trans['transaction_type'],
                quantity=Decimal(str(trans['quantity'])),
                from_location_id=trans.get('from_location_id'),
                from_location_name=from_loc,
                to_location_id=trans.get('to_location_id'),
                to_location_name=to_loc,
                reference_id=trans.get('reference_id'),
                reference_type=trans.get('reference_type'),
                notes=trans.get('notes'),
                performed_by=trans.get('performed_by'),
                created_at=datetime.fromisoformat(trans['created_at'].replace('Z', '+00:00'))
            ))
        
        return transactions


    @staticmethod
    async def adjust_inventory(
        product_id: str,
        location_id: str,
        adjustment_qty: Decimal,
        reason: str,
        user_id: str,
        notes: Optional[str] = None
    ) -> InventoryResponse:
        """
        Adjust inventory (stock count corrections, damaged goods, etc.)
        Positive qty = increase, Negative qty = decrease
        """
        db = get_db()
        
        # Get current inventory
        inv = db.table('inventory').select('*').eq('product_id', product_id).eq('location_id', location_id).execute()
        
        if not inv.data:
            # Create new inventory record if doesn't exist
            if adjustment_qty < 0:
                raise ValidationException(detail="Cannot decrease non-existent inventory")
            
            db.table('inventory').insert({
                'product_id': product_id,
                'location_id': location_id,
                'available_qty': float(adjustment_qty),
                'allocated_qty': 0
            }).execute()
        else:
            current = inv.data[0]
            new_qty = Decimal(str(current['available_qty'])) + adjustment_qty
            
            if new_qty < 0:
                raise ValidationException(detail="Adjustment would result in negative inventory")
            
            db.table('inventory').update({
                'available_qty': float(new_qty),
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', current['id']).execute()
        
        # Log transaction
        await InventoryService.log_transaction(
            product_id=product_id,
            transaction_type='ADJUSTMENT',
            quantity=abs(adjustment_qty),
            user_id=user_id,
            from_location_id=location_id if adjustment_qty < 0 else None,
            to_location_id=location_id if adjustment_qty > 0 else None,
            reference_type='stock_adjustment',
            notes=f"{reason}. {notes}" if notes else reason
        )
        
        return await InventoryService.get_inventory_by_id(inv.data[0]['id'] if inv.data else None)


    @staticmethod
    async def get_stock_movement_summary(
        product_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> StockMovementSummary:
        """Get summary of stock movements for a product."""
        db = get_db()
        
        # Get product info
        product = db.table('products').select('code', 'name').eq('id', product_id).execute()
        if not product.data:
            raise NotFoundException(detail="Product not found")
        
        # Get transactions
        query = db.table('inventory_transactions').select('transaction_type', 'quantity').eq('product_id', product_id)
        
        if start_date:
            query = query.gte('created_at', start_date.isoformat())
        if end_date:
            query = query.lte('created_at', end_date.isoformat())
        
        result = query.execute()
        
        total_in = Decimal('0')
        total_out = Decimal('0')
        
        for trans in result.data:
            qty = Decimal(str(trans['quantity']))
            trans_type = trans['transaction_type']
            
            if trans_type in ['GATE_IN', 'TRANSFER_IN', 'ADJUSTMENT']:
                total_in += qty
            elif trans_type in ['GATE_OUT', 'TRANSFER_OUT', 'PRODUCTION', 'ALLOCATION']:
                total_out += qty
        
        return StockMovementSummary(
            product_id=product_id,
            product_code=product.data[0]['code'],
            product_name=product.data[0]['name'],
            total_in=total_in,
            total_out=total_out,
            net_movement=total_in - total_out,
            transaction_count=len(result.data)
        )


    @staticmethod
    async def allocate_inventory(
        product_id: str,
        location_id: str,
        quantity: Decimal,
        reference_id: str,
        reference_type: str,
        user_id: str
    ) -> dict:
        """
        Allocate inventory for production order or reservation.
        Moves quantity from free to allocated.
        """
        db = get_db()
        
        # Get inventory
        inv = db.table('inventory').select('*').eq('product_id', product_id).eq('location_id', location_id).execute()
        
        if not inv.data:
            raise NotFoundException(detail="Inventory not found")
        
        current = inv.data[0]
        available = Decimal(str(current['available_qty']))
        allocated = Decimal(str(current['allocated_qty']))
        free = available - allocated
        
        if free < quantity:
            raise ValidationException(detail=f"Insufficient free inventory. Available: {free}, Requested: {quantity}")
        
        # Update allocation
        db.table('inventory').update({
            'allocated_qty': float(allocated + quantity),
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', current['id']).execute()
        
        # Log transaction
        await InventoryService.log_transaction(
            product_id=product_id,
            transaction_type='ALLOCATION',
            quantity=quantity,
            user_id=user_id,
            from_location_id=location_id,
            reference_id=reference_id,
            reference_type=reference_type,
            notes=f"Allocated for {reference_type}"
        )
        
        return {"message": "Inventory allocated successfully", "allocated_qty": float(quantity)}


    @staticmethod
    async def release_allocation(
        product_id: str,
        location_id: str,
        quantity: Decimal,
        reference_id: str,
        reference_type: str,
        user_id: str
    ) -> dict:
        """
        Release allocated inventory (e.g., production order cancelled).
        Moves quantity from allocated back to free.
        """
        db = get_db()
        
        # Get inventory
        inv = db.table('inventory').select('*').eq('product_id', product_id).eq('location_id', location_id).execute()
        
        if not inv.data:
            raise NotFoundException(detail="Inventory not found")
        
        current = inv.data[0]
        allocated = Decimal(str(current['allocated_qty']))
        
        if allocated < quantity:
            raise ValidationException(detail=f"Cannot release more than allocated. Allocated: {allocated}, Requested: {quantity}")
        
        # Release allocation
        db.table('inventory').update({
            'allocated_qty': float(allocated - quantity),
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', current['id']).execute()
        
        # Log transaction
        await InventoryService.log_transaction(
            product_id=product_id,
            transaction_type='RELEASE',
            quantity=quantity,
            user_id=user_id,
            to_location_id=location_id,
            reference_id=reference_id,
            reference_type=reference_type,
            notes=f"Released from {reference_type}"
        )
        
        return {"message": "Allocation released successfully", "released_qty": float(quantity)}

# Singleton instance
inventory_service = InventoryService()