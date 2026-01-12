"""
Run with: python -m scripts.debug_po
"""
import asyncio
from app.services.purchase_order_service import purchase_order_service

async def test_list_orders():
    print("Testing list_purchase_orders...")
    try:
        orders = await purchase_order_service.list_purchase_orders(
            page=1, 
            limit=1,
            status=None,
            priority=None,
            product_id=None,
            overdue_only=False,
            search=None
        )
        print(f"✅ Success: Got {len(orders)} orders")
        if orders:
            print(f"Sample order: {orders[0].order_number}")
    except Exception as e:
        print(f"❌ Error in list_orders: {str(e)}")
        raise

async def test_get_order():
    # First get an order ID
    orders = await purchase_order_service.list_purchase_orders(limit=1)
    if not orders:
        print("No orders found to test get_order")
        return
        
    order_id = orders[0].id
    print(f"\nTesting get_order_by_id for order {order_id}...")
    try:
        order = await purchase_order_service.get_order_by_id(order_id)
        print(f"✅ Success: Got order {order.order_number}")
    except Exception as e:
        print(f"❌ Error in get_order: {str(e)}")
        raise

async def test_order_materials():
    orders = await purchase_order_service.list_purchase_orders(limit=1)
    if not orders:
        print("No orders found to test materials")
        return
        
    order_id = orders[0].id
    print(f"\nTesting get_order_materials for order {order_id}...")
    try:
        materials = await purchase_order_service.get_order_materials(order_id)
        print(f"✅ Success: Got {len(materials)} materials")
        if materials:
            print(f"Sample material: {materials[0].material_name} - {materials[0].required_qty} {materials[0].unit}")
    except Exception as e:
        print(f"❌ Error in get_order_materials: {str(e)}")
        raise

async def main():
    print("=== Testing Purchase Order Service ===")
    await test_list_orders()
    await test_get_order()
    await test_order_materials()
    print("\n=== Tests Complete ===")

if __name__ == "__main__":
    asyncio.run(main())
