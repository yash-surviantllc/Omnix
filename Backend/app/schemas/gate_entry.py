from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal


class GateEntryMaterialBase(BaseModel):
    material_code: Optional[str] = None
    material_name: str
    quantity: Decimal = Field(..., gt=0)
    uom: str


class GateEntryMaterialCreate(GateEntryMaterialBase):
    pass


class GateEntryMaterialResponse(GateEntryMaterialBase):
    id: str
    gate_entry_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class GateEntryBase(BaseModel):
    entry_type: str = Field(..., description="material, courier, visitor, jobwork_return, subcontract_return, delivery, machine_spare")
    vendor: str = Field(..., min_length=1, max_length=255)
    vehicle_no: Optional[str] = Field(None, max_length=50)
    driver_name: Optional[str] = Field(None, max_length=255)
    linked_document: Optional[str] = Field(None, max_length=100, description="PO/Invoice/DC/AWB number")
    destination_department: str = Field(..., description="Store, QA, Maintenance, Production, Admin")
    remarks: Optional[str] = None


class GateEntryCreate(GateEntryBase):
    materials: List[GateEntryMaterialCreate] = Field(..., min_items=1)


class GateEntryUpdate(BaseModel):
    entry_type: Optional[str] = None
    vendor: Optional[str] = None
    vehicle_no: Optional[str] = None
    driver_name: Optional[str] = None
    linked_document: Optional[str] = None
    destination_department: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    materials: Optional[List[GateEntryMaterialCreate]] = None


class GateEntryResponse(GateEntryBase):
    id: str
    entry_number: str
    status: str
    materials: List[GateEntryMaterialResponse] = []
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class GateEntryListItem(BaseModel):
    """Simplified gate entry for list view"""
    id: str
    entry_number: str
    entry_type: str
    vendor: str
    vehicle_no: Optional[str]
    driver_name: Optional[str]
    destination_department: str
    status: str
    linked_document: Optional[str]
    material_count: int
    first_material_name: Optional[str]
    total_items: Optional[Decimal]
    created_at: datetime
    
    class Config:
        from_attributes = True


class GateEntryStatusUpdate(BaseModel):
    status: str = Field(..., description="arrived, under_verification, accepted, rejected")
    remarks: Optional[str] = None


class GateEntryStats(BaseModel):
    """Gate entry statistics"""
    total_entries: int
    arrived: int
    under_verification: int
    accepted: int
    rejected: int
    today_entries: int
    by_type: dict
    by_department: dict
