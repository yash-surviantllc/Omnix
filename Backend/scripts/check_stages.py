import asyncio
from app.database import get_db
import json

async def check_stages():
    db = get_db()
    
    print("--- WIP STAGES ---")
    stages = db.table('wip_stages').select('*').execute()
    print(json.dumps(stages.data, indent=2))
    
    print("\n--- WORK ORDERS ---")
    wo = db.table('work_orders').select('id, work_order_number').limit(5).execute()
    print(json.dumps(wo.data, indent=2))
    
    if wo.data:
        wo_id = wo.data[0]['id']
        print(f"\n--- OPERATIONS for {wo.data[0]['work_order_number']} ---")
        ops = db.table('work_order_operations').select('*').eq('work_order_id', wo_id).execute()
        print(json.dumps(ops.data, indent=2))

if __name__ == "__main__":
    asyncio.run(check_stages())
