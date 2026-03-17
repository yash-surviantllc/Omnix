import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')) or '')

from app.database import get_db

async def check_times():
    db = get_db()
    
    # search for WO-2026-0083
    res = db.table('work_orders').select('*').eq('work_order_number', 'WO-2026-0083').execute()
    print("WORK ORDER:", res.data)
    
    if res.data:
        wo_id = res.data[0]['id']
        ops = db.table('work_order_operations').select('*').eq('work_order_id', wo_id).execute()
        print("\nOPERATIONS:")
        for op in ops.data:
            print(f"Operation: {op.get('operation')} | Status: {op.get('status')} | Actual Start: {op.get('actual_start')} | Actual End: {op.get('actual_end')}")

if __name__ == '__main__':
    asyncio.run(check_times())
