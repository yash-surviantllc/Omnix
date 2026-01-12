import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from app.services.wip_service import wip_service
from app.schemas.wip import WorkingOrderCreate
from decimal import Decimal

@pytest.mark.asyncio
async def test_working_order_status_updates():
    # Create a test working order
    production_id = str(uuid4())
    product_id = str(uuid4())

    test_order = WorkingOrderCreate(
        purchase_order_id=production_id,
        product_id=product_id,
        operation="Test Operation",
        workstation="Test Workstation",
        assigned_team="Test Team",
        shift="Morning",
        target_qty=Decimal(10),
        unit="pcs",
        priority="Normal",
        scheduled_start=datetime.now(timezone.utc),
        scheduled_end=datetime.now(timezone.utc) + timedelta(days=1),
        notes="Test working order"
    )
    
    user_id = str(uuid4())

    try:
        # Create the order
        created = await wip_service.create_working_order(test_order, user_id)
        
        # Test working order status transitions
        # 1. Start the order
        updated = await wip_service.update_working_order(
            created.id,
            {"status": "In Progress"},
            user_id
        )
        assert updated.status == "In Progress"
        
        # 2. Pause the order
        updated = await wip_service.update_working_order(
            created.id,
            {"status": "On Hold", "notes": "Pausing for maintenance"},
            user_id
        )
        assert updated.status == "On Hold"
        
        # 3. Resume the order
        updated = await wip_service.update_working_order(
            created.id,
            {"status": "In Progress", "notes": "Resuming work"},
            user_id
        )
        assert updated.status == "In Progress"
        
        # 4. Complete the order
        updated = await wip_service.update_working_order(
            created.id,
            {
                "status": "Completed",
                "completed_qty": Decimal(10),
                "actual_end": datetime.now(timezone.utc)
            },
            user_id
        )
        assert updated.status == "Completed"
        assert updated.completed_qty == 10
        assert updated.actual_end is not None
        
    finally:
        # Clean up - cancel the order if it wasn't completed
        try:
            if 'created' in locals() and hasattr(created, 'id'):
                await wip_service.delete_working_order(created.id)
        except Exception as e:
            print(f"Cleanup error: {e}")
