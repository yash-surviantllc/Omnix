from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class GateExitMaterial(BaseModel):
    material_code: Optional[str] = None
    material_name: str
    quantity: float
    uom: str

class GateExitCreate(BaseModel):
    exit_type: str = Field(..., description="dispatch, jobwork_out, scrap, courier, return, transfer, sample")
    destination: str
    vehicle_no: Optional[str] = None
    driver_name: Optional[str] = None
    linked_document: Optional[str] = None
    customer: Optional[str] = None # Mapped to destination or remarks if needed, or we use destination for customer
    materials: List[GateExitMaterial] = []
    remarks: Optional[str] = None

class GateExitUpdate(BaseModel):
    exit_type: Optional[str] = None
    destination: Optional[str] = None
    vehicle_no: Optional[str] = None
    driver_name: Optional[str] = None
    linked_document: Optional[str] = None
    status: Optional[str] = None
    materials: Optional[List[GateExitMaterial]] = None
    remarks: Optional[str] = None

class GateExitResponse(BaseModel):
    id: str
    exit_number: str
    exit_type: str
    destination: str
    vehicle_no: Optional[str]
    driver_name: Optional[str]
    linked_document: Optional[str]
    status: str
    materials: List[GateExitMaterial]
    remarks: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]

    class Config:
        from_attributes = True

class GateExitStats(BaseModel):
    total_exits: int
    ready: int
    verified: int
    dispatched: int
    today_exits: int
