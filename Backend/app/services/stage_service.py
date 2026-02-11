from typing import List, Optional
from decimal import Decimal
from app.database import get_db
from app.schemas.stages import (
    StageCreate, StageUpdate, StageResponse, StageUsageStats,
    ProductStageAssignmentCreate, ProductStageAssignmentUpdate,
    ProductStageAssignmentResponse, ProductStageDetail,
    ProductStagesResponse, BulkStageAssignment
)


class StageService:
    """Service for managing WIP stages and product-stage assignments"""
    
    # ============================================
    # STAGE MANAGEMENT
    # ============================================
    
    @staticmethod
    async def list_stages(active_only: bool = True, config_id: str = 'default') -> List[StageResponse]:
        """List all WIP stages filtered by configuration using junction table"""
        db = get_db()
        
        # Query junction table to get stages for this config
        query = (
            db.table('config_stages')
            .select('*, wip_stages(*)')
            .eq('config_id', config_id)
            .order('sequence_number')
        )
        
        result = query.execute()
        
        stages = []
        for row in result.data:
            stage = row['wip_stages']
            
            # Skip system stage
            if stage['code'] == 'SYSTEM_CONFIG_RULES':
                continue
            
            # Filter by active status if requested
            if active_only and not stage['is_active']:
                continue
            
            # Use sequence from junction table
            stage['sequence_number'] = row['sequence_number']
            
            stages.append(StageResponse(**stage))
        
        return stages
    
    @staticmethod
    async def get_stage_by_id(stage_id: str) -> StageResponse:
        """Get a specific stage by ID"""
        db = get_db()
        
        result = db.table('wip_stages').select('*').eq('id', stage_id).execute()
        
        if not result.data:
            raise Exception(f"Stage {stage_id} not found")
        
        return StageResponse(**result.data[0])
    
    @staticmethod
    async def create_stage(stage_data: StageCreate, config_id: str = 'default') -> StageResponse:
        """Create a new WIP stage and assign to configuration"""
        db = get_db()
        
        # Check if code already exists
        existing = db.table('wip_stages').select('id').eq('code', stage_data.code).execute()
        if existing.data:
            raise Exception(f"Stage with code '{stage_data.code}' already exists")
        
        insert_data = stage_data.model_dump(mode="json")
        
        # FIX: Ensure a globally unique sequence number for the wip_stages table to satisfy unique constraint.
        # This global sequence is just a placeholder; config_stages handles the actual sequencing.
        global_max_res = (
            db.table('wip_stages')
            .select('sequence_number')
            .order('sequence_number', desc=True)
            .limit(1)
            .execute()
        )
        
        global_next_seq = 1000  # Start high to avoid any initial overlap
        if global_max_res.data:
            global_next_seq = global_max_res.data[0]['sequence_number'] + 1
            
        insert_data['sequence_number'] = global_next_seq
        
        # Create the stage
        result = db.table('wip_stages').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create stage")
        
        stage = result.data[0]
        
        # Assign to configuration via junction table
        # Get next sequence number for this specific config
        max_seq_result = (
            db.table('config_stages')
            .select('sequence_number')
            .eq('config_id', config_id)
            .order('sequence_number', desc=True)
            .limit(1)
            .execute()
        )
        
        next_seq = 1
        if max_seq_result.data:
            next_seq = max_seq_result.data[0]['sequence_number'] + 1
        
        # Insert into junction table
        db.table('config_stages').insert({
            'config_id': config_id,
            'stage_id': stage['id'],
            'sequence_number': next_seq
        }).execute()
        
        # Return with junction table sequence
        stage['sequence_number'] = next_seq
        
        return StageResponse(**stage)
    
    @staticmethod
    async def update_stage(stage_id: str, stage_data: StageUpdate) -> StageResponse:
        """Update a WIP stage"""
        db = get_db()
        
        update_data = {
            k: v
            for k, v in stage_data.model_dump(exclude_unset=True, mode="json").items()
            if v is not None
        }
        
        if not update_data:
            return await StageService.get_stage_by_id(stage_id)
        
        # If updating code, check for duplicates
        if 'code' in update_data:
            check = db.table('wip_stages').select('id').eq('code', update_data['code']).neq('id', stage_id).execute()
            if check.data:
                raise Exception(f"Stage code exists")

        result = db.table('wip_stages').update(update_data).eq('id', stage_id).execute()
        
        if not result.data:
            raise Exception("Stage not found")
        
        return StageResponse(**result.data[0])
    
    @staticmethod
    async def delete_stage(stage_id: str, force: bool = False) -> dict:
        """Delete a stage (removes from all configurations)"""
        db = get_db()
        
        if force:
            try:
                # Delete from junction tables first (CASCADE will handle this, but explicit is better)
                db.table('config_stages').delete().eq('stage_id', stage_id).execute()
                
                # Delete the stage itself
                res = db.table('wip_stages').delete().eq('id', stage_id).execute()
                if not res.data:
                    raise Exception("Stage not found/deleted")
                return {"message": "Deleted"}
            except Exception as e:
                raise Exception(f"Cannot delete stage: {str(e)}")
        else:
            # Soft delete - just deactivate
            db.table('wip_stages').update({'is_active': False}).eq('id', stage_id).execute()
            return {"message": "Deactivated"}



    @staticmethod
    async def reorder_stages(stage_orders: List[dict]) -> List[StageResponse]:
        """Reorder stages within a configuration using junction table"""
        db = get_db()
        if not stage_orders: return []
        
        # Get config_id from first stage's junction table entry
        first_junction = (
            db.table('config_stages')
            .select('config_id')
            .eq('stage_id', stage_orders[0]['stage_id'])
            .limit(1)
            .execute()
        )
        
        if not first_junction.data:
            raise Exception("Stage not assigned to any configuration")
        
        config_id = first_junction.data[0]['config_id']
        
        # Update sequence numbers in junction table
        # Use temp sequence to avoid unique constraint violations
        temp_base = 10000
        
        # Pass 1: Set to temp values
        for order in stage_orders:
            db.table('config_stages').update({
                'sequence_number': order['sequence_number'] + temp_base
            }).eq('config_id', config_id).eq('stage_id', order['stage_id']).execute()
        
        # Pass 2: Set to final values
        for order in stage_orders:
            db.table('config_stages').update({
                'sequence_number': order['sequence_number']
            }).eq('config_id', config_id).eq('stage_id', order['stage_id']).execute()
        
        return await StageService.list_stages(active_only=False, config_id=config_id)

    @staticmethod
    async def assign_stage_to_config(config_id: str, stage_id: str, sequence_number: Optional[int] = None) -> dict:
        """Assign an existing stage to a configuration"""
        db = get_db()
        
        # Verify stage exists
        stage_check = db.table('wip_stages').select('id').eq('id', stage_id).execute()
        if not stage_check.data:
            raise Exception(f"Stage {stage_id} not found")
        
        # Check if already assigned
        existing = (
            db.table('config_stages')
            .select('id')
            .eq('config_id', config_id)
            .eq('stage_id', stage_id)
            .execute()
        )
        
        if existing.data:
            raise Exception(f"Stage already assigned to {config_id}")
        
        # Get next sequence if not provided
        if sequence_number is None:
            max_seq_result = (
                db.table('config_stages')
                .select('sequence_number')
                .eq('config_id', config_id)
                .order('sequence_number', desc=True)
                .limit(1)
                .execute()
            )
            sequence_number = 1
            if max_seq_result.data:
                sequence_number = max_seq_result.data[0]['sequence_number'] + 1
        
        # Insert into junction table
        db.table('config_stages').insert({
            'config_id': config_id,
            'stage_id': stage_id,
            'sequence_number': sequence_number
        }).execute()
        
        return {"message": f"Stage assigned to {config_id}", "sequence_number": sequence_number}

    @staticmethod
    async def remove_stage_from_config(config_id: str, stage_id: str) -> dict:
        """Remove a stage from a configuration (doesn't delete the stage itself)"""
        db = get_db()
        
        result = (
            db.table('config_stages')
            .delete()
            .eq('config_id', config_id)
            .eq('stage_id', stage_id)
            .execute()
        )
        
        if not result.data:
            raise Exception(f"Stage not assigned to {config_id}")
        
        return {"message": f"Stage removed from {config_id}"}

    # ============================================
    # CONFIG ASSIGNMENT HELPER
    # ============================================

    @staticmethod
    async def _get_raw_stage(stage_id: str) -> dict:
        db = get_db()
        res = db.table('wip_stages').select('*').eq('id', stage_id).single().execute()
        if not res.data:
            raise Exception("Stage not found")
        return res.data

    # ============================================
    # ASSIGNMENT LOGIC
    # ============================================

    @staticmethod
    async def get_assignments() -> dict:
        """Get assignments from hidden stage"""
        db = get_db()
        res = db.table('wip_stages').select('description').eq('code', 'SYSTEM_CONFIG_RULES').execute()
        if res.data:
            import json
            try:
                return json.loads(res.data[0]['description'])
            except:
                pass
        return {"sku_assignments": {}, "wo_assignments": {}}

    @staticmethod
    async def save_assignments(assignments: dict) -> None:
        """Save assignments to hidden stage"""
        db = get_db()
        import json
        payload = json.dumps(assignments)
        
        existing = db.table('wip_stages').select('id').eq('code', 'SYSTEM_CONFIG_RULES').execute()
        if existing.data:
            db.table('wip_stages').update({'description': payload}).eq('id', existing.data[0]['id']).execute()
        else:
            # Create hidden stage
            db.table('wip_stages').insert({
                'name': 'SYSTEM_CONFIG_RULES',
                'code': 'SYSTEM_CONFIG_RULES',
                'sequence_number': 9999,
                'target_avg_time_minutes': 0,
                'is_active': False,
                'description': payload,
                'color': '#000000'
            }).execute()

    @staticmethod
    async def resolve_config_for_entity(sku: Optional[str], wo_no: Optional[str]) -> str:
        """Resolve config ID based on rules"""
        assignments = await StageService.get_assignments()
        
        if wo_no:
            wo_clean = wo_no.strip()
            if wo_clean in assignments.get('wo_assignments', {}):
                return assignments['wo_assignments'][wo_clean]
            
        # Priority 2: SKU
        if sku:
            sku_clean = sku.strip()
            if sku_clean in assignments.get('sku_assignments', {}):
                return assignments['sku_assignments'][sku_clean]
            
        return 'default'
    
    # ============================================
    # PRODUCT-STAGE ASSIGNMENTS
    # ============================================
    
    @staticmethod
    async def get_product_stages(product_id: str) -> ProductStagesResponse:
        """
        Get stages configured for a product
        Uses database function that returns product-specific stages or defaults
        """
        db = get_db()
        
        # Get product name
        product_result = db.table('products').select('name').eq('id', product_id).execute()
        product_name = product_result.data[0]['name'] if product_result.data else None
        
        # Call database function to get stages? NO, we override with new config logic.
        
        # 1. Check for custom legacy assignments
        custom_stages_res = (
            db.table('product_stages')
            .select('*, wip_stages(name, code, color, icon, description, target_avg_time_minutes, is_active)')
            .eq('product_id', product_id)
            .order('sequence_number')
            .execute()
        )
        
        stages = []
        if custom_stages_res.data:
            # Map custom assignments
            for row in custom_stages_res.data:
                stage_info = row['wip_stages']
                # Merge overrides
                stages.append(ProductStageDetail(
                    id=row['stage_id'],
                    name=stage_info['name'],
                    code=stage_info['code'],
                    sequence_number=row['sequence_number'],
                    target_avg_time_minutes=stage_info['target_avg_time_minutes'],
                    color=stage_info['color'],
                    icon=stage_info['icon'],
                    description=StageService._extract_description_text(stage_info.get('description')),
                    is_required=row['is_required'],
                    is_active=stage_info['is_active']
                ))
        else:
            # 2. Use New Config Logic
            # Get product Code for resolution
            prod_res = db.table('products').select('code').eq('id', product_id).single().execute()
            sku = prod_res.data['code'] if prod_res.data else None
            
            config_id = await StageService.resolve_config_for_entity(sku=sku, wo_no=None)
            config_stages = await StageService.list_stages(config_id=config_id)
            
            # Map Response -> ProductDetail
            for s in config_stages:
                stages.append(ProductStageDetail(
                    id=s.id,
                    name=s.name,
                    code=s.code,
                    sequence_number=s.sequence_number,
                    target_avg_time_minutes=s.target_avg_time_minutes,
                    color=s.color,
                    icon=s.icon,
                    description=s.description,
                    is_required=True,
                    is_active=s.is_active
                ))

        # Calculate total estimated time
        total_time = sum(stage.target_avg_time_minutes for stage in stages)
        
        return ProductStagesResponse(
            product_id=product_id,
            product_name=product_name,
            stages=stages,
            total_estimated_time=total_time
        )
    
    @staticmethod
    async def assign_stages_to_product(assignment: BulkStageAssignment) -> ProductStagesResponse:
        """
        Assign stages to a product (replaces existing assignments)
        
        Args:
            assignment: BulkStageAssignment with product_id and list of stages
        
        Returns:
            Updated product stages configuration
        """
        db = get_db()
        
        # Validate product exists
        product_check = db.table('products').select('id').eq('id', assignment.product_id).execute()
        if not product_check.data:
            raise Exception(f"Product {assignment.product_id} not found")
        
        # Validate all stages exist and are active
        for stage_assignment in assignment.stages:
            stage_check = (
                db.table('wip_stages')
                .select('id, is_active')
                .eq('id', stage_assignment.stage_id)
                .execute()
            )
            if not stage_check.data:
                raise Exception(f"Stage {stage_assignment.stage_id} not found")
            if not stage_check.data[0]['is_active']:
                raise Exception(f"Cannot assign inactive stage {stage_assignment.stage_id}")
        
        # Delete existing assignments for this product
        db.table('product_stages').delete().eq('product_id', assignment.product_id).execute()
        
        # Insert new assignments
        if assignment.stages:
            insert_data = [
                {
                    'product_id': assignment.product_id,
                    'stage_id': stage.stage_id,
                    'sequence_number': stage.sequence_number,
                    'is_required': stage.is_required,
                    'estimated_time_minutes': stage.estimated_time_minutes,
                    'notes': stage.notes
                }
                for stage in assignment.stages
            ]
            
            db.table('product_stages').insert(insert_data).execute()
        
        # Return updated configuration
        return await StageService.get_product_stages(assignment.product_id)
    
    @staticmethod
    async def remove_product_stages(product_id: str) -> dict:
        """
        Remove all stage assignments for a product (reverts to default stages)
        """
        db = get_db()
        
        result = db.table('product_stages').delete().eq('product_id', product_id).execute()
        
        return {
            "message": f"Removed stage assignments for product {product_id}. Product will now use default stages."
        }
    
    @staticmethod
    async def get_products_using_stage(stage_id: str) -> List[dict]:
        """Get list of products that use a specific stage"""
        db = get_db()
        
        result = (
            db.table('product_stages')
            .select('product_id, products(id, code, name)')
            .eq('stage_id', stage_id)
            .execute()
        )
        
        products = []
        for row in result.data:
            if row.get('products'):
                products.append(row['products'])
        
        return products


# Create singleton instance
stage_service = StageService()
