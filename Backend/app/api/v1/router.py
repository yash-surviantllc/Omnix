from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, users, dashboard, products, boms, 
    inventory, inventory_items, production_orders, material_transfers, material_requests, wip, alerts, gate_entries
)

api_router = APIRouter()

# Authentication routes
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)

# User management routes
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"]
)

# Dashboard routes
api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"]
)

# Product routes
api_router.include_router(
    products.router,
    prefix="/products",
    tags=["Products"]
)

# BOM routes
api_router.include_router(
    boms.router,
    prefix="/boms",
    tags=["BOM Planner"]
)

# Inventory routes
api_router.include_router(
    inventory.router,
    prefix="/inventory",
    tags=["Inventory"]
)

# Inventory Items routes (Material Management)
api_router.include_router(
    inventory_items.router,
    prefix="/inventory-items",
    tags=["Inventory Items"]
)

# Production Orders routes
api_router.include_router(
    production_orders.router,
    prefix="/production-orders",
    tags=["Production Orders"]
)

# Material Transfers routes
api_router.include_router(
    material_transfers.router,
    prefix="/material-transfers",
    tags=["Material Transfer"]
)

api_router.include_router(
    material_requests.router,
    prefix="/material-requests",
    tags=["Material Request"]
)

# WIP routes
api_router.include_router(
    wip.router,
    prefix="/wip",
    tags=["WIP Live Board"]
)

# Alert routes
api_router.include_router(
    alerts.router,
    prefix="/alerts",
    tags=["Alerts"]
)

# Gate Entry routes
api_router.include_router(
    gate_entries.router,
    prefix="/gate-entries",
    tags=["Gate Entry"]
)