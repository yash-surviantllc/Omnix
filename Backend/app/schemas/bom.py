from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal


class BOMMaterialBase(BaseModel):
    material_id: str = Field(..., description="Material product ID")
    quantity: Decimal = Field(..., gt=0, description="Quantity needed per batch")
    unit: str = Field(..., description="Unit of measure (kg, meter, pcs, etc.)")
    scrap_percentage: Decimal = Field(default=0, ge=0, le=100, description="Scrap percentage")
    unit_cost: Decimal = Field(default=0, ge=0, description="Cost per unit")
    sequence_number: Optional[int] = Field(None, description="Display order")


class BOMMaterialCreate(BOMMaterialBase):
    pass


class BOMMaterialResponse(BOMMaterialBase):
    id: str
    bom_id: str
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    total_cost: Optional[Decimal] = None  # quantity * unit_cost * (1 + scrap/100)
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BOMBase(BaseModel):
    product_id: str = Field(..., description="Finished goods product ID")
    batch_size: Decimal = Field(default=100, gt=0, description="Standard batch size")
    notes: Optional[str] = None


class BOMCreate(BOMBase):
    materials: List[BOMMaterialCreate] = Field(..., min_length=1, description="List of materials")
    is_template: bool = Field(default=False, description="Save as template")
    template_name: Optional[str] = Field(None, description="Template name if is_template=True")


class BOMCreateWithProduct(BaseModel):
    """Create BOM with product details (for new products)"""
    product_code: str = Field(..., description="Product code")
    product_name: str = Field(..., description="Product name")
    batch_size: Decimal = Field(default=100, gt=0, description="Standard batch size")
    notes: Optional[str] = None
    materials: List[Dict[str, Any]] = Field(..., min_length=1, description="List of materials with item_code, material, qty, unit, unitCost")


class BOMUpdate(BaseModel):
    batch_size: Optional[Decimal] = Field(None, gt=0)
    notes: Optional[str] = None
    materials: Optional[List[BOMMaterialCreate]] = None


class BOMResponse(BOMBase):
    id: str
    version: int
    is_active: bool
    effective_date: date
    is_template: bool
    template_name: Optional[str] = None
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    materials: List[BOMMaterialResponse] = []
    total_bom_cost: Optional[Decimal] = None  # Sum of all material costs with scrap
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class BOMListItem(BaseModel):
    """Simplified BOM for list view"""
    id: str
    product_id: str
    product_code: str
    product_name: str
    version: int
    batch_size: Decimal
    is_active: bool
    is_template: bool
    template_name: Optional[str] = None
    materials_count: int
    total_cost: Optional[Decimal] = None
    effective_date: date
    created_at: datetime


class BOMCalculation(BaseModel):
    """Material requirements calculation for production order"""
    material_id: str
    material_code: str
    material_name: str
    required_quantity: Decimal
    unit: str
    unit_cost: Decimal
    scrap_percentage: Decimal
    total_cost: Decimal


class BOMVersion(BaseModel):
    """BOM version history item"""
    id: str
    bom_id: str
    version: int
    effective_date: date
    created_by: Optional[str] = None
    created_at: datetime
    notes: Optional[str] = None
    snapshot: dict  # Full BOM data


class BOMDuplicateRequest(BaseModel):
    """Request to duplicate a BOM"""
    new_product_id: str = Field(..., description="New product ID for duplicated BOM")
    copy_as_template: bool = Field(default=False, description="Save as template")
    template_name: Optional[str] = None


class BOMValidationResult(BaseModel):
    """BOM validation result"""
    is_valid: bool
    total_materials: int
    available_materials: int
    shortage_materials: int
    shortages: List[dict] = []

# ========================================
# SHORTAGE CALCULATION SCHEMAS
# ========================================

class MaterialShortageDetail(BaseModel):
    """Material shortage details"""
    material_id: str
    material_code: str
    material_name: str
    required_qty: Decimal
    unit: str
    available_qty: Decimal = Decimal('0')
    allocated_qty: Decimal = Decimal('0')
    free_qty: Decimal = Decimal('0')
    shortage_qty: Decimal = Decimal('0')
    shortage_status: str  # Sufficient, Moderate, Critical, Out of Stock
    procurement_needed: bool = False
    location_breakdown: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        from_attributes = True


class BOMShortageCalculation(BaseModel):
    """BOM with shortage analysis"""
    product_id: str
    product_code: str
    product_name: str
    production_qty: Decimal
    bom_batch_size: Decimal
    total_bom_cost: Decimal
    materials: List[MaterialShortageDetail]
    summary: Dict[str, Any]  # Overall shortage summary
    
    class Config:
        from_attributes = True


class ShortageCalculationRequest(BaseModel):
    """Request for shortage calculation"""
    product_id: str = Field(..., description="Finished goods product ID")
    quantity: Decimal = Field(..., gt=0, description="Production quantity")
    target_location_id: Optional[str] = Field(None, description="Check inventory at specific location")
    include_allocated: bool = Field(False, description="Include allocated inventory in availability")

class BOMMaterialWithShortage(BaseModel):
    """BOM material with shortage information for UI"""
    id: str
    material_id: str
    material_code: str
    material_name: str
    quantity_per_unit: Decimal  # Qty per 1 unit (for display)
    required_qty: Decimal  # Total required for production qty
    unit: str
    scrap_percentage: Decimal
    unit_cost: Decimal
    sequence_number: Optional[int] = None
    
    # Inventory & Shortage Info
    stock_qty: Decimal = Decimal('0')  # Current stock
    available_qty: Decimal = Decimal('0')
    allocated_qty: Decimal = Decimal('0')
    free_qty: Decimal = Decimal('0')
    shortage_qty: Decimal = Decimal('0')
    shortage_status: str  # Sufficient, Moderate, Critical, Out of Stock
    shortage_display: Optional[str] = None  # "Need 800 m" or null
    
    class Config:
        from_attributes = True