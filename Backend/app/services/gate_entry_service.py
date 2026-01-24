from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.schemas.gate_entry import (
    GateEntryCreate, GateEntryUpdate, GateEntryResponse,
    GateEntryListItem, GateEntryMaterialResponse, GateEntryStatusUpdate,
    GateEntryStats
)
from app.core.exceptions import NotFoundException, ValidationException


class GateEntryService:
    
    @staticmethod
    def _generate_entry_number() -> str:
        """Generate unique entry number: GE-YYYY-XXXX"""
        db = get_db()
        year = datetime.now().year
        
        # Get count of entries this year
        result = db.table('gate_entries').select('entry_number', count='exact').like(
            'entry_number', f'GE-{year}-%'
        ).execute()
        
        count = result.count if hasattr(result, 'count') else 0
        next_number = count + 1
        
        return f"GE-{year}-{next_number:04d}"
    
    @staticmethod
    async def create_gate_entry(
        entry_data: GateEntryCreate,
        user_id: str
    ) -> GateEntryResponse:
        """Create a new gate entry with materials"""
        db = get_db()
        
        # Validate entry type
        valid_types = ['material', 'courier', 'visitor', 'jobwork_return', 
                      'subcontract_return', 'delivery', 'machine_spare']
        if entry_data.entry_type not in valid_types:
            raise ValidationException(detail=f"Invalid entry type. Must be one of: {', '.join(valid_types)}")
        
        # Validate status
        # Database does not support destination_department, skipping validation
        # valid_departments = ['Store', 'QA', 'Maintenance', 'Production', 'Admin']
        # if entry_data.destination_department not in valid_departments:
        #     raise ValidationException(detail=f"Invalid department. Must be one of: {', '.join(valid_departments)}")
        
        # Generate entry number
        entry_number = GateEntryService._generate_entry_number()
        
        # Create gate entry
        entry_insert = {
            'entry_number': entry_number,
            'entry_type': entry_data.entry_type,
            # 'vendor' - DROPPED (No DB Column)
            'vehicle_number': entry_data.vehicle_no,
            'driver_name': entry_data.driver_name,
            'reference_document_number': entry_data.linked_document,
            # 'destination_department' - DROPPED (No DB Column)
            'status': 'Arrived',
            # 'remarks' - DROPPED (No DB Column)
            'photos': entry_data.photos,
            # 'created_by' - DROPPED (No DB Column)
        }
        
        result = db.table('gate_entries').insert(entry_insert).execute()
        
        if not result.data:
            raise ValidationException(detail="Failed to create gate entry")
        
        entry_id = result.data[0]['id']
        
        # Insert materials
        for material in entry_data.materials:
            material_insert = {
                'gate_entry_id': entry_id,
                'material_code': material.material_code,
                'material_name': material.material_name,
                'quantity': str(material.quantity),
                'uom': material.uom
            }
            db.table('gate_entry_materials').insert(material_insert).execute()
        
        # Fetch and return complete entry
        return await GateEntryService.get_entry_by_id(entry_id)
    
    @staticmethod
    async def get_entry_by_id(entry_id: str) -> GateEntryResponse:
        """Get gate entry by ID with materials"""
        db = get_db()
        
        # Get entry
        entry_result = db.table('gate_entries').select('*').eq('id', entry_id).execute()
        
        if not entry_result.data:
            raise NotFoundException(detail="Gate entry not found")
        
        entry = entry_result.data[0]
        
        # Get materials
        materials_result = db.table('gate_entry_materials').select('*').eq(
            'gate_entry_id', entry_id
        ).execute()
        
        materials = [
            GateEntryMaterialResponse(
                id=m['id'],
                gate_entry_id=m['gate_entry_id'],
                material_code=m['material_code'],
                material_name=m['material_name'],
                quantity=Decimal(str(m['quantity'])),
                uom=m['uom'],
                created_at=m['created_at'],
                updated_at=m['updated_at']
            )
            for m in materials_result.data
        ]
        
        return GateEntryResponse(
            id=entry['id'],
            entry_number=entry['entry_number'],
            entry_type=entry['entry_type'],
            vendor="N/A", # Dropped
            vehicle_no=entry.get('vehicle_number'),
            driver_name=entry['driver_name'],
            linked_document=entry.get('reference_document_number'),
            destination_department="N/A", # Dropped
            status=entry['status'],
            remarks="", # Dropped
            photos=entry.get('photos', []),
            materials=materials,
            created_by=None, # Dropped
            created_at=entry['created_at'],
            updated_at=entry['updated_at']
        )
    
    @staticmethod
    async def list_gate_entries(
        page: int = 1,
        limit: int = 50,
        status: Optional[str] = None,
        entry_type: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> List[GateEntryListItem]:
        """List gate entries with filters"""
        db = get_db()
        
        offset = (page - 1) * limit
        
        # Build query
        query = db.table('gate_entries').select(
            'id, entry_number, entry_type, vehicle_number, driver_name, '
            'status, reference_document_number, created_at'  # Select available columns
        )
        
        # Apply filters
        if status:
            query = query.eq('status', status)
        
        if entry_type:
            query = query.eq('entry_type', entry_type)
        
        if search:
            query = query.or_(f'entry_number.ilike.%{search}%')
        
        if date_from:
            query = query.gte('created_at', date_from)
        
        if date_to:
            query = query.lte('created_at', date_to)
        
        # Order and paginate
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        entries = []
        for entry in result.data:
            # Get material count and first material
            materials_result = db.table('gate_entry_materials').select(
                'material_name, quantity'
            ).eq('gate_entry_id', entry['id']).limit(1).execute()
            
            material_count_result = db.table('gate_entry_materials').select(
                'id', count='exact'
            ).eq('gate_entry_id', entry['id']).execute()
            
            material_count = material_count_result.count if hasattr(material_count_result, 'count') else 0
            first_material = materials_result.data[0]['material_name'] if materials_result.data else None
            
            # Calculate total items
            total_items_result = db.table('gate_entry_materials').select(
                'quantity'
            ).eq('gate_entry_id', entry['id']).execute()
            
            total_items = sum(Decimal(str(m['quantity'])) for m in total_items_result.data) if total_items_result.data else None
            
            entries.append(GateEntryListItem(
                id=entry['id'],
                entry_number=entry['entry_number'],
                entry_type=entry['entry_type'],
                vendor="See Remarks",
                vehicle_no=entry.get('vehicle_number'),
                driver_name=entry['driver_name'],
                destination_department="See Remarks",
                status=entry['status'],
                linked_document=entry.get('reference_document_number'),
                material_count=material_count,
                first_material_name=first_material,
                total_items=total_items,
                created_at=entry['created_at']
            ))
        
        return entries
    
    @staticmethod
    async def update_gate_entry(
        entry_id: str,
        entry_data: GateEntryUpdate,
        user_id: str
    ) -> GateEntryResponse:
        """Update gate entry"""
        db = get_db()
        
        # Check if entry exists
        existing = db.table('gate_entries').select('id, status').eq('id', entry_id).execute()
        
        if not existing.data:
            raise NotFoundException(detail="Gate entry not found")
        
        # Build update dict
        update_data = {}
        
        if entry_data.entry_type is not None:
            update_data['entry_type'] = entry_data.entry_type
        if entry_data.vendor is not None:
             pass
        if entry_data.vehicle_no is not None:
            update_data['vehicle_number'] = entry_data.vehicle_no
        if entry_data.driver_name is not None:
            update_data['driver_name'] = entry_data.driver_name
        if entry_data.linked_document is not None:
            update_data['reference_document_number'] = entry_data.linked_document
        if entry_data.destination_department is not None:
            pass
        if entry_data.status is not None:
            update_data['status'] = entry_data.status
        if entry_data.remarks is not None:
            pass
        
        if update_data:
            db.table('gate_entries').update(update_data).eq('id', entry_id).execute()
        
        # Update materials if provided
        if entry_data.materials is not None:
            # Delete existing materials
            db.table('gate_entry_materials').delete().eq('gate_entry_id', entry_id).execute()
            
            # Insert new materials
            for material in entry_data.materials:
                material_insert = {
                    'gate_entry_id': entry_id,
                    'material_code': material.material_code,
                    'material_name': material.material_name,
                    'quantity': str(material.quantity),
                    'uom': material.uom
                }
                db.table('gate_entry_materials').insert(material_insert).execute()
        
        return await GateEntryService.get_entry_by_id(entry_id)
    
    @staticmethod
    async def update_entry_status(
        entry_id: str,
        status_data: GateEntryStatusUpdate,
        user_id: str
    ) -> GateEntryResponse:
        """Update gate entry status"""
        db = get_db()
        
        # Validate status
        valid_statuses = ['Arrived', 'Under Verification', 'Accepted', 'Rejected']
        if status_data.status not in valid_statuses:
            raise ValidationException(detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        # Check if entry exists
        existing = db.table('gate_entries').select('id').eq('id', entry_id).execute()
        
        if not existing.data:
            raise NotFoundException(detail="Gate entry not found")
        
        # Update status
        update_data = {
            'status': status_data.status
        }
        
        if status_data.remarks:
            update_data['remarks'] = status_data.remarks
        
        db.table('gate_entries').update(update_data).eq('id', entry_id).execute()
        
        return await GateEntryService.get_entry_by_id(entry_id)
    
    @staticmethod
    async def delete_gate_entry(entry_id: str, user_id: str) -> dict:
        """Delete gate entry"""
        db = get_db()
        
        # Check if entry exists
        existing = db.table('gate_entries').select('id, status').eq('id', entry_id).execute()
        
        if not existing.data:
            raise NotFoundException(detail="Gate entry not found")
        
        entry = existing.data[0]
        
        # Only allow deletion of arrived or rejected entries
        if entry['status'] not in ['Arrived', 'Rejected']:
            raise ValidationException(
                detail="Can only delete entries with 'arrived' or 'rejected' status"
            )
        
        # Delete entry (materials will be cascade deleted)
        db.table('gate_entries').delete().eq('id', entry_id).execute()
        
        return {"message": "Gate entry deleted successfully"}
    
    @staticmethod
    async def get_gate_entry_stats() -> GateEntryStats:
        """Get gate entry statistics"""
        db = get_db()
        # Get all entries
        all_entries = db.table('gate_entries').select('status, entry_type, created_at').execute()
        
        total = len(all_entries.data)
        arrived = sum(1 for e in all_entries.data if e['status'] == 'Arrived')
        under_verification = sum(1 for e in all_entries.data if e['status'] == 'Under Verification')
        accepted = sum(1 for e in all_entries.data if e['status'] == 'Accepted')
        rejected = sum(1 for e in all_entries.data if e['status'] == 'Rejected')
        
        # Today's entries
        today = date.today().isoformat()
        today_entries = sum(1 for e in all_entries.data if e['created_at'].startswith(today))
        
        # By type
        by_type = {}
        for entry in all_entries.data:
            entry_type = entry['entry_type']
            by_type[entry_type] = by_type.get(entry_type, 0) + 1
        
        return GateEntryStats(
            total_entries=total,
            arrived=arrived,
            under_verification=under_verification,
            accepted=accepted,
            rejected=rejected,
            today_entries=today_entries,
            by_type=by_type,
            by_department={} # Feature not supported by DB schema
        )


gate_entry_service = GateEntryService()
