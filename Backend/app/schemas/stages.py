from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ============================================
# STAGE SCHEMAS
# ============================================

class StageBase(BaseModel):
    name: str = Field(..., max_length=100, description="Stage name (e.g., Cutting, Sewing)")
    code: str = Field(..., max_length=50, description="Unique stage code (e.g., CUTTING)")
    target_avg_time_minutes: Decimal = Field(..., gt=0, description="Target average time in minutes")
    color: str = Field(default="#3B82F6", description="Hex color for UI display")
    icon: Optional[str] = Field(default=None, max_length=50, description="Lucide icon name")
    description: Optional[str] = Field(default=None, description="Stage description")


class StageCreate(StageBase):
    sequence_number: int = Field(..., ge=1, description="Display sequence number")
    is_active: bool = Field(default=True)


class StageUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    target_avg_time_minutes: Optional[Decimal] = Field(None, gt=0)
    color: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    sequence_number: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None


class StageResponse(StageBase):
    id: str
    sequence_number: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StageUsageStats(BaseModel):
    """Statistics about stage usage"""
    id: str
    name: str
    code: str
    sequence_number: int
    is_active: bool
    products_using_stage: int
    active_work_orders: int
    is_in_use: bool


# ============================================
# PRODUCT-STAGE ASSIGNMENT SCHEMAS
# ============================================

class ProductStageAssignmentBase(BaseModel):
    stage_id: str
    sequence_number: int = Field(..., ge=1)
    is_required: bool = Field(default=True)
    estimated_time_minutes: Optional[Decimal] = Field(None, gt=0, description="Product-specific time override")
    notes: Optional[str] = None


class ProductStageAssignmentCreate(ProductStageAssignmentBase):
    product_id: str


class ProductStageAssignmentUpdate(BaseModel):
    sequence_number: Optional[int] = Field(None, ge=1)
    is_required: Optional[bool] = None
    estimated_time_minutes: Optional[Decimal] = Field(None, gt=0)
    notes: Optional[str] = None


class ProductStageAssignmentResponse(ProductStageAssignmentBase):
    id: str
    product_id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class ProductStageDetail(BaseModel):
    """Detailed stage information for a product"""
    id: str
    name: str
    code: str
    sequence_number: int
    target_avg_time_minutes: Decimal
    color: str
    icon: Optional[str] = None
    description: Optional[str] = None
    is_required: bool
    is_active: bool


class ProductStagesResponse(BaseModel):
    """Complete stage configuration for a product"""
    product_id: str
    product_name: Optional[str] = None
    stages: List[ProductStageDetail]
    total_estimated_time: Decimal = Field(default=Decimal('0'))


class BulkStageAssignment(BaseModel):
    """Bulk assignment of stages to a product"""
    product_id: str
    stages: List[ProductStageAssignmentBase]


class StageReorderRequest(BaseModel):
    """Request to reorder stages"""
    stage_orders: List[dict] = Field(..., description="List of {stage_id: str, sequence_number: int}")
