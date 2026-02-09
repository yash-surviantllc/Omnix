from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class ShiftBase(BaseModel):
    name: str = Field(..., description="Name of the shift (e.g. Morning, Afternoon)")
    start_time: str = Field(..., description="Start time in HH:MM format", pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(..., description="End time in HH:MM format", pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    is_active: bool = True

class ShiftCreate(ShiftBase):
    pass

class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[str] = Field(None, pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: Optional[str] = Field(None, pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    is_active: Optional[bool] = None

class ShiftResponse(ShiftBase):
    id: str
    created_at: datetime
    updated_at: datetime
