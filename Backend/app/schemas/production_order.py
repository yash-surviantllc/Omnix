from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal


class OrderMaterialBase(BaseModel):
    material_id: str
    required_qty: Decimal = Field(..., gt=0)
    unit: str
    unit_cost: Decimal = Field(default=0, ge=0)


class OrderMaterialCreate(OrderMaterialBase):
    pass


class OrderMaterialResponse(OrderMaterialBase):
    id: str
    order_id: str
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    allocated_qty: Decimal
    issued_qty: Decimal
    total_cost: Decimal
    status: str  # Pending, Allocated, Issued, Completed
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProductionOrderBase(BaseModel):
    product_id: str = Field(..., description="Finished goods product ID")
    quantity: Decimal = Field(..., gt=0, description="Order quantity")
    due_date: date = Field(..., description="Target completion date")
    priority: str = Field(default="Medium", description="Low, Medium, High, Urgent")
    notes: Optional[str] = None
    customer_name: Optional[str] = None
    assigned_team: Optional[str] = None
    shift_number: Optional[str] = None
    production_stage: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ProductionOrderCreate(ProductionOrderBase):
    """Create production order - BOM will be fetched automatically"""
    pass


class ProductionOrderUpdate(BaseModel):
    quantity: Optional[Decimal] = Field(None, gt=0)
    due_date: Optional[date] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    customer_name: Optional[str] = None
    assigned_team: Optional[str] = None
    shift_number: Optional[str] = None
    production_stage: Optional[str] = None


class ProductionOrderResponse(ProductionOrderBase):
    id: str
    order_number: str
    bom_id: Optional[str] = None
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    unit: str
    status: str
    qr_code: Optional[str] = None
    materials: List[OrderMaterialResponse] = []
    total_material_cost: Optional[Decimal] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class ProductionOrderListItem(BaseModel):
    """Simplified order for list view"""
    id: str
    order_number: str
    product_id: str
    product_code: str
    product_name: str
    quantity: Decimal
    unit: str
    due_date: date
    priority: str
    status: str
    materials_status: str  # All Pending, Partially Allocated, Fully Allocated, etc.
    days_until_due: int
    is_overdue: bool
    created_at: datetime


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="Planned, In Progress, Completed, On Hold, Cancelled")
    notes: Optional[str] = None


class OrderAssignment(BaseModel):
    user_id: str
    role: str = Field(..., description="Supervisor, Operator, QC Inspector")


class OrderAssignmentResponse(BaseModel):
    id: str
    order_id: str
    user_id: str
    user_name: str
    role: str
    assigned_at: datetime
    assigned_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class MaterialAllocationRequest(BaseModel):
    location_id: str = Field(..., description="Location to allocate from")
    allocate_all: bool = Field(default=False, description="Allocate all pending materials")


class OrderProgress(BaseModel):
    """Order progress summary"""
    order_id: str
    order_number: str
    status: str
    total_materials: int
    allocated_materials: int
    issued_materials: int
    completed_materials: int
    allocation_percentage: float
    days_until_due: int
    is_overdue: bool

class MaterialRequirement(BaseModel):
    """Material requirement for production order"""
    material_id: str
    material_code: str
    material_name: str
    required_qty: Decimal
    unit: str
    available_qty: Decimal = Decimal('0')
    allocated_qty: Decimal = Decimal('0')
    issued_qty: Decimal = Decimal('0')
    shortage_qty: Decimal = Decimal('0')
    availability_status: str  # Available, Partial, Shortage
    
    class Config:
        from_attributes = True

class TeamAssignment(BaseModel):
    """Team member assignment to order"""
    user_id: str
    user_name: str
    role: str
    assigned_at: datetime
    
    class Config:
        from_attributes = True
    
# ========================================
# SHORTAGE VALIDATION SCHEMAS
# ========================================

class OrderMaterialWithShortage(BaseModel):
    """Order material with shortage details"""
    material_id: str
    material_code: str
    material_name: str
    required_qty: Decimal
    unit: str
    available_qty: Decimal = Decimal('0')
    allocated_qty: Decimal = Decimal('0')
    issued_qty: Decimal = Decimal('0')
    free_qty: Decimal = Decimal('0')
    shortage_qty: Decimal = Decimal('0')
    shortage_status: str  # Sufficient, Moderate, Critical, Out of Stock
    procurement_needed: bool = False
    
    class Config:
        from_attributes = True


class ProductionOrderValidation(BaseModel):
    """Production order validation result"""
    can_produce: bool
    product_id: str
    product_code: str
    product_name: str
    quantity: Decimal
    total_materials: int
    sufficient_materials: int
    shortage_materials: int
    materials: List[OrderMaterialWithShortage]
    summary: dict
    
    class Config:
        from_attributes = True


class ProductionOrderWithShortages(ProductionOrderResponse):
    """Production order response with shortage details"""
    shortage_summary: Optional[dict] = None
    has_shortages: bool = False
    can_produce: bool = True
    
    class Config:
        from_attributes = True