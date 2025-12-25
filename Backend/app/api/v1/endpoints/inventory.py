from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.inventory import (
    InventoryResponse, InventoryListItem, StockByProduct,
    InventoryTransactionCreate, InventoryTransactionResponse,
    StockAlertCreate, StockAlertUpdate, StockAlertResponse,
    ShortageAlert, LocationResponse
)
from app.schemas.user import UserResponse
from app.services.inventory_service import inventory_service
from app.api.deps import get_current_user, require_role
from app.schemas.inventory import InventoryTransactionCreate
from decimal import Decimal

router = APIRouter()


# =============================================
# LOCATIONS ENDPOINTS
# =============================================

@router.get("/locations", response_model=List[LocationResponse])
async def list_locations(
    is_active: Optional[bool] = True,
    location_type: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all locations.
    
    - **is_active**: Filter by active status
    - **location_type**: Filter by type (Store, Production Line, Warehouse, etc.)
    """
    return await inventory_service.list_locations(is_active, location_type)


@router.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get location details by ID.
    """
    return await inventory_service.get_location_by_id(location_id)


# =============================================
# INVENTORY ENDPOINTS
# =============================================

@router.get("/", response_model=List[InventoryListItem])
async def list_inventory(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    product_id: Optional[str] = None,
    location_id: Optional[str] = None,
    search: Optional[str] = None,
    low_stock_only: bool = False,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List inventory with pagination and filters.
    
    - **page**: Page number
    - **limit**: Items per page (max 100)
    - **product_id**: Filter by specific product
    - **location_id**: Filter by specific location
    - **search**: Search in product code/name
    - **low_stock_only**: Show only items below minimum stock level
    """
    return await inventory_service.list_inventory(
        page, limit, product_id, location_id, search, low_stock_only
    )


@router.get("/by-product/{product_id}", response_model=StockByProduct)
async def get_stock_by_product(
    product_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get stock summary for a product across all locations.
    
    Returns:
    - Total available/allocated/free quantities
    - Breakdown by each location
    - Product details
    """
    return await inventory_service.get_stock_by_product(product_id)


@router.get("/by-location", response_model=InventoryResponse)
async def get_inventory_by_location(
    product_id: str = Query(..., description="Product ID"),
    location_id: str = Query(..., description="Location ID"),
    lot_number: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get inventory for specific product and location.
    
    - **product_id**: Product ID (required)
    - **location_id**: Location ID (required)
    - **lot_number**: Optional lot/batch number for specific tracking
    """
    return await inventory_service.get_inventory_by_product_location(
        product_id, location_id, lot_number
    )


# =============================================
# INVENTORY TRANSACTIONS ENDPOINTS
# =============================================

@router.post("/transactions", response_model=InventoryTransactionResponse, status_code=201)
async def record_transaction(
    transaction_data: InventoryTransactionCreate,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Record an inventory transaction.
    
    **Transaction Types:**
    - **RECEIPT**: Add stock to location (to_location_id required)
    - **ISSUE**: Remove stock from location (from_location_id required)
    - **TRANSFER**: Move stock between locations (both required)
    - **ADJUSTMENT**: Adjust stock at location (to_location_id OR from_location_id required)
    
    Updates inventory levels automatically.
    """
    return await inventory_service.record_transaction(
        transaction_data, current_user.id
    )


@router.get("/transactions", response_model=List[InventoryTransactionResponse])
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    product_id: Optional[str] = None,
    location_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List inventory transactions with filters.
    
    - **product_id**: Filter by product
    - **location_id**: Filter by location (from or to)
    - **transaction_type**: RECEIPT, ISSUE, TRANSFER, ADJUSTMENT
    - **date_from/date_to**: Date range filter
    """
    return await inventory_service.list_transactions(
        page, limit, product_id, location_id, transaction_type, date_from, date_to
    )


@router.get("/transactions/{transaction_id}", response_model=InventoryTransactionResponse)
async def get_transaction(
    transaction_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get transaction details by ID.
    """
    return await inventory_service.get_transaction_by_id(transaction_id)


# =============================================
# STOCK ALERTS ENDPOINTS
# =============================================

@router.post("/alerts", response_model=StockAlertResponse, status_code=201)
async def create_stock_alert(
    alert_data: StockAlertCreate,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Create a stock alert for min/max levels.
    
    - **product_id**: Product to monitor
    - **location_id**: Location (NULL = all locations)
    - **min_qty**: Minimum stock level (triggers alert)
    - **max_qty**: Maximum stock level (optional)
    - **reorder_qty**: Recommended reorder quantity
    """
    return await inventory_service.create_stock_alert(alert_data, current_user.id)


@router.get("/alerts", response_model=List[StockAlertResponse])
async def list_stock_alerts(
    is_active: Optional[bool] = True,
    product_id: Optional[str] = None,
    location_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all stock alerts.
    
    - **is_active**: Filter by active status
    - **product_id**: Filter by product
    - **location_id**: Filter by location
    """
    return await inventory_service.list_stock_alerts(is_active, product_id, location_id)


@router.get("/alerts/{alert_id}", response_model=StockAlertResponse)
async def get_stock_alert(
    alert_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get stock alert by ID.
    """
    return await inventory_service.get_stock_alert_by_id(alert_id)


@router.put("/alerts/{alert_id}", response_model=StockAlertResponse)
async def update_stock_alert(
    alert_id: str,
    alert_data: StockAlertUpdate,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Update stock alert.
    
    Can update min_qty, max_qty, reorder_qty, or is_active status.
    """
    return await inventory_service.update_stock_alert(alert_id, alert_data, current_user.id)


@router.delete("/alerts/{alert_id}")
async def delete_stock_alert(
    alert_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Delete stock alert (Admin only).
    """
    return await inventory_service.delete_stock_alert(alert_id)


# =============================================
# SHORTAGE ALERTS ENDPOINT
# =============================================

@router.get("/shortages", response_model=List[ShortageAlert])
async def get_shortage_alerts(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get all items currently below minimum stock level.
    
    Returns list with:
    - Current stock vs minimum stock
    - Shortage quantity
    - Priority (CRITICAL/HIGH/MEDIUM)
    - Product and location details
    
    Used by Dashboard for shortage KPI.
    """
    return await inventory_service.get_shortage_alerts()


# =============================================
# INVENTORY ADJUSTMENTS ENDPOINT
# =============================================

@router.post("/adjust")
async def adjust_inventory(
    product_id: str = Query(...),
    location_id: str = Query(...),
    adjustment_qty: float = Query(..., description="Positive to add, negative to reduce"),
    reason: str = Query(..., description="Reason for adjustment"),
    lot_number: Optional[str] = None,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Adjust inventory quantity (for physical count corrections).
    
    Creates an ADJUSTMENT transaction.
    """
    
    
    transaction = InventoryTransactionCreate(
        transaction_type="ADJUSTMENT",
        product_id=product_id,
        quantity=Decimal(str(adjustment_qty)),
        to_location_id=location_id if adjustment_qty > 0 else None,
        from_location_id=location_id if adjustment_qty < 0 else None,
        lot_number=lot_number,
        notes=f"Inventory Adjustment: {reason}"
    )
    
    return await inventory_service.record_transaction(transaction, current_user.id)

@router.get("/summary")
async def get_inventory_summary(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get inventory summary KPIs.
    
    Returns:
    - total_materials: Total count of inventory items
    - low_stock_count: Items below minimum stock
    - critical_count: Items with zero stock
    - sufficient_count: Items at or above minimum stock
    
    Used for dashboard KPI cards.
    """
    return await inventory_service.get_inventory_summary()

# Add these to your existing inventory.py endpoints

from app.schemas.inventory import (
    InventoryTransactionResponse, InventoryAdjustmentRequest,
    StockMovementSummary
)
from datetime import datetime

# ========================================
# TRANSACTION HISTORY ENDPOINTS
# ========================================

@router.get("/transactions", response_model=List[InventoryTransactionResponse])
async def get_inventory_transactions(
    product_id: Optional[str] = None,
    location_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get inventory transaction history.
    - Filter by product, location, transaction type, or date range
    - Shows complete audit trail with location names
    """
    return await inventory_service.get_transaction_history(
        product_id=product_id,
        location_id=location_id,
        transaction_type=transaction_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit
    )


@router.get("/{product_id}/transactions", response_model=List[InventoryTransactionResponse])
async def get_product_transactions(
    product_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get transaction history for specific product."""
    return await inventory_service.get_transaction_history(
        product_id=product_id,
        limit=limit
    )


# ========================================
# INVENTORY ADJUSTMENTS
# ========================================

@router.post("/adjust", response_model=InventoryResponse)
async def adjust_inventory(
    adjustment: InventoryAdjustmentRequest,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Adjust inventory (stock count corrections, damaged goods, etc.)
    - Positive adjustment_qty: Increase stock
    - Negative adjustment_qty: Decrease stock
    - Requires Store Manager role
    """
    return await inventory_service.adjust_inventory(
        product_id=adjustment.product_id,
        location_id=adjustment.location_id,
        adjustment_qty=adjustment.adjustment_qty,
        reason=adjustment.reason,
        user_id=current_user.id,
        notes=adjustment.notes
    )


# ========================================
# STOCK MOVEMENT SUMMARY
# ========================================

@router.get("/{product_id}/movements", response_model=StockMovementSummary)
async def get_stock_movements(
    product_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get stock movement summary for a product.
    - Total IN, Total OUT, Net Movement
    - Filter by date range
    """
    return await inventory_service.get_stock_movement_summary(
        product_id=product_id,
        start_date=start_date,
        end_date=end_date
    )


# ========================================
# ALLOCATION/RELEASE (For Production Orders)
# ========================================

@router.post("/allocate", response_model=dict)
async def allocate_inventory(
    product_id: str = Query(...),
    location_id: str = Query(...),
    quantity: Decimal = Query(..., gt=0),
    reference_id: str = Query(...),
    reference_type: str = Query(...),
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Allocate inventory for production order.
    - Moves from free to allocated
    - Prevents over-allocation
    """
    return await inventory_service.allocate_inventory(
        product_id=product_id,
        location_id=location_id,
        quantity=quantity,
        reference_id=reference_id,
        reference_type=reference_type,
        user_id=current_user.id
    )


@router.post("/release", response_model=dict)
async def release_allocation(
    product_id: str = Query(...),
    location_id: str = Query(...),
    quantity: Decimal = Query(..., gt=0),
    reference_id: str = Query(...),
    reference_type: str = Query(...),
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Release allocated inventory.
    - Moves from allocated back to free
    - Used when production order is cancelled
    """
    return await inventory_service.release_allocation(
        product_id=product_id,
        location_id=location_id,
        quantity=quantity,
        reference_id=reference_id,
        reference_type=reference_type,
        user_id=current_user.id
    )