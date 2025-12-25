from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListItem
from app.schemas.user import UserResponse
from app.services.product_service import product_service
from app.api.deps import get_current_user, require_role

router = APIRouter()


@router.post("/", response_model=ProductResponse, status_code=201)
async def create_product(
    product_data: ProductCreate,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Create a new product (Admin/Planner only).
    
    - **code**: Unique product code (e.g., MAT-001, FG-001)
    - **name**: Product name
    - **category**: Raw Material or Finished Goods
    - **unit**: kg, meter, pcs, liter, etc.
    """
    return await product_service.create_product(product_data, current_user.id)


@router.get("/", response_model=List[ProductResponse])
async def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all products with pagination.
    
    - **page**: Page number
    - **limit**: Items per page (max 100)
    - **category**: Filter by category (Raw Material, Finished Goods)
    - **is_active**: Filter by active status
    - **search**: Search in code, name, description
    """
    return await product_service.list_products(page, limit, category, is_active, search)


@router.get("/materials", response_model=List[ProductListItem])
async def list_materials(
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List only raw materials (for BOM material picker).
    
    Returns simplified product list with only essential fields.
    """
    return await product_service.list_materials(search)


@router.get("/finished-goods", response_model=List[ProductListItem])
async def list_finished_goods(
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List only finished goods (for BOM product picker).
    
    Returns simplified product list with only essential fields.
    """
    return await product_service.list_finished_goods(search)


@router.get("/categories", response_model=List[str])
async def get_categories(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get all unique product categories.
    """
    return await product_service.get_categories()


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get product by ID.
    """
    return await product_service.get_product_by_id(product_id)


@router.get("/code/{code}", response_model=ProductResponse)
async def get_product_by_code(
    code: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get product by code (e.g., MAT-001).
    """
    return await product_service.get_product_by_code(code)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    update_data: ProductUpdate,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Update product (Admin only).
    """
    return await product_service.update_product(product_id, update_data, current_user.id)


@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Delete product - deactivates instead of hard delete (Admin only).
    """
    return await product_service.delete_product(product_id)