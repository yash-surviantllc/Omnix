from datetime import datetime
from typing import List, Optional
from app.database import get_db
from app.schemas.shifts import ShiftCreate, ShiftUpdate, ShiftResponse

class ShiftService:
    @staticmethod
    async def list_shifts() -> List[ShiftResponse]:
        db = get_db()
        result = db.table('shifts').select('*').order('start_time').execute()
        
        # Convert TIME type to HH:MM string format
        shifts = []
        for shift in result.data:
            # Handle TIME type conversion
            if 'start_time' in shift and shift['start_time']:
                # If it's already a string, keep it; if it's time object, convert
                if not isinstance(shift['start_time'], str):
                    shift['start_time'] = str(shift['start_time'])[:5]  # Get HH:MM from HH:MM:SS
                elif len(shift['start_time']) > 5:
                    shift['start_time'] = shift['start_time'][:5]  # Trim to HH:MM
            
            if 'end_time' in shift and shift['end_time']:
                if not isinstance(shift['end_time'], str):
                    shift['end_time'] = str(shift['end_time'])[:5]
                elif len(shift['end_time']) > 5:
                    shift['end_time'] = shift['end_time'][:5]
            
            shifts.append(ShiftResponse(**shift))
        
        return shifts

    @staticmethod
    async def create_shift(shift_data: ShiftCreate) -> ShiftResponse:
        db = get_db()
        
        # Check duplicate name
        existing = db.table('shifts').select('id').eq('name', shift_data.name).execute()
        if existing.data:
            raise Exception(f"Shift with name {shift_data.name} already exists")
            
        data = shift_data.model_dump()
        result = db.table('shifts').insert(data).execute()
        
        if not result.data:
            raise Exception("Failed to create shift")
        
        # Convert TIME type to HH:MM string format
        shift = result.data[0]
        if 'start_time' in shift and shift['start_time'] and not isinstance(shift['start_time'], str):
            shift['start_time'] = str(shift['start_time'])[:5]
        elif isinstance(shift.get('start_time'), str) and len(shift['start_time']) > 5:
            shift['start_time'] = shift['start_time'][:5]
            
        if 'end_time' in shift and shift['end_time'] and not isinstance(shift['end_time'], str):
            shift['end_time'] = str(shift['end_time'])[:5]
        elif isinstance(shift.get('end_time'), str) and len(shift['end_time']) > 5:
            shift['end_time'] = shift['end_time'][:5]
            
        return ShiftResponse(**shift)

    @staticmethod
    async def update_shift(shift_id: str, shift_data: ShiftUpdate) -> ShiftResponse:
        db = get_db()
        
        data = shift_data.model_dump(exclude_unset=True)
        if not data:
            result = db.table('shifts').select('*').eq('id', shift_id).single().execute()
            if not result.data:
                raise Exception("Shift not found")
            return ShiftResponse(**result.data) # No changes
            
        data['updated_at'] = datetime.utcnow().isoformat()
        
        result = db.table('shifts').update(data).eq('id', shift_id).execute()
        
        if not result.data:
            raise Exception("Shift not found or update failed")
        
        # Convert TIME type to HH:MM string format
        shift = result.data[0]
        if 'start_time' in shift and shift['start_time'] and not isinstance(shift['start_time'], str):
            shift['start_time'] = str(shift['start_time'])[:5]
        elif isinstance(shift.get('start_time'), str) and len(shift['start_time']) > 5:
            shift['start_time'] = shift['start_time'][:5]
            
        if 'end_time' in shift and shift['end_time'] and not isinstance(shift['end_time'], str):
            shift['end_time'] = str(shift['end_time'])[:5]
        elif isinstance(shift.get('end_time'), str) and len(shift['end_time']) > 5:
            shift['end_time'] = shift['end_time'][:5]
            
        return ShiftResponse(**shift)

    @staticmethod
    async def delete_shift(shift_id: str) -> dict:
        db = get_db()
        # Should check if used in work orders? 
        # For now simple delete. If foreign keys exist (none currently), it might fail.
        # But we dropped the CHECK constraint, we don't have FK to shifts table from work_orders yet.
        # work_orders.shift is a STRING. So it's safe to delete from configuration.
        
        result = db.table('shifts').delete().eq('id', shift_id).execute()
        
        return {"message": "Shift deleted successfully"}
