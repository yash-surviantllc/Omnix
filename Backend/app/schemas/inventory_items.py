from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


# =============================================
# INVENTORY ITEMS SCHEMAS
# =============================================

class InventoryItemBase(BaseModel):
    material_code: str = Field(..., min_length=1, max_length=50)
    material_name: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = None
    quantity: Decimal = Field(default=0, ge=0)
    allocated_quantity: Decimal = Field(default=0, ge=0)
    unit: str = Field(..., min_length=1, max_length=20)
    location: Optional[str] = None
    reorder_level: Decimal = Field(default=0, ge=0)
    unit_cost: Decimal = Field(default=0, ge=0)
    description: Optional[str] = None


class InventoryItemCreate(InventoryItemBase):
    """Schema for creating a new inventory item"""
    pass


class InventoryItemUpdate(BaseModel):
    """Schema for updating an inventory item"""
    material_name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    quantity: Optional[Decimal] = Field(None, ge=0)
    allocated_quantity: Optional[Decimal] = Field(None, ge=0)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    location: Optional[str] = None
    reorder_level: Optional[Decimal] = Field(None, ge=0)
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    description: Optional[str] = None


class InventoryItemResponse(InventoryItemBase):
    """Schema for inventory item response"""
    id: str
    free_quantity: Decimal
    status: str
    total_value: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class InventoryItemListResponse(BaseModel):
    """Simplified schema for list view"""
    id: str
    material_code: str
    material_name: str
    quantity: Decimal
    allocated_quantity: Decimal
    free_quantity: Decimal
    unit: str
    location: Optional[str]
    reorder_level: Decimal
    status: str
    unit_cost: Decimal
    total_value: Decimal
    
    class Config:
        from_attributes = True


# =============================================
# INVENTORY ITEM TRANSACTIONS SCHEMAS
# =============================================

class InventoryItemTransactionBase(BaseModel):
    inventory_item_id: str
    transaction_type: str = Field(..., description="IN, OUT, ADJUST, TRANSFER, RETURN, SCRAP")
    quantity_change: Decimal = Field(..., description="Positive for increase, negative for decrease")
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class InventoryItemTransactionCreate(BaseModel):
    """Schema for creating a transaction"""
    inventory_item_id: str
    transaction_type: str = Field(..., description="IN, OUT, ADJUST, TRANSFER, RETURN, SCRAP")
    quantity_change: Decimal
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    reference_type: Optional[str] = None
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class InventoryItemTransactionResponse(BaseModel):
    """Schema for transaction response"""
    id: str
    inventory_item_id: str
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    transaction_type: str
    quantity_before: Decimal
    quantity_change: Decimal
    quantity_after: Decimal
    unit: str
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    transaction_date: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True


# =============================================
# STOCK ALERTS SCHEMAS
# =============================================

class StockAlertItemResponse(BaseModel):
    """Schema for stock alert response"""
    id: str
    inventory_item_id: str
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    alert_type: str
    alert_level: str
    current_quantity: Decimal
    threshold_quantity: Optional[Decimal] = None
    status: str
    message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# =============================================
# SUMMARY SCHEMAS
# =============================================

class InventoryItemsSummary(BaseModel):
    """Summary KPIs for inventory items dashboard"""
    total_materials: int
    low_stock_count: int
    critical_count: int
    out_of_stock_count: int
    sufficient_count: int
    total_value: Decimal


class InventoryItemStatsCard(BaseModel):
    """Stats for dashboard cards"""
    label: str
    value: str
    change: Optional[str] = None
    trend: Optional[str] = None  # "up" or "down"


# =============================================
# BULK OPERATIONS
# =============================================

class BulkInventoryUpdate(BaseModel):
    """Schema for bulk inventory updates"""
    items: list[dict]


class InventoryAdjustmentRequest(BaseModel):
    """Schema for inventory adjustment"""
    inventory_item_id: str
    adjustment_quantity: Decimal = Field(..., description="Positive to add, negative to reduce")
    reason: str
    notes: Optional[str] = None
