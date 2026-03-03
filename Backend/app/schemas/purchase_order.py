from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal


# ========================================
# PO ITEM SCHEMAS (Multi-SKU Support)
# ========================================

class POItemBase(BaseModel):
    product_id: str
    quantity: Decimal = Field(..., gt=0)
    unit: str = Field(default="pcs")
    notes: Optional[str] = None


class POItemCreate(POItemBase):
    pass


class POItemResponse(POItemBase):
    id: str
    purchase_order_id: str  # Changed from production_order_id
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ========================================
# ORDER MATERIAL SCHEMAS
# ========================================

class OrderMaterialBase(BaseModel):
    material_id: str
    required_qty: Decimal = Field(..., gt=0)
    unit: str
    unit_cost: Decimal = Field(default=0, ge=0)


class OrderMaterialCreate(OrderMaterialBase):
    pass


class OrderMaterialResponse(BaseModel):
    id: str
    purchase_order_id: str
    # DB column is 'product_id'. Service fills material_id from product_id.
    material_id: Optional[str] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    required_qty: Decimal
    allocated_qty: Decimal = Decimal('0')
    issued_qty: Decimal = Decimal('0')
    unit: str
    # unit_cost, total_cost, order_id, status do NOT exist on order_materials table.
    # Making them Optional prevents Pydantic validation crashes.
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    order_id: Optional[str] = None
    status: Optional[str] = None  # Not a DB column; derived if needed
    availability_status: str = 'Available'
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PurchaseOrderBase(BaseModel):  # Changed from ProductionOrderBase
    product_id: str = Field(..., description="Finished goods product ID")
    quantity: Decimal = Field(..., gt=0, description="Order quantity")
    due_date: date = Field(..., description="Target completion date")
    priority: str = Field(default="Medium", description="Low, Medium, High, Urgent")
    notes: Optional[str] = None
    customer_name: Optional[str] = None
    shift_number: Optional[str] = None


class PurchaseOrderCreate(PurchaseOrderBase):  # Changed from ProductionOrderCreate
    """Create purchase order - BOM will be fetched automatically"""
    pass


class PurchaseOrderMultiSKUCreate(BaseModel):  # Changed from ProductionOrderMultiSKUCreate
    """Create purchase order with multiple SKUs"""
    customer_name: Optional[str] = None
    shift_number: Optional[str] = None
    due_date: date = Field(..., description="Target completion date")
    priority: str = Field(default="Medium", description="Low, Medium, High, Urgent")
    notes: Optional[str] = None
    items: List[POItemCreate] = Field(..., min_length=1, description="List of SKU items")
    ocr_document_url: Optional[str] = None
    ocr_extracted_data: Optional[Dict[str, Any]] = None

    @field_validator('due_date', mode='before')
    @classmethod
    def parse_due_date(cls, v):
        if isinstance(v, str):
            try:
                # Handle full ISO strings by taking date part
                return date.fromisoformat(v.split('T')[0])
            except ValueError:
                raise ValueError('due_date must be in YYYY-MM-DD format')
        return v


class OCRExtractedItem(BaseModel):
    """Item extracted from OCR"""
    raw_text: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    mapped_product_id: Optional[str] = None
    confidence: Optional[float] = None


class OCRProcessRequest(BaseModel):
    """Request to process OCR document"""
    document_url: str
    auto_map: bool = Field(default=False, description="Automatically map to existing SKUs")


class OCRProcessResponse(BaseModel):
    """Response from OCR processing"""
    success: bool
    extracted_items: List[OCRExtractedItem]
    unmapped_items: List[OCRExtractedItem]
    message: str


class PurchaseOrderUpdate(BaseModel):  # Changed from ProductionOrderUpdate
    quantity: Optional[Decimal] = Field(None, gt=0)
    due_date: Optional[date] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    customer_name: Optional[str] = None
    assigned_team: Optional[str] = None
    production_stage: Optional[str] = None


class PurchaseOrderResponse(PurchaseOrderBase):  # Changed from ProductionOrderResponse
    id: str
    order_number: str
    bom_id: Optional[str] = None
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    unit: str
    status: str
    materials: List[OrderMaterialResponse] = []
    items: List[POItemResponse] = []
    total_material_cost: Optional[Decimal] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    qr_code: Optional[str] = None
    progress_percentage: Decimal = Decimal(0)
    
    class Config:
        from_attributes = True


class PurchaseOrderListItem(BaseModel):  # Changed from ProductionOrderListItem
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
    materials_status: str
    days_until_due: int
    is_overdue: bool
    items: List[POItemResponse] = []
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="Planned, In Progress, Completed, On Hold, Cancelled")
    notes: Optional[str] = None


class OrderAssignment(BaseModel):
    user_id: str
    role: str = Field(..., description="Supervisor, Operator, QC Inspector")


class OrderAssignmentResponse(BaseModel):
    id: str
    purchase_order_id: str  # Changed from order_id
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
    """Material requirement for purchase order"""
    material_id: str
    material_code: str
    material_name: str
    required_qty: Decimal
    unit: str
    available_qty: Decimal = Decimal('0')
    allocated_qty: Decimal = Decimal('0')
    issued_qty: Decimal = Decimal('0')
    shortage_qty: Decimal = Decimal('0')
    availability_status: str
    
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
    shortage_status: str
    procurement_needed: bool = False
    
    class Config:
        from_attributes = True


class PurchaseOrderValidation(BaseModel):  # Changed from ProductionOrderValidation
    """Purchase order validation result"""
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


class PurchaseOrderWithShortages(PurchaseOrderResponse):  # Changed from ProductionOrderWithShortages
    """Purchase order response with shortage details"""
    shortage_summary: Optional[dict] = None
    has_shortages: bool = False
    can_produce: bool = True
    
    class Config:
        from_attributes = True
