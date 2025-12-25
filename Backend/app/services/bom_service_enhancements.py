"""
BOM Service Enhancements - Sub-Assembly Support
Add these methods to the existing BOMService class
"""

from typing import List, Dict, Optional
from decimal import Decimal
from app.database import get_db
from app.core.exceptions import ValidationException, NotFoundException

class BOMServiceEnhancements:
    """
    Additional methods for BOM service to support multi-level BOMs (sub-assemblies)
    These should be added to the existing BOMService class
    """
    
    @staticmethod
    async def add_sub_assembly_to_bom(
        bom_id: str,
        sub_assembly_product_id: str,
        quantity: Decimal,
        unit: str,
        scrap_percentage: Decimal = Decimal('0'),
        sequence_number: Optional[int] = None,
        user_id: str = None
    ) -> Dict:
        """
        Add a sub-assembly (another BOM) as a material to a BOM.
        
        Args:
            bom_id: Parent BOM ID
            sub_assembly_product_id: Product ID of the sub-assembly
            quantity: Quantity of sub-assembly needed per unit
            unit: Unit of measure
            scrap_percentage: Scrap percentage for this sub-assembly
            sequence_number: Optional sequence number
            user_id: User performing the action
        
        Returns:
            Created BOM material record
        """
        db = get_db()
        
        # Validate parent BOM exists
        parent_bom = db.table('boms').select('id', 'product_id').eq('id', bom_id).execute()
        if not parent_bom.data:
            raise NotFoundException(detail="Parent BOM not found")
        
        # Get sub-assembly BOM
        sub_bom = db.table('boms').select('id', 'product_id', 'is_active').eq(
            'product_id', sub_assembly_product_id
        ).eq('is_active', True).execute()
        
        if not sub_bom.data:
            raise ValidationException(
                detail=f"No active BOM found for sub-assembly product. Create a BOM for product {sub_assembly_product_id} first."
            )
        
        sub_bom_id = sub_bom.data[0]['id']
        
        # Check for circular reference
        if await BOMServiceEnhancements._check_circular_reference(bom_id, sub_bom_id):
            raise ValidationException(
                detail="Circular reference detected. This sub-assembly contains the parent BOM in its hierarchy."
            )
        
        # Get next sequence number if not provided
        if sequence_number is None:
            existing = db.table('bom_materials').select('sequence_number').eq('bom_id', bom_id).execute()
            sequence_number = max([m.get('sequence_number', 0) for m in existing.data], default=0) + 1
        
        # Add sub-assembly as material
        material_dict = {
            'bom_id': bom_id,
            'material_id': sub_assembly_product_id,
            'quantity': float(quantity),
            'unit': unit,
            'scrap_percentage': float(scrap_percentage),
            'sequence_number': sequence_number,
            'is_sub_assembly': True,
            'sub_assembly_bom_id': sub_bom_id,
            'level': 1  # Will be recalculated if nested deeper
        }
        
        result = db.table('bom_materials').insert(material_dict).execute()
        
        # Update sub-assembly BOM to mark it as used in assemblies
        db.table('boms').update({
            'is_sub_assembly': True
        }).eq('id', sub_bom_id).execute()
        
        # Recalculate hierarchy levels
        await BOMServiceEnhancements._recalculate_hierarchy_levels(bom_id)
        
        return result.data[0] if result.data else material_dict
    
    @staticmethod
    async def _check_circular_reference(parent_bom_id: str, child_bom_id: str) -> bool:
        """
        Check if adding child_bom_id to parent_bom_id would create a circular reference.
        
        Returns True if circular reference detected, False otherwise.
        """
        db = get_db()
        
        # Get all sub-assemblies in the child BOM hierarchy
        visited = set()
        to_check = [child_bom_id]
        
        while to_check:
            current_bom_id = to_check.pop(0)
            
            if current_bom_id in visited:
                continue
            
            visited.add(current_bom_id)
            
            # If we find the parent in the child's hierarchy, it's circular
            if current_bom_id == parent_bom_id:
                return True
            
            # Get sub-assemblies of current BOM
            materials = db.table('bom_materials').select('sub_assembly_bom_id').eq(
                'bom_id', current_bom_id
            ).eq('is_sub_assembly', True).execute()
            
            for mat in materials.data:
                sub_bom_id = mat.get('sub_assembly_bom_id')
                if sub_bom_id and sub_bom_id not in visited:
                    to_check.append(sub_bom_id)
        
        return False
    
    @staticmethod
    async def _recalculate_hierarchy_levels(bom_id: str):
        """
        Recalculate hierarchy levels for all materials in a BOM tree.
        """
        db = get_db()
        
        # Recursive function to set levels
        async def set_levels(current_bom_id: str, current_level: int = 0):
            materials = db.table('bom_materials').select('*').eq('bom_id', current_bom_id).execute()
            
            for mat in materials.data:
                # Update level
                db.table('bom_materials').update({
                    'level': current_level
                }).eq('id', mat['id']).execute()
                
                # Recursively process sub-assemblies
                if mat.get('is_sub_assembly') and mat.get('sub_assembly_bom_id'):
                    await set_levels(mat['sub_assembly_bom_id'], current_level + 1)
        
        await set_levels(bom_id, 0)
    
    @staticmethod
    async def get_exploded_bom(bom_id: str) -> List[Dict]:
        """
        Get exploded BOM - all materials at all levels flattened with total quantities.
        
        Returns a list of materials with calculated total quantities considering all sub-assembly levels.
        """
        db = get_db()
        
        # Validate BOM exists
        bom = db.table('boms').select('id', 'batch_size').eq('id', bom_id).execute()
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        batch_size = Decimal(str(bom.data[0].get('batch_size', 100)))
        
        # Recursive function to explode BOM
        async def explode_level(current_bom_id: str, multiplier: Decimal = Decimal('1')) -> List[Dict]:
            materials = db.table('bom_materials').select('*').eq('bom_id', current_bom_id).execute()
            
            result = []
            
            for mat in materials.data:
                quantity = Decimal(str(mat['quantity'])) * multiplier
                scrap_pct = Decimal(str(mat.get('scrap_percentage', 0)))
                total_qty = quantity * (1 + scrap_pct / 100)
                
                if mat.get('is_sub_assembly') and mat.get('sub_assembly_bom_id'):
                    # Recursively explode sub-assembly
                    sub_materials = await explode_level(mat['sub_assembly_bom_id'], total_qty)
                    result.extend(sub_materials)
                else:
                    # Get product details
                    product = db.table('products').select('code', 'name').eq('id', mat['material_id']).execute()
                    
                    result.append({
                        'material_id': mat['material_id'],
                        'material_code': product.data[0]['code'] if product.data else '',
                        'material_name': product.data[0]['name'] if product.data else '',
                        'quantity_per_unit': float(quantity),
                        'total_quantity': float(total_qty),
                        'unit': mat['unit'],
                        'scrap_percentage': float(scrap_pct),
                        'unit_cost': float(mat.get('unit_cost', 0)),
                        'total_cost': float(total_qty * Decimal(str(mat.get('unit_cost', 0)))),
                        'level': mat.get('level', 0)
                    })
            
            return result
        
        exploded = await explode_level(bom_id)
        
        # Consolidate duplicate materials
        consolidated = {}
        for mat in exploded:
            mat_id = mat['material_id']
            if mat_id in consolidated:
                consolidated[mat_id]['total_quantity'] += mat['total_quantity']
                consolidated[mat_id]['total_cost'] += mat['total_cost']
            else:
                consolidated[mat_id] = mat
        
        return list(consolidated.values())
    
    @staticmethod
    async def get_bom_hierarchy(bom_id: str) -> Dict:
        """
        Get BOM hierarchy tree structure for display.
        
        Returns nested structure showing all levels of the BOM.
        """
        db = get_db()
        
        # Get BOM details
        bom = db.table('boms').select('*').eq('id', bom_id).execute()
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        bom_data = bom.data[0]
        
        # Get product details
        product = db.table('products').select('code', 'name').eq('id', bom_data['product_id']).execute()
        
        # Recursive function to build tree
        async def build_tree(current_bom_id: str, level: int = 0) -> Dict:
            materials = db.table('bom_materials').select('*').eq('bom_id', current_bom_id).order('sequence_number').execute()
            
            material_list = []
            
            for mat in materials.data:
                # Get material product details
                mat_product = db.table('products').select('code', 'name').eq('id', mat['material_id']).execute()
                
                material_dict = {
                    'id': mat['id'],
                    'material_id': mat['material_id'],
                    'material_code': mat_product.data[0]['code'] if mat_product.data else '',
                    'material_name': mat_product.data[0]['name'] if mat_product.data else '',
                    'quantity': float(mat['quantity']),
                    'unit': mat['unit'],
                    'scrap_percentage': float(mat.get('scrap_percentage', 0)),
                    'unit_cost': float(mat.get('unit_cost', 0)),
                    'is_sub_assembly': mat.get('is_sub_assembly', False),
                    'level': level
                }
                
                # Recursively add sub-assembly children
                if mat.get('is_sub_assembly') and mat.get('sub_assembly_bom_id'):
                    material_dict['children'] = await build_tree(mat['sub_assembly_bom_id'], level + 1)
                
                material_list.append(material_dict)
            
            return material_list
        
        hierarchy = {
            'bom_id': bom_id,
            'product_id': bom_data['product_id'],
            'product_code': product.data[0]['code'] if product.data else '',
            'product_name': product.data[0]['name'] if product.data else '',
            'version': bom_data.get('version', 1),
            'batch_size': float(bom_data.get('batch_size', 100)),
            'materials': await build_tree(bom_id, 0)
        }
        
        return hierarchy
    
    @staticmethod
    async def calculate_total_cost_with_subassemblies(bom_id: str) -> Decimal:
        """
        Calculate total material cost including all sub-assembly levels.
        """
        exploded = await BOMServiceEnhancements.get_exploded_bom(bom_id)
        total_cost = sum(Decimal(str(mat['total_cost'])) for mat in exploded)
        return total_cost
