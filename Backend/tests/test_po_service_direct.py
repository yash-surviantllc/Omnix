import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.purchase_order_service import purchase_order_service
import asyncio

async def test():
    try:
        orders = await purchase_order_service.list_purchase_orders(page=1, limit=10)
        print(f"Orders returned: {len(orders)}")
        for order in orders:
            print(f"  - {order.order_number}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test())
