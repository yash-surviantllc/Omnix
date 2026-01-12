import asyncio
import sys
from pathlib import Path

# Add the backend directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.absolute()))

from app.services.purchase_order_service import purchase_order_service

async def test_list_orders():
    print("Testing list_purchase_orders...")
    try:
        # Test with default parameters
        orders = await purchase_order_service.list_purchase_orders(
            page=1,
            limit=5,
            status=None,
            priority=None,
            product_id=None,
            overdue_only=False,
            search=None
        )
        
        print(f"✅ Successfully retrieved {len(orders)} purchase orders")
        if orders:
            print(f"Sample order: {orders[0].order_number} - {orders[0].product_name}")
        return True
        
    except Exception as e:
        print(f"❌ Error in test_list_orders: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    asyncio.run(test_list_orders())
