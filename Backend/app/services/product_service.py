from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListItem
from app.core.exceptions import NotFoundException, ConflictException


class ProductService:
    
    @staticmethod
    async def create_product(product_data: ProductCreate, user_id: str) -> ProductResponse:
        """Create a new product."""
        db = get_db()
        
        # Check if code already exists
        existing = db.table('products').select('id').eq('code', product_data.code).execute()
        if existing.data:
            raise ConflictException(detail=f"Product with code '{product_data.code}' already exists")
        
        # Create product
        product_dict = product_data.model_dump()
        product_dict['created_by'] = user_id
        
        result = db.table('products').insert(product_dict).execute()
        
        if not result.data:
            raise Exception("Failed to create product")
        
        return ProductResponse(**result.data[0])
    
    @staticmethod
    async def get_product_by_id(product_id: str) -> ProductResponse:
        """Get product by ID."""
        db = get_db()
        
        result = db.table('products').select('*').eq('id', product_id).execute()
        
        if not result.data:
            raise NotFoundException(detail="Product not found")
        
        return ProductResponse(**result.data[0])
    
    @staticmethod
    async def get_product_by_code(code: str) -> ProductResponse:
        """Get product by code."""
        db = get_db()
        
        result = db.table('products').select('*').eq('code', code).execute()
        
        if not result.data:
            raise NotFoundException(detail=f"Product with code '{code}' not found")
        
        return ProductResponse(**result.data[0])
    
    @staticmethod
    async def list_products(
        page: int = 1,
        limit: int = 50,
        category: Optional[str] = None,
        is_active: Optional[bool] = True,
        search: Optional[str] = None
    ) -> List[ProductResponse]:
        """List products with pagination and filters."""
        db = get_db()
        
        offset = (page - 1) * limit
        
        # Build query
        query = db.table('products').select('*')
        
        if category:
            query = query.eq('category', category)
        
        if is_active is not None:
            query = query.eq('is_active', is_active)
        
        if search:
            query = query.or_(
                f"code.ilike.%{search}%,name.ilike.%{search}%,description.ilike.%{search}%"
            )
        
        result = query.order('name').range(offset, offset + limit - 1).execute()
        
        return [ProductResponse(**product) for product in result.data]
    
    @staticmethod
    async def list_materials(search: Optional[str] = None) -> List[ProductListItem]:
        """List only raw materials (for BOM material picker)."""
        db = get_db()
        
        query = db.table('products').select('id', 'code', 'name', 'category', 'unit')
        query = query.eq('category', 'Raw Material').eq('is_active', True)
        
        if search:
            query = query.or_(f"code.ilike.%{search}%,name.ilike.%{search}%")
        
        result = query.order('name').limit(100).execute()
        
        return [ProductListItem(**product) for product in result.data]
    
    @staticmethod
    async def list_finished_goods(search: Optional[str] = None) -> List[ProductListItem]:
        """List only finished goods (for BOM product picker)."""
        db = get_db()
        
        query = db.table('products').select('id', 'code', 'name', 'category', 'unit')
        query = query.eq('category', 'Finished Goods').eq('is_active', True)
        
        if search:
            query = query.or_(f"code.ilike.%{search}%,name.ilike.%{search}%")
        
        result = query.order('name').limit(100).execute()
        
        return [ProductListItem(**product) for product in result.data]
    
    @staticmethod
    async def update_product(
        product_id: str, 
        update_data: ProductUpdate, 
        user_id: str
    ) -> ProductResponse:
        """Update product."""
        db = get_db()
        
        # Check if product exists
        existing = db.table('products').select('id').eq('id', product_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Product not found")
        
        # Build update dict
        update_dict = update_data.model_dump(exclude_unset=True)
        if update_dict:
            result = db.table('products').update(update_dict).eq('id', product_id).execute()
            
            if not result.data:
                raise Exception("Failed to update product")
            
            return ProductResponse(**result.data[0])
        
        return await ProductService.get_product_by_id(product_id)
    
    @staticmethod
    async def delete_product(product_id: str) -> dict:
        """Delete product (soft delete - deactivate)."""
        db = get_db()
        
        # Check if product has BOMs
        boms = db.table('boms').select('id').eq('product_id', product_id).execute()
        if boms.data:
            raise ConflictException(
                detail="Cannot delete product with existing BOMs. Deactivate instead."
            )
        
        # Check if used in any BOM materials
        materials = db.table('bom_materials').select('id').eq('material_id', product_id).execute()
        if materials.data:
            raise ConflictException(
                detail="Cannot delete product used in BOMs. Deactivate instead."
            )
        
        # Deactivate product
        result = db.table('products').update({'is_active': False}).eq('id', product_id).execute()
        
        if not result.data:
            raise NotFoundException(detail="Product not found")
        
        return {"message": "Product deactivated successfully"}
    
    @staticmethod
    async def get_categories() -> List[str]:
        """Get all unique product categories."""
        db = get_db()
        
        result = db.table('products').select('category').execute()
        
        # Extract unique categories
        categories = list(set(item['category'] for item in result.data if item.get('category')))
        categories.sort()
        
        return categories


# Singleton instance
product_service = ProductService()