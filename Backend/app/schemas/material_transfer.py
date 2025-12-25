from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal


class MaterialTransferBase(BaseModel):
    product_id: str = Field(..., description="Material/product to transfer")
    from_location_id: str = Field(..., description="Source location")
    to_location_id: str = Field(..., description="Destination location")
    quantity: Decimal = Field(..., gt=0, description="Transfer quantity")
    unit: str
    priority: str = Field(default="Normal", description="Low, Normal, High, Urgent")
    reason: Optional[str] = None
    notes: Optional[str] = None
    reference_order_id: Optional[str] = Field(None, description="Link to production order")


class MaterialTransferCreate(MaterialTransferBase):
    pass


class MaterialTransferUpdate(BaseModel):
    quantity: Optional[Decimal] = Field(None, gt=0)
    priority: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class MaterialTransferResponse(MaterialTransferBase):
    id: str
    transfer_number: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    from_location_name: Optional[str] = None
    to_location_name: Optional[str] = None
    status: str
    transfer_type: str
    requested_by: Optional[str] = None
    requested_by_name: Optional[str] = None
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    executed_by: Optional[str] = None
    executed_by_name: Optional[str] = None
    requested_at: datetime
    approved_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MaterialTransferListItem(BaseModel):
    """Simplified transfer for list/history view"""
    id: str
    transfer_number: str
    material: str  # Product name
    quantity: Decimal
    unit: str
    from_location: str  # Location name
    to_location: str  # Location name
    status: str
    date: datetime  # requested_at or executed_at based on status
    
    class Config:
        from_attributes = True


class TransferStatusUpdate(BaseModel):
    status: str = Field(..., description="Approved, Rejected, Completed, Cancelled")
    notes: Optional[str] = None


class TransferApprovalRequest(BaseModel):
    approve: bool = Field(..., description="True to approve, False to reject")
    notes: Optional[str] = None


# =============================================
# WIP STAGE TRANSFER SCHEMAS
# =============================================

class WIPStageBase(BaseModel):
    name: str
    code: str
    sequence_number: int
    target_time_minutes: Optional[int] = None
    location_id: Optional[str] = None
    description: Optional[str] = None


class WIPStageResponse(WIPStageBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WIPStageTransferCreate(BaseModel):
    order_id: str = Field(..., description="Production order ID")
    from_stage_id: Optional[str] = Field(None, description="Current stage (null if starting)")
    to_stage_id: str = Field(..., description="Next stage")
    quantity: Decimal = Field(..., gt=0, description="Quantity to move")
    actual_time_minutes: Optional[int] = Field(None, description="Time spent in previous stage")
    notes: Optional[str] = None


class WIPStageTransferResponse(BaseModel):
    id: str
    transfer_id: Optional[str] = None
    order_id: str
    order_number: Optional[str] = None
    from_stage_id: Optional[str] = None
    from_stage_name: Optional[str] = None
    to_stage_id: str
    to_stage_name: str
    quantity: Decimal
    unit: str
    actual_time_minutes: Optional[int] = None
    notes: Optional[str] = None
    transferred_by: Optional[str] = None
    transferred_by_name: Optional[str] = None
    transferred_at: datetime
    
    class Config:
        from_attributes = True


class WIPStageWithUnits(BaseModel):
    """WIP stage with current unit count (for UI display)"""
    id: str
    name: str
    code: str
    sequence_number: int
    units: int  # Current units in this stage
    target_time_minutes: Optional[int] = None
    
    class Config:
        from_attributes = True


class OrderStageStatus(BaseModel):
    """Current stage status of an order"""
    order_id: str
    order_number: str
    current_stages: List[WIPStageWithUnits]  # Can be in multiple stages
    total_quantity: Decimal
    completed_quantity: Decimal
    in_progress_quantity: Decimal