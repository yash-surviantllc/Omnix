from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal

class QCDefectCreate(BaseModel):
    defect_type: str  # 'Rework' or 'Scrap'
    reason: str
    quantity: float
    photo_url: Optional[str] = None
    notes: Optional[str] = None

class QCDefectResponse(QCDefectCreate):
    id: str
    inspection_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class QCInspectionCreate(BaseModel):
    purchase_order_id: Optional[str] = None
    work_order_id: Optional[str] = None  # Link to working order
    product_id: str
    quantity_checked: float
    passed_qty: float
    rework_qty: float
    scrap_qty: float
    status: str  # 'Pending', 'In Progress', 'Completed'
    notes: Optional[str] = None
    defects: List[QCDefectCreate] = []

class QCInspectionUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    # Add other fields as necessary

class QCInspectionResponse(BaseModel):
    id: str
    inspection_number: str
    purchase_order_id: Optional[str]
    purchase_order_number: Optional[str] = None
    work_order_id: Optional[str] = None
    work_order_number: Optional[str] = None
    product_id: str
    product_name: Optional[str]
    product_code: Optional[str]
    inspector_id: Optional[str]
    inspector_name: Optional[str]
    
    quantity_checked: Decimal
    passed_qty: Decimal
    rework_qty: Decimal
    scrap_qty: Decimal
    
    status: str
    notes: Optional[str]
    
    defects: List[QCDefectResponse] = []
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QCStats(BaseModel):
    total_inspections: int
    today_inspections: int
    pending_rework: int
    pass_rate: float
