from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class FinishedGoodCreate(BaseModel):
    product_id: str
    work_order_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    quantity: Decimal = Field(gt=0)
    unit: str = "pcs"
    location_id: Optional[str] = None
    status: str = "In Stock"
    quality_status: str = "Approved"
    batch_number: Optional[str] = None
    manufactured_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None


class FinishedGoodUpdate(BaseModel):
    quantity: Optional[Decimal] = Field(None, gt=0)
    location_id: Optional[str] = None
    status: Optional[str] = None
    quality_status: Optional[str] = None
    notes: Optional[str] = None


class FinishedGoodResponse(BaseModel):
    id: str
    product_id: str
    product_code: str
    product_name: str
    work_order_id: Optional[str]
    work_order_number: Optional[str]
    purchase_order_id: Optional[str]
    purchase_order_number: Optional[str]
    quantity: Decimal
    unit: str
    location_id: Optional[str]
    location_name: Optional[str]
    status: str
    quality_status: str
    batch_number: Optional[str]
    manufactured_date: Optional[datetime]
    expiry_date: Optional[datetime]
    notes: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DispatchCreate(BaseModel):
    purchase_order_id: str
    product_id: str
    quantity: Decimal = Field(gt=0)
    unit: str = "pcs"
    dispatch_date: Optional[datetime] = None
    customer_name: Optional[str] = None
    delivery_address: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    status: str = "Pending"
    notes: Optional[str] = None
    finished_good_ids: list[str] = []  # FG items to dispatch


class DispatchUpdate(BaseModel):
    status: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    notes: Optional[str] = None


class DispatchResponse(BaseModel):
    id: str
    dispatch_number: str
    purchase_order_id: str
    purchase_order_number: str
    product_id: str
    product_code: str
    product_name: str
    quantity: Decimal
    unit: str
    dispatch_date: datetime
    customer_name: Optional[str]
    delivery_address: Optional[str]
    vehicle_number: Optional[str]
    driver_name: Optional[str]
    driver_contact: Optional[str]
    status: str
    notes: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class POProgressResponse(BaseModel):
    """Purchase Order progress tracking"""
    purchase_order_id: str
    purchase_order_number: str
    product_id: str
    product_code: str
    product_name: str
    ordered_quantity: Decimal
    quantity_completed: Decimal
    quantity_pending: Decimal
    quantity_in_fg: Decimal
    quantity_dispatched: Decimal
    quantity_reworked: Decimal
    quantity_scrapped: Decimal
    completion_percentage: float
    dispatch_percentage: float
    work_orders: list[dict]  # List of contributing work orders

    class Config:
        from_attributes = True
