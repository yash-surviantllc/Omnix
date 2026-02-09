"""
Material Requisition Schemas
Pydantic models for material requisition requests and responses
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal


class MaterialRequisitionItemCreate(BaseModel):
    """Schema for creating a material requisition item"""
    rm_code: str = Field(..., description="Raw Material code/number")
    material_description: str = Field(..., description="Description of the material")
    unit_of_measure: str = Field(..., description="Unit of measure (kg, m, pcs, etc.)")
    quantity_requested: Decimal = Field(..., gt=0, description="Quantity requested")
    required_date: Optional[date] = Field(None, description="Date when material is required")
    location: Optional[str] = Field(None, description="Delivery location")
    priority: str = Field(default="Normal", description="Priority level (Urgent, High, Normal, Low)")


class MaterialRequisitionItemResponse(MaterialRequisitionItemCreate):
    """Schema for material requisition item response"""
    id: str
    requisition_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class MaterialRequisitionCreate(BaseModel):
    """Schema for creating a material requisition"""
    work_order_number: Optional[str] = Field(None, description="Associated work order number")
    department: str = Field(..., description="Requesting department")
    requesting_stage: Optional[str] = Field(None, description="Stage/operation requesting materials")
    requested_by: str = Field(..., description="Person requesting (name and role)")
    reviewed_by: Optional[str] = Field(None, description="Person who reviewed the request")
    shift: Optional[str] = Field(None, description="Shift number (Shift 1, Shift 2, Shift 3)")
    start_time: Optional[datetime] = Field(None, description="Production start time")
    end_time: Optional[datetime] = Field(None, description="Production end time")
    delivery_instructions: Optional[str] = Field(None, description="Special delivery instructions or notes")
    items: List[MaterialRequisitionItemCreate] = Field(..., min_length=1, description="List of materials requested")


class MaterialRequisitionUpdate(BaseModel):
    """Schema for updating a material requisition"""
    status: Optional[str] = Field(None, description="Status (Pending, Approved, Issued, Completed, Cancelled)")
    reviewed_by: Optional[str] = None
    delivery_instructions: Optional[str] = None


class MaterialRequisitionResponse(BaseModel):
    """Schema for material requisition response"""
    id: str
    requisition_number: str
    work_order_number: Optional[str]
    department: str
    requesting_stage: Optional[str]
    requested_by: str
    reviewed_by: Optional[str]
    shift: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    delivery_instructions: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    items: List[MaterialRequisitionItemResponse]
    
    class Config:
        from_attributes = True


class MaterialRequisitionSummary(BaseModel):
    """Schema for material requisition summary (list view)"""
    id: str
    requisition_number: str
    work_order_number: Optional[str]
    department: str
    requested_by: str
    status: str
    created_at: datetime
    item_count: int
    total_quantity: Optional[Decimal]
    
    class Config:
        from_attributes = True
