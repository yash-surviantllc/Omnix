import httpx
import json

base_url = "http://127.0.0.1:8000"

# Fake token logic if needed or we just make an unauthenticated request to see if it hits the endpoint at least
# Actually, the quickest way is to just do an import of the service and run create_transfer directly, bypassing auth for the test.
from app.database import get_db
from app.services.material_transfer_service import MaterialTransferService
from app.schemas.material_transfer import MaterialTransferCreate
import asyncio
import traceback

async def test_create():
    try:
        # We need realistic IDs that might cause the 500. 
        # Let's get a product and a from_location
        db = get_db()
        product = db.table('products').select('id', 'unit').limit(1).execute()
        product_id = product.data[0]['id']
        unit = product.data[0]['unit']
        
        from_loc = db.table('locations').select('id').limit(1).execute()
        from_loc_id = from_loc.data[0]['id']
        
        # Get a WIP stage ID for destination
        to_stage = db.table('wip_stages').select('id').limit(1).execute()
        to_loc_id = to_stage.data[0]['id']
        
        transfer_data = MaterialTransferCreate(
            product_id=product_id,
            from_location_id=from_loc_id,
            to_location_id=to_loc_id,
            quantity=1,
            unit=unit,
            priority='Normal'
        )
        # Assuming user_id can be dummy
        user_id = '00000000-0000-0000-0000-000000000000'
        
        print(f"Calling create_transfer with to_location_id = {to_loc_id} (WIP Stage)")
        result = await MaterialTransferService.create_transfer(transfer_data, user_id)
        print("Success!")
    except Exception as e:
        print("ERROR OCCURRED:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_create())
