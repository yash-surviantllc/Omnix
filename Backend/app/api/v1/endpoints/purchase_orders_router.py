"""
Purchase Orders Router

This module contains all the API endpoints for managing purchase orders.
It uses the updated naming convention with 'purchase_order' instead of 'production_order'.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from decimal import Decimal

from app.schemas.purchase_order_updated import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListItem, OrderStatusUpdate, MaterialRequirement, OrderProgress,
    TeamAssignment, PurchaseOrderValidation, PurchaseOrderMultiSKUCreate
)
from app.schemas.user import UserResponse
from app.services.purchase_order_service_updated import purchase_order_service
from app.api.deps import get_current_user, require_role

router = APIRouter()

# Include all the route handlers from purchase_orders_updated.py
from .purchase_orders_updated import *

# This file serves as a router that imports all the route handlers from purchase_orders_updated.py
# The actual route implementations are in purchase_orders_updated.py to keep the code organized.
