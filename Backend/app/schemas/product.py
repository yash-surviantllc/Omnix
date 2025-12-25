from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProductBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="Product code (e.g., MAT-001, FG-001)")
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, description="Raw Material, Finished Goods, etc.")
    unit: str = Field(..., min_length=1, max_length=20, description="kg, meter, pcs, liter, etc.")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProductListItem(BaseModel):
    """Simplified product for dropdowns/lists"""
    id: str
    code: str
    name: str
    category: Optional[str] = None
    unit: str