import asyncio
import traceback
from app.services.material_transfer_service import MaterialTransferService
from app.schemas.material_transfer import MaterialTransferCreate
from app.database import get_db

async def run():
    db = get_db()
    
    # 1. Get a valid user
    user = db.table('users').select('id').limit(1).execute()
    user_id = user.data[0]['id']
    
    # 2. Get a valid product and location with inventory
    inv = db.table('inventory').select('*').limit(1).execute()
    item = inv.data[0]
    
    # 3. Get a valid WIP Stage
    stage = db.table('wip_stages').select('id', 'name').limit(1).execute()
    stage_id = stage.data[0]['id']
    print(f"Transferring to Stage: {stage.data[0]['name']} (ID: {stage_id})")
    
    # 4. Get a valid unique work order
    wo = db.table('work_orders').select('id', 'work_order_number').limit(1).execute()
    wo_id = wo.data[0]['id']
    wo_no = wo.data[0]['work_order_number']
    print(f"Using Work Order: {wo_no} (ID: {wo_id})")
    
    # Fake transfer Data
    data = MaterialTransferCreate(
        product_id=item['product_id'],
        from_location_id=item['location_id'],
        to_location_id=stage_id,
        quantity=0.01,
        unit='kg',
        work_order_id=wo_id, 
        work_order_number=wo_no,
        priority='Normal'
    )
    
    try:
        res = await MaterialTransferService.create_transfer(data, user_id)
        print("SUCCESS! Created Transfer ID:", res.id)
    except Exception as e:
        print("FAILED WITH EXCEPTION:")
        traceback.print_exc()

asyncio.run(run())
