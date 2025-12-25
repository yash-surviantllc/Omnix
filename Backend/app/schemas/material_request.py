from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal


class RequestItemBase(BaseModel):
    product_id: str
    item_code: Optional[str] = None
    material_description: Optional[str] = None
    requested_qty: Decimal = Field(..., gt=0)
    unit: str
    required_date: Optional[date] = None
    location: Optional[str] = None  # Destination location
    priority: str = Field(default="Normal", description="Low, Normal, High")
    notes: Optional[str] = None


class RequestItemCreate(RequestItemBase):
    pass


class RequestItemResponse(RequestItemBase):
    id: str
    request_id: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    approved_qty: Decimal
    issued_qty: Decimal
    availability_status: Optional[str] = None  # Available, Partial, Shortage
    available_stock: Decimal
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MaterialRequestBase(BaseModel):
    department: str
    shift: Optional[str] = None  # Shift 1, 2, 3
    request_date: date
    required_date: Optional[date] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    delivery_instructions: Optional[str] = None
    priority: str = Field(default="Normal")
    reference_order_id: Optional[str] = None
    requested_by_name: Optional[str] = None  # For form display
    reviewed_by_name: Optional[str] = None
    approved_by_name: Optional[str] = None


class MaterialRequestCreate(MaterialRequestBase):
    items: List[RequestItemCreate] = Field(..., min_length=1)


class MaterialRequestUpdate(BaseModel):
    department: Optional[str] = None
    shift: Optional[str] = None
    required_date: Optional[date] = None
    delivery_instructions: Optional[str] = None
    priority: Optional[str] = None


class MaterialRequestResponse(MaterialRequestBase):
    id: str
    request_number: str
    status: str
    items: List[RequestItemResponse] = []
    requested_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    approved_by: Optional[str] = None
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    fulfilled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MaterialRequestListItem(BaseModel):
    """Simplified request for list view"""
    id: str
    request_number: str
    department: str
    material: str  # First material or count
    quantity: Decimal  # First item quantity or total
    date: date
    status: str
    
    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    """Review request action"""
    notes: Optional[str] = None


class ApprovalRequest(BaseModel):
    """Approval with optional partial quantities"""
    approve_all: bool = Field(default=True)
    item_approvals: Optional[List[dict]] = Field(None, description="[{item_id, approved_qty}]")
    notes: Optional[str] = None
    auto_create_transfer: bool = Field(default=True, description="Auto-create material transfer on approval")


class PickListItem(BaseModel):
    """Item in pick list"""
    item_code: str
    material_name: str
    requested_qty: Decimal
    approved_qty: Decimal
    unit: str
    location: str
    picked: bool = False


class PickListResponse(BaseModel):
    """Pick list for store team"""
    request_number: str
    department: str
    shift: Optional[str] = None
    requested_by: str
    approved_by: str
    items: List[PickListItem]
    generated_at: datetime


class QuickRequestTemplate(BaseModel):
    """Quick action template"""
    id: str
    name: str
    product_id: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    default_quantity: Decimal
    unit: str
    destination_location: Optional[str] = None
    department: Optional[str] = None
    
    class Config:
        from_attributes = True


class StockAvailabilityCheck(BaseModel):
    """Check stock availability for request items"""
    items: List[dict]  # [{product_id, requested_qty}]


class StockAvailabilityResponse(BaseModel):
    """Stock availability result"""
    product_id: str
    product_code: str
    product_name: str
    requested_qty: Decimal
    available_qty: Decimal
    status: str  # Available, Partial, Shortage