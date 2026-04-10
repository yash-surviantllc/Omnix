from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    module_context: Optional[str] = None  # which page user is on


class ChatMessage(BaseModel):
    role: str  # user, assistant
    content: str
    timestamp: datetime


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    sources: Optional[List[str]] = None  # tool names used