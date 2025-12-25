# app/api/v1/endpoints/boms.py

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from decimal import Decimal
from app.schemas.bom import (
    BOMCreate, 
    BOMUpdate, 
    BOMResponse, 
    BOMListItem, 
    BOMMaterialResponse,
    BOMCalculation, 
    BOMVersion, 
    BOMDuplicateRequest, 
    BOMValidationResult,
    BOMMaterialCreate,
    MaterialShortageDetail,
    ShortageCalculationRequest,
    BOMShortageCalculation,
    BOMMaterialWithShortage,
    BOMCreateWithProduct
)
from app.schemas.user import UserResponse
from app.services.bom_service import bom_service
from app.api.deps import get_current_user, require_role

router = APIRouter()


# ========================================
# EXISTING ENDPOINTS (Keep as-is)
# ========================================

@router.post("/with-product", response_model=BOMResponse, status_code=status.HTTP_201_CREATED)
async def create_bom_with_product(
    bom_data: BOMCreateWithProduct,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Create a new BOM with product creation.
    - Creates finished goods product first
    - Then creates BOM with materials from inventory
    - Auto-generates version 1
    """
    return await bom_service.create_bom_with_product(bom_data, current_user.id)


@router.post("/", response_model=BOMResponse, status_code=status.HTTP_201_CREATED)
async def create_bom(
    bom_data: BOMCreate,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Create a new BOM with materials.
    - Auto-generates version 1
    - Validates all materials are raw materials
    - Creates version snapshot
    - Can be saved as template
    """
    return await bom_service.create_bom(bom_data, current_user.id)


@router.get("/", response_model=List[BOMListItem])
async def list_boms(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    product_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_template: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all BOMs with pagination and filters.
    - Filter by product, active status, template status
    - Search by product code/name
    """
    return await bom_service.list_boms(
        page=page,
        limit=limit,
        product_id=product_id,
        is_active=is_active,
        is_template=is_template,
        search=search
    )


@router.get("/{bom_id}", response_model=BOMResponse)
async def get_bom(
    bom_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get BOM details with all materials and costs."""
    return await bom_service.get_bom_by_id(bom_id)


@router.put("/{bom_id}", response_model=BOMResponse)
async def update_bom(
    bom_id: str,
    update_data: BOMUpdate,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Update BOM.
    - Creates new version if BOM is active
    - Can update batch size, notes, or replace all materials
    """
    return await bom_service.update_bom(bom_id, update_data, current_user.id)


@router.delete("/{bom_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bom(
    bom_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """Soft delete BOM (deactivate)."""
    await bom_service.delete_bom(bom_id)


@router.get("/{bom_id}/versions", response_model=List[BOMVersion])
async def get_bom_versions(
    bom_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get version history for a BOM."""
    return await bom_service.get_bom_versions(bom_id)


@router.post("/{bom_id}/duplicate", response_model=BOMResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_bom(
    bom_id: str,
    duplicate_data: BOMDuplicateRequest,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Duplicate existing BOM to a new product.
    - Copies all materials and costs
    - Can save as template
    """
    return await bom_service.duplicate_bom(bom_id, duplicate_data, current_user.id)


@router.post("/{bom_id}/validate", response_model=BOMValidationResult)
async def validate_bom(
    bom_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Validate BOM against current inventory.
    - Checks if all materials are available
    - Returns shortage details
    """
    return await bom_service.validate_bom(bom_id)


@router.post("/calculate-requirements", response_model=List[BOMCalculation])
async def calculate_material_requirements(
    product_id: str = Query(..., description="Finished goods product ID"),
    quantity: Decimal = Query(..., gt=0, description="Production quantity"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Calculate material requirements for production order.
    - Uses active BOM
    - Scales by batch size
    - Includes scrap percentage
    - Returns material list with costs
    """
    return await bom_service.calculate_material_requirements(product_id, quantity)


# ========================================
# MATERIAL CRUD ENDPOINTS
# ========================================

@router.post("/{bom_id}/materials", response_model=BOMResponse)
async def add_material_to_bom(
    bom_id: str,
    material: BOMMaterialCreate,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Add a single material to an existing BOM.
    - Validates material is raw material
    - Auto-assigns sequence number
    - Creates new version if BOM is active
    """
    return await bom_service.add_material_to_bom(bom_id, material, current_user.id)


@router.put("/{bom_id}/materials/{material_id}", response_model=BOMResponse)
async def update_bom_material(
    bom_id: str,
    material_id: str,
    material_update: BOMMaterialCreate,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Update a single material in BOM.
    - Updates quantity, cost, scrap percentage
    - Creates new version if BOM is active
    """
    return await bom_service.update_bom_material(bom_id, material_id, material_update, current_user.id)


@router.delete("/{bom_id}/materials/{material_id}", status_code=status.HTTP_200_OK)
async def remove_material_from_bom(
    bom_id: str,
    material_id: str,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Remove a single material from BOM.
    - Creates new version if BOM is active
    """
    return await bom_service.remove_material_from_bom(bom_id, material_id, current_user.id)


# ========================================
# BOM MANAGEMENT ENDPOINTS
# ========================================

@router.put("/{bom_id}/activate", response_model=BOMResponse)
async def activate_bom(
    bom_id: str,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Activate a BOM version.
    - Deactivates all other versions for the same product
    - Only one active BOM per product
    """
    return await bom_service.activate_bom(bom_id)


@router.get("/{bom_id}/cost-breakdown", response_model=dict)
async def get_cost_breakdown(
    bom_id: str,
    quantity: Decimal = Query(default=1, gt=0, description="Production quantity"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get detailed cost breakdown by material.
    - Shows percentage contribution
    - Scales by quantity
    - Includes scrap costs
    """
    return await bom_service.get_cost_breakdown(bom_id, quantity)


@router.get("/product/{product_id}/active", response_model=BOMResponse)
async def get_active_bom_by_product(
    product_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get active BOM for a product.
    - Returns 404 if no active BOM exists
    """
    return await bom_service.get_bom_by_product_id(product_id)


# ========================================
# SHORTAGE CALCULATION ENDPOINTS
# ========================================

@router.post("/calculate-with-shortages", response_model=BOMShortageCalculation)
async def calculate_requirements_with_shortages(
    request: ShortageCalculationRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Calculate material requirements with shortage analysis.
    
    **Features:**
    - Calculates required quantities from BOM (with scrap %)
    - Checks current inventory availability
    - Shows shortage quantities per material
    - Provides shortage status (Sufficient/Moderate/Critical/Out of Stock)
    - Location-wise inventory breakdown
    - Summary of procurement needs
    
    **Use Cases:**
    - Pre-production planning
    - Material procurement planning
    - Production feasibility check
    - Material request pre-fill
    
    **Parameters:**
    - **product_id**: Finished goods product ID
    - **quantity**: Production quantity to plan
    - **target_location_id**: (Optional) Check specific warehouse/location
    - **include_allocated**: (Optional) Include already allocated stock in availability
    
    **Response:**
    - Material-wise shortage details
    - Location breakdown for each material
    - Summary with procurement requirements
    """
    return await bom_service.calculate_requirements_with_shortages(
        product_id=request.product_id,
        quantity=request.quantity,
        target_location_id=request.target_location_id,
        include_allocated=request.include_allocated
    )


@router.get("/{bom_id}/materials-with-shortages", response_model=List[BOMMaterialWithShortage])
async def get_bom_materials_with_shortages(
    bom_id: str,
    production_qty: Decimal = Query(..., gt=0, description="Production quantity"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get BOM materials with shortage information for BOM Planner UI.
    
    **Perfect for the BOM Auto-Planner table display!**
    
    **Features:**
    - All BOM material details
    - Quantity per unit (for display in "Qty per Unit" column)
    - Current stock levels (for "Stock" column)
    - Status: Sufficient/Shortage (for "Status" column with badges)
    - Shortage display: "Need X units" (for new "Shortage" column)
    
    **Use Case:**
    - Called when user clicks "Auto Calculate" button
    - Production quantity comes from the input field (e.g., 600)
    - Returns data ready for table display
    
    **Response Format:**
    Each material includes:
    - material_name: "Cotton Fabric"
    - quantity_per_unit: 1.25 (displayed in table)
    - unit: "m"
    - stock_qty: 800.0 (current inventory)
    - shortage_status: "Sufficient" or "Shortage"
    - shortage_display: null or "Need 8000 m" ← For the new column!
    """
    return await bom_service.get_bom_materials_with_shortages(bom_id, production_qty)