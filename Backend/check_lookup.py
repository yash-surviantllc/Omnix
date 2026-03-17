import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')) or '')

from app.services.wip_service import list_working_orders

async def check():
    res = await list_working_orders(search='WO-2026-0083')
    print("LOOKUP RESULT:")
    for item in res:
         print(f"Stage: {item.get('stage_name')} | Operation: {item.get('operation')} | Actual Start: {item.get('actual_start')} | Work Order: {item.get('work_order_number')}")

if __name__ == '__main__':
    asyncio.run(check())
