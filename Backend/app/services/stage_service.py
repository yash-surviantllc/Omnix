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
    async def list_stages(active_only: bool = True) -> List[StageResponse]:
        """List all WIP stages"""
        db = get_db()
        
        query = db.table('wip_stages').select('*').order('sequence_number')
        
        if active_only:
            query = query.eq('is_active', True)
        
        result = query.execute()
        
        return [StageResponse(**stage) for stage in result.data]
    
    @staticmethod
    async def get_stage_by_id(stage_id: str) -> StageResponse:
        """Get a specific stage by ID"""
        db = get_db()
        
        result = db.table('wip_stages').select('*').eq('id', stage_id).execute()
        
        if not result.data:
            raise Exception(f"Stage {stage_id} not found")
        
        return StageResponse(**result.data[0])
    
    @staticmethod
    async def create_stage(stage_data: StageCreate) -> StageResponse:
        """Create a new WIP stage"""
        db = get_db()
        
        # Check if code already exists
        existing = db.table('wip_stages').select('id').eq('code', stage_data.code).execute()
        if existing.data:
            raise Exception(f"Stage with code '{stage_data.code}' already exists")
        
        insert_data = stage_data.model_dump(mode="json")
        result = db.table('wip_stages').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create stage")
        
        return StageResponse(**result.data[0])
    
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
            existing = (
                db.table('wip_stages')
                .select('id')
                .eq('code', update_data['code'])
                .neq('id', stage_id)
                .execute()
            )
            if existing.data:
                raise Exception(f"Stage with code '{update_data['code']}' already exists")
        
        result = db.table('wip_stages').update(update_data).eq('id', stage_id).execute()
        
        if not result.data:
            raise Exception(f"Stage {stage_id} not found")
        
        return StageResponse(**result.data[0])
    
    @staticmethod
    async def delete_stage(stage_id: str, force: bool = False) -> dict:
        """
        Delete a stage (soft delete by default)
        
        Args:
            stage_id: ID of the stage to delete
            force: If True, attempts hard delete (will fail if stage is in use due to trigger)
        
        Returns:
            Success message
        """
        db = get_db()
        
        # Get the sequence number of the stage being deleted (for resequencing)
        stage_to_delete = db.table('wip_stages').select('sequence_number').eq('id', stage_id).execute()
        if not stage_to_delete.data:
            raise Exception(f"Stage {stage_id} not found")
        
        deleted_sequence = stage_to_delete.data[0]['sequence_number']
        
        if force:
            # Attempt hard delete (will be blocked by trigger if in use)
            try:
                result = db.table('wip_stages').delete().eq('id', stage_id).execute()
                if not result.data:
                    raise Exception(f"Stage {stage_id} not found")
                
                # Auto-resequence remaining stages
                await StageService._resequence_stages(deleted_sequence)
                
                return {"message": "Stage deleted successfully"}
            except Exception as e:
                if "is currently assigned" in str(e):
                    raise Exception(
                        "Cannot delete stage as it is in use. "
                        "Please remove all product assignments and complete active work orders first, "
                        "or use soft delete instead."
                    )
                raise
        else:
            # Soft delete (set is_active = False)
            result = db.table('wip_stages').update({'is_active': False}).eq('id', stage_id).execute()
            
            if not result.data:
                raise Exception(f"Stage {stage_id} not found")
            
            # Auto-resequence remaining ACTIVE stages
            await StageService._resequence_stages(deleted_sequence, active_only=True)
            
            return {"message": "Stage deactivated successfully"}
    
    @staticmethod
    async def _resequence_stages(deleted_sequence: int, active_only: bool = False):
        """
        Resequence stages after deletion to maintain sequential order without gaps
        
        Args:
            deleted_sequence: The sequence number of the deleted stage
            active_only: If True, only resequence active stages (for soft delete)
        """
        db = get_db()
        
        # Get all remaining stages ordered by sequence number
        query = db.table('wip_stages').select('id', 'sequence_number').order('sequence_number')
        
        if active_only:
            query = query.eq('is_active', True)
        
        remaining_stages = query.execute()
        
        # Renumber stages sequentially starting from 1
        for idx, stage in enumerate(remaining_stages.data, start=1):
            if stage['sequence_number'] != idx:
                db.table('wip_stages').update({
                    'sequence_number': idx
                }).eq('id', stage['id']).execute()
    
    @staticmethod
    async def get_stage_usage(stage_id: str) -> StageUsageStats:
        """Get usage statistics for a stage"""
        db = get_db()
        
        result = db.table('vw_stage_usage').select('*').eq('id', stage_id).execute()
        
        if not result.data:
            raise Exception(f"Stage {stage_id} not found")
        
        return StageUsageStats(**result.data[0])
    
    @staticmethod
    async def reorder_stages(stage_orders: List[dict]) -> List[StageResponse]:
        """
        Reorder stages by updating sequence numbers
        
        Args:
            stage_orders: List of {stage_id: str, sequence_number: int}
        
        Returns:
            Updated list of stages
        """
        db = get_db()
        
        # Update each stage's sequence number
        for order in stage_orders:
            db.table('wip_stages').update({
                'sequence_number': order['sequence_number']
            }).eq('id', order['stage_id']).execute()
        
        # Return updated list
        return await StageService.list_stages(active_only=False)
    
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
        
        # Call database function to get stages
        result = db.rpc('get_product_stages', {'p_product_id': product_id}).execute()
        
        stages = [ProductStageDetail(**stage) for stage in result.data]
        
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
