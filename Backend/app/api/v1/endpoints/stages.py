from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.schemas.stages import (
    StageCreate, StageUpdate, StageResponse, StageUsageStats,
    ProductStagesResponse, BulkStageAssignment, StageReorderRequest
)
from app.services.stage_service import stage_service
from app.api.deps import get_current_user, block_worker_delete

router = APIRouter()


# ============================================
# STAGE MANAGEMENT ENDPOINTS
# ============================================

@router.get("", response_model=List[StageResponse])
async def list_stages(
    active_only: bool = Query(default=True, description="Filter to active stages only"),
    config_id: str = Query(default="default", description="Configuration ID (default, config_2, config_3)"),
    current_user: dict = Depends(get_current_user)
):
    """
    List all WIP stages
    
    - **active_only**: If true, only returns active stages (default: true)
    - **config_id**: Configuration ID to filter by
    """
    try:
        return await stage_service.list_stages(active_only=active_only, config_id=config_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{stage_id}", response_model=StageResponse)
async def get_stage(
    stage_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific stage by ID"""
    try:
        return await stage_service.get_stage_by_id(stage_id)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=StageResponse, status_code=201)
async def create_stage(
    stage_data: StageCreate,
    config_id: str = Query(default="default", description="Configuration ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new WIP stage
    
    - **config_id**: Which configuration this stage belongs to
    """
    try:
        return await stage_service.create_stage(stage_data, config_id=config_id)
    except Exception as e:
        if "already exists" in str(e).lower():
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assignments/rules", response_model=dict)
async def get_assignments(
    current_user: dict = Depends(get_current_user)
):
    """Get global configuration assignment rules"""
    try:
        return await stage_service.get_assignments()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assignments/rules", response_model=dict)
async def update_assignments(
    assignments: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Update global configuration assignment rules.
    Expected format:
    {
        "sku_assignments": {"SKU123": "config_2"},
        "wo_assignments": {"WO-2024-001": "config_3"}
    }
    """
    try:
        await stage_service.save_assignments(assignments)
        return assignments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{stage_id}", response_model=StageResponse)
async def update_stage(
    stage_id: str,
    stage_data: StageUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a WIP stage
    
    All fields are optional. Only provided fields will be updated.
    """
    try:
        return await stage_service.update_stage(stage_id, stage_data)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if "already exists" in str(e).lower():
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{stage_id}")
async def delete_stage(
    stage_id: str,
    force: bool = Query(default=False, description="Force hard delete (will fail if stage is in use)"),
    current_user: dict = Depends(get_current_user),
    _worker_guard: dict = Depends(block_worker_delete)
):
    """
    Delete a stage
    
    - **force=false** (default): Soft delete - sets is_active=false, preserves data
    - **force=true**: Hard delete - permanently removes stage (fails if in use)
    
    Soft delete is recommended to preserve historical data.
    """
    try:
        return await stage_service.delete_stage(stage_id, force=force)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if "is in use" in str(e).lower() or "is currently assigned" in str(e).lower():
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{stage_id}/usage", response_model=StageUsageStats)
async def get_stage_usage(
    stage_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get usage statistics for a stage
    
    Returns:
    - Number of products using this stage
    - Number of active work orders
    - Whether the stage is currently in use
    """
    try:
        return await stage_service.get_stage_usage(stage_id)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reorder", response_model=List[StageResponse])
async def reorder_stages(
    reorder_data: StageReorderRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Reorder stages by updating sequence numbers
    
    Request body should contain:
    ```json
    {
      "stage_orders": [
        {"stage_id": "uuid-1", "sequence_number": 1},
        {"stage_id": "uuid-2", "sequence_number": 2},
        ...
      ]
    }
    ```
    
    Note: This only affects the display order. Existing work orders retain their original operation names.
    """
    try:
        return await stage_service.reorder_stages(reorder_data.stage_orders)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CONFIG-STAGE ASSIGNMENT ENDPOINTS
# ============================================

@router.post("/config/{config_id}/assign/{stage_id}")
async def assign_stage_to_configuration(
    config_id: str,
    stage_id: str,
    sequence_number: Optional[int] = Query(default=None, description="Position in sequence (auto-assigned if not provided)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Assign an existing stage to a configuration
    
    This enables stage reuse - the same stage can be assigned to multiple configurations.
    
    - **config_id**: Configuration ID (default, config_2, config_3)
    - **stage_id**: UUID of the stage to assign
    - **sequence_number**: Optional position in the sequence (auto-calculated if omitted)
    """
    try:
        return await stage_service.assign_stage_to_config(config_id, stage_id, sequence_number)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if "already assigned" in str(e).lower():
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/config/{config_id}/remove/{stage_id}")
async def remove_stage_from_configuration(
    config_id: str,
    stage_id: str,
    current_user: dict = Depends(get_current_user),
    _worker_guard: dict = Depends(block_worker_delete)
):
    """
    Remove a stage from a configuration
    
    This does NOT delete the stage itself - it only removes the assignment.
    The stage remains available to be assigned to other configurations.
    
    - **config_id**: Configuration ID (default, config_2, config_3)
    - **stage_id**: UUID of the stage to remove
    """
    try:
        return await stage_service.remove_stage_from_config(config_id, stage_id)
    except Exception as e:
        if "not assigned" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# PRODUCT-STAGE ASSIGNMENT ENDPOINTS
# ============================================

@router.get("/product/{product_id}", response_model=ProductStagesResponse)
async def get_product_stages(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get stages configured for a specific product
    
    If the product has custom stage assignments, returns those.
    Otherwise, returns the default active stages.
    """
    try:
        return await stage_service.get_product_stages(product_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/product/assign", response_model=ProductStagesResponse)
async def assign_product_stages(
    assignment: BulkStageAssignment,
    current_user: dict = Depends(get_current_user)
):
    """
    Assign stages to a product
    
    This replaces any existing stage assignments for the product.
    
    Request body:
    ```json
    {
      "product_id": "uuid",
      "stages": [
        {
          "stage_id": "uuid-1",
          "sequence_number": 1,
          "is_required": true,
          "estimated_time_minutes": 45.0,
          "notes": "Optional notes"
        },
        ...
      ]
    }
    ```
    
    To revert a product to default stages, call DELETE /stages/product/{product_id}
    """
    try:
        return await stage_service.assign_stages_to_product(assignment)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        if "inactive stage" in str(e).lower():
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/product/{product_id}")
async def remove_product_stages(
    product_id: str,
    current_user: dict = Depends(get_current_user),
    _worker_guard: dict = Depends(block_worker_delete)
):
    """
    Remove custom stage assignments for a product
    
    After removal, the product will use the default active stages.
    """
    try:
        return await stage_service.remove_product_stages(product_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{stage_id}/products", response_model=List[dict])
async def get_products_using_stage(
    stage_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of products that use a specific stage
    
    Useful for understanding impact before deleting a stage.
    """
    try:
        return await stage_service.get_products_using_stage(stage_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
