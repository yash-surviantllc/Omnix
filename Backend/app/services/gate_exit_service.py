from datetime import datetime
from typing import List, Optional
from app.database import get_db
from app.schemas.gate_exit import GateExitCreate, GateExitUpdate, GateExitResponse, GateExitStats
from app.core.exceptions import NotFoundException, ValidationException

class GateExitService:
    
    @staticmethod
    def _generate_exit_number() -> str:
        """Generate unique exit number: GX-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        result = db.table('gate_exits').select('exit_number', count='exact').like(
            'exit_number', f'GX-{year}-%'
        ).execute()
        count = result.count if hasattr(result, 'count') else 0
        next_number = count + 1
        return f"GX-{year}-{next_number:04d}"

    @staticmethod
    async def create_exit(data: GateExitCreate, user_id: str) -> GateExitResponse:
        db = get_db()
        
        exit_number = GateExitService._generate_exit_number()
        
        # Prepare materials as JSON-compatible list
        materials_json = [m.dict() for m in data.materials]
        
        insert_data = {
            'exit_number': exit_number,
            'exit_type': data.exit_type,
            'destination': data.destination,
            'vehicle_no': data.vehicle_no,
            'driver_name': data.driver_name,
            'linked_document': data.linked_document,
            'materials': materials_json,
            'status': 'ready',
            'remarks': data.remarks,
            'created_by': user_id
        }
        
        result = db.table('gate_exits').insert(insert_data).execute()
        if not result.data:
            raise ValidationException(detail="Failed to create gate exit")
            
        return await GateExitService.get_exit_by_id(result.data[0]['id'])

    @staticmethod
    async def get_exit_by_id(exit_id: str) -> GateExitResponse:
        db = get_db()
        result = db.table('gate_exits').select('*').eq('id', exit_id).execute()
        if not result.data:
            raise NotFoundException(detail="Gate exit not found")
        
        return GateExitResponse(**result.data[0])

    @staticmethod
    async def list_exits(limit: int = 50, offset: int = 0) -> List[GateExitResponse]:
        db = get_db()
        result = db.table('gate_exits').select('*').order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        return [GateExitResponse(**item) for item in result.data]

    @staticmethod
    async def get_stats() -> GateExitStats:
        db = get_db()
        # Create a simplified stats query - fetching all might be heavy in prod but fine for now
        # Ideally check if Supabase supports count queries better
        all_data = db.table('gate_exits').select('status, created_at').execute()
        
        total = len(all_data.data)
        ready = sum(1 for x in all_data.data if x['status'] == 'ready')
        verified = sum(1 for x in all_data.data if x['status'] == 'verified')
        dispatched = sum(1 for x in all_data.data if x['status'] == 'dispatched')
        
        today_str = datetime.now().date().isoformat()
        today = sum(1 for x in all_data.data if x['created_at'].startswith(today_str))
        
        return GateExitStats(
            total_exits=total,
            ready=ready,
            verified=verified,
            dispatched=dispatched,
            today_exits=today
        )

gate_exit_service = GateExitService()
