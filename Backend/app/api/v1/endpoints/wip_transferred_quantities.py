"""
Add endpoint to get transferred quantities per work order
"""
from typing import Dict
from fastapi import APIRouter, Depends
from app.database import get_db
from app.auth import require_role
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/working-orders/{work_order_id}/transferred-quantities")
async def get_transferred_quantities(
    work_order_id: str,
    db=Depends(get_db),
    current_user: UserResponse = Depends(require_role("Operator"))
) -> Dict[str, float]:
    """
    Get aggregated transferred quantities per stage for a work order.
    Returns a dictionary mapping stage_id to total transferred quantity.
    """
    # Query wip_stage_transfers to aggregate quantities by to_stage_id
    transfers = db.table('wip_stage_transfers').select(
        'to_stage_id',
        'quantity'
    ).eq('order_id', work_order_id).execute()
    
    # Aggregate quantities by stage
    stage_quantities: Dict[str, float] = {}
    
    for transfer in transfers.data:
        stage_id = transfer['to_stage_id']
        quantity = float(transfer['quantity'])
        
        if stage_id in stage_quantities:
            stage_quantities[stage_id] += quantity
        else:
            stage_quantities[stage_id] = quantity
    
    return stage_quantities
