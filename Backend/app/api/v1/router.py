from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    users,
    dashboard,
    products,
    boms,
    inventory,
    inventory_items,
    purchase_orders,
    material_transfers,
    material_requests,
    wip,
    wip_board,
    alerts,
    gate_entries,
    gate_exits,
    websockets,
    qc,
    stages
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

# Purchase Orders routes
api_router.include_router(
    purchase_orders.router,
    prefix="/orders",
    tags=["Purchase Orders"]
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

# WIP board routes
api_router.include_router(
    wip_board.router,
    prefix="/wip-board",
    tags=["WIP Board"]
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

# WebSocket routes
api_router.include_router(
    websockets.router,
    prefix="/ws",
    tags=["WebSockets"]
)

# Gate Exit routes
api_router.include_router(
    gate_exits.router,
    prefix="/gate-exits",
    tags=["Gate Exits"]
)

# QC routes
api_router.include_router(
    qc.router,
    prefix="/qc",
    tags=["Quality Control"]
)

# Stage Management routes
api_router.include_router(
    stages.router,
    prefix="/stages",
    tags=["Stage Management"]
)