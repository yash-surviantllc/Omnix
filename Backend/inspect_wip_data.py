
import asyncio
from app.database import get_db

async def inspect_wip_data():
    db = get_db()
    
    print("--- TRIGGERING METRICS UPDATE ---")
    try:
        db.rpc('update_wip_stage_metrics', {}).execute()
        print("Metrics updated successfully.")
    except Exception as e:
        print(f"Error updating metrics: {e}")

    print("\n--- WIP STAGES ---")
    stages = db.table('wip_stages').select('*').execute()
    for s in stages.data:
        print(f"ID: {s['id']}, Name: {s['name']}, Code: {s['code']}, Active: {s['is_active']}, Seq: {s['sequence_number']}")
        
    print("\n--- WIP STAGE METRICS ---")
    metrics = db.table('wip_stage_metrics').select('*').execute()
    for m in metrics.data:
        print(f"Stage: {m['stage_name']}, Orders: {m['orders_count']}, Units: {m['units_count']}, AvgTime: {m['avg_time_minutes']}, Util: {m['utilization_percentage']}, Health: {m['health_status']}")

    print("\n--- WORK ORDERS (IN PROGRESS) ---")
    wos = db.table('work_orders').select('id, work_order_number, status, operation, actual_start, actual_end').eq('status', 'In Progress').execute()
    for wo in wos.data:
        print(f"WO: {wo['work_order_number']}, Status: {wo['status']}, Op: {wo['operation']}, Start: {wo['actual_start']}")

if __name__ == "__main__":
    asyncio.run(inspect_wip_data())
