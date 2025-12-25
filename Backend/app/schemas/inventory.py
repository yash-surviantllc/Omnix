from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class LocationBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    type: Optional[str] = Field(None, description="Store, Production Line, Warehouse, etc.")
    description: Optional[str] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class LocationResponse(BaseModel):
    id: str
    code: str
    name: str
    type: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class InventoryBase(BaseModel):
    product_id: str
    location_id: str
    available_qty: Decimal = Field(default=0, ge=0)
    allocated_qty: Decimal = Field(default=0, ge=0)
    in_transit_qty: Decimal = Field(default=0, ge=0)
    lot_number: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None


class InventoryCreate(InventoryBase):
    pass


class InventoryUpdate(BaseModel):
    available_qty: Optional[Decimal] = Field(None, ge=0)
    allocated_qty: Optional[Decimal] = Field(None, ge=0)
    in_transit_qty: Optional[Decimal] = Field(None, ge=0)
    lot_number: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None


class InventoryResponse(InventoryBase):
    id: str
    free_qty: Decimal  # available - allocated
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    last_updated: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class InventoryListItem(BaseModel):
    """Simplified inventory for list view"""
    id: str
    product_id: str
    product_code: str
    product_name: str
    location_id: str
    location_code: str
    location_name: str
    available_qty: Decimal
    allocated_qty: Decimal
    free_qty: Decimal
    unit: str
    lot_number: Optional[str] = None


class StockByProduct(BaseModel):
    """Stock summary by product across all locations"""
    product_id: str
    product_code: str
    product_name: str
    category: str
    unit: str
    total_available: Decimal
    total_allocated: Decimal
    total_free: Decimal
    locations: List[dict]  # List of locations with quantities


class InventoryTransactionBase(BaseModel):
    transaction_type: str = Field(..., description="RECEIPT, ISSUE, TRANSFER, ADJUSTMENT")
    product_id: str
    quantity: Decimal = Field(..., description="Positive for increase, negative for decrease")
    from_location_id: Optional[str] = None
    to_location_id: Optional[str] = None
    lot_number: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None


class InventoryTransactionCreate(BaseModel):
    product_id: str
    transaction_type: str = Field(..., description="TRANSFER, GATE_IN, GATE_OUT, ADJUSTMENT, ALLOCATION, RELEASE")
    quantity: Decimal = Field(..., gt=0)
    from_location_id: Optional[str] = None
    to_location_id: Optional[str] = None
    reference_id: Optional[str] = None
    reference_type: Optional[str] = Field(None, description="material_transfer, gate_entry, gate_exit, production_order")
    notes: Optional[str] = None


class InventoryTransactionResponse(BaseModel):
    id: str
    product_id: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    transaction_type: str
    quantity: Decimal
    from_location_id: Optional[str] = None
    from_location_name: Optional[str] = None
    to_location_id: Optional[str] = None
    to_location_name: Optional[str] = None
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None
    performed_by: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class InventoryAdjustmentRequest(BaseModel):
    product_id: str
    location_id: str
    adjustment_qty: Decimal = Field(..., description="Positive for increase, negative for decrease")
    reason: str
    notes: Optional[str] = None

class StockAlertBase(BaseModel):
    product_id: str
    location_id: Optional[str] = None
    min_qty: Decimal = Field(..., ge=0)
    max_qty: Optional[Decimal] = Field(None, ge=0)
    reorder_qty: Optional[Decimal] = Field(None, ge=0)


class StockAlertCreate(StockAlertBase):
    pass

class StockMovementSummary(BaseModel):
    """Summary of stock movements for a product"""
    product_id: str
    product_code: str
    product_name: str
    total_in: Decimal
    total_out: Decimal
    net_movement: Decimal
    transaction_count: int

class StockAlertUpdate(BaseModel):
    min_qty: Optional[Decimal] = Field(None, ge=0)
    max_qty: Optional[Decimal] = Field(None, ge=0)
    reorder_qty: Optional[Decimal] = Field(None, ge=0)
    is_active: Optional[bool] = None


class StockAlertResponse(StockAlertBase):
    id: str
    is_active: bool
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    current_stock: Optional[Decimal] = None
    status: Optional[str] = None  # OK, LOW, CRITICAL
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ShortageAlert(BaseModel):
    """Material shortage alert for dashboard"""
    product_id: str
    product_code: str
    product_name: str
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    current_stock: Decimal
    min_qty: Decimal
    shortage_qty: Decimal
    unit: str
    priority: str  # CRITICAL, HIGH, MEDIUM


class StockAdjustment(BaseModel):
    """Stock adjustment request"""
    product_id: str
    location_id: str
    adjustment_qty: Decimal  # Positive to add, negative to reduce
    lot_number: Optional[str] = None
    reason: str
    notes: Optional[str] = None

class InventoryListItem(BaseModel):
    id: str
    product_id: str
    product_code: str
    product_name: str
    location_id: str
    location_code: str
    location_name: str
    available_qty: Decimal
    allocated_qty: Decimal
    free_qty: Decimal
    unit: str
    lot_number: Optional[str] = None
    reorder_level: Optional[Decimal] = None
    status: str = "Sufficient" 
    
    class Config:
        from_attributes = True


class InventorySummary(BaseModel):
    """Summary KPIs for inventory dashboard"""
    total_materials: int
    low_stock_count: int
    critical_count: int
    sufficient_count: int