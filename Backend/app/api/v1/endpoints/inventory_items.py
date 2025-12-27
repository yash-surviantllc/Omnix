from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from app.schemas.inventory_items import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    InventoryItemListResponse, InventoryItemTransactionResponse,
    StockAlertItemResponse, InventoryItemsSummary,
    InventoryAdjustmentRequest
)
from app.schemas.user import UserResponse
from app.services.inventory_items_service import inventory_items_service
from app.api.deps import get_current_user, require_role

router = APIRouter()


# =============================================
# INVENTORY ITEMS CRUD ENDPOINTS
# =============================================

@router.get("/", response_model=List[InventoryItemListResponse])
async def list_inventory_items(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = Query(None, description="sufficient, low, critical, out_of_stock"),
    category: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all inventory items with pagination and filters.
    
    - **page**: Page number (default: 1)
    - **limit**: Items per page (max: 100)
    - **search**: Search in material code/name
    - **status**: Filter by status
    - **category**: Filter by category
    """
    return await inventory_items_service.list_inventory_items(
        page=page,
        limit=limit,
        search=search,
        status=status,
        category=category
    )


@router.get("/summary", response_model=InventoryItemsSummary)
async def get_inventory_summary(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get inventory summary KPIs.
    
    Returns:
    - total_materials: Total count of inventory items
    - low_stock_count: Items with low stock
    - critical_count: Items with critical stock
    - out_of_stock_count: Items out of stock
    - sufficient_count: Items with sufficient stock
    - total_value: Total inventory value
    """
    return await inventory_items_service.get_inventory_summary()


@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get inventory item by ID.
    """
    return await inventory_items_service.get_inventory_item(item_id)


@router.post("/", response_model=InventoryItemResponse, status_code=201)
async def create_inventory_item(
    item_data: InventoryItemCreate,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Create a new inventory item.
    
    **Required fields:**
    - material_code: Unique code (e.g., FAB-COT-001)
    - material_name: Material name
    - quantity: Initial quantity
    - unit: Unit of measurement (m, kg, pcs, etc.)
    - reorder_level: Minimum stock level
    - unit_cost: Cost per unit
    
    **Validation:**
    - Material code must be unique
    - Material name must be unique
    - Reorder level cannot exceed quantity
    """
    return await inventory_items_service.create_inventory_item(
        item_data=item_data,
        user_id=current_user.id
    )


@router.put("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: str,
    item_data: InventoryItemUpdate,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Update an inventory item.
    
    **Note:** Material code cannot be changed.
    All other fields are optional.
    """
    return await inventory_items_service.update_inventory_item(
        item_id=item_id,
        item_data=item_data,
        user_id=current_user.id
    )


@router.delete("/{item_id}")
async def delete_inventory_item(
    item_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Delete an inventory item (soft delete).
    
    **Requires Admin role.**
    """
    return await inventory_items_service.delete_inventory_item(
        item_id=item_id,
        user_id=current_user.id
    )


# =============================================
# INVENTORY ADJUSTMENTS
# =============================================

@router.post("/adjust", response_model=InventoryItemResponse)
async def adjust_inventory(
    adjustment: InventoryAdjustmentRequest,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Adjust inventory quantity.
    
    - **adjustment_quantity**: Positive to add, negative to reduce
    - **reason**: Required reason for adjustment
    - **notes**: Optional additional notes
    
    Creates an ADJUST transaction in the audit trail.
    """
    return await inventory_items_service.adjust_inventory(
        adjustment=adjustment,
        user_id=current_user.id
    )


# =============================================
# TRANSACTIONS & AUDIT TRAIL
# =============================================

@router.get("/transactions/list", response_model=List[InventoryItemTransactionResponse])
async def list_transactions(
    item_id: Optional[str] = None,
    transaction_type: Optional[str] = Query(None, description="IN, OUT, ADJUST, TRANSFER, RETURN, SCRAP"),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List inventory transactions with filters.
    
    - **item_id**: Filter by specific item
    - **transaction_type**: Filter by transaction type
    - **limit**: Maximum number of results
    """
    return await inventory_items_service.list_transactions(
        item_id=item_id,
        transaction_type=transaction_type,
        limit=limit
    )


@router.get("/{item_id}/transactions", response_model=List[InventoryItemTransactionResponse])
async def get_item_transactions(
    item_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get transaction history for a specific inventory item.
    """
    return await inventory_items_service.list_transactions(
        item_id=item_id,
        limit=limit
    )


# =============================================
# STOCK ALERTS
# =============================================

@router.get("/alerts/active", response_model=List[StockAlertItemResponse])
async def get_stock_alerts(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get all active stock alerts.
    
    Returns items that are:
    - Out of stock
    - Below reorder level (critical)
    - Below reorder level (low)
    """
    return await inventory_items_service.get_stock_alerts()


# =============================================
# BULK OPERATIONS
# =============================================

@router.post("/bulk/import")
async def bulk_import_items(
    items: List[InventoryItemCreate],
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Bulk import inventory items.
    
    **Requires Admin role.**
    """
    results = {
        "success": [],
        "failed": []
    }
    
    for item in items:
        try:
            created_item = await inventory_items_service.create_inventory_item(
                item_data=item,
                user_id=current_user.id
            )
            results["success"].append({
                "material_code": item.material_code,
                "id": created_item.id
            })
        except Exception as e:
            results["failed"].append({
                "material_code": item.material_code,
                "error": str(e)
            })
    
    return results
