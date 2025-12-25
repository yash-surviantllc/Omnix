from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
import json
from app.database import get_db
from app.schemas.bom import (
    BOMCreate, 
    BOMUpdate, 
    BOMResponse, 
    BOMListItem, 
    BOMMaterialResponse,
    BOMCalculation, 
    BOMVersion, 
    BOMDuplicateRequest, 
    BOMValidationResult,
    BOMMaterialCreate,
    MaterialShortageDetail,
    ShortageCalculationRequest,
    BOMShortageCalculation,
    BOMMaterialWithShortage,
    BOMCreateWithProduct
)
from app.core.exceptions import NotFoundException, ValidationException


class BOMService:
    
    @staticmethod
    async def create_bom_with_product(bom_data: BOMCreateWithProduct, user_id: str) -> BOMResponse:
        """
        Create a new BOM with product creation.
        Creates finished goods product first, then creates BOM with materials from inventory.
        """
        db = get_db()
        
        # 1. Create finished goods product
        product_dict = {
            'code': bom_data.product_code,
            'name': bom_data.product_name,
            'category': 'Finished Goods',
            'unit': 'pcs',  # Default unit for finished goods
            'is_active': True,
            'created_by': user_id
        }
        
        product_result = db.table('products').insert(product_dict).execute()
        if not product_result.data:
            raise Exception("Failed to create product")
        
        created_product = product_result.data[0]
        product_id = created_product['id']
        
        # 2. Get inventory items for materials
        inventory_items = {}
        for material in bom_data.materials:
            item_code = material.get('itemCode')
            if item_code:
                item = db.table('inventory_items').select('id', 'material_code', 'material_name', 'unit', 'unit_cost').eq(
                    'material_code', item_code
                ).execute()
                if item.data:
                    inventory_items[item_code] = item.data[0]
        
        # 3. Create BOM header
        bom_dict = {
            'product_id': product_id,
            'batch_size': float(bom_data.batch_size),
            'version': 1,
            'is_active': True,
            'is_template': False,
            'effective_date': date.today().isoformat(),
            'notes': bom_data.notes,
            'created_by': user_id
        }
        
        bom_result = db.table('boms').insert(bom_dict).execute()
        if not bom_result.data:
            raise Exception("Failed to create BOM")
        
        created_bom = bom_result.data[0]
        
        # 4. Create BOM materials (linking to inventory_items via products table)
        # Note: We need to create product entries for inventory items if they don't exist
        for idx, material in enumerate(bom_data.materials, start=1):
            item_code = material.get('itemCode')
            qty = material.get('qty', 0)
            unit = material.get('unit', 'kg')
            unit_cost = material.get('unitCost', 0)
            
            if not item_code or not qty:
                continue
            
            # Get or create product for this inventory item
            inv_item = inventory_items.get(item_code)
            if inv_item:
                # Check if product exists for this inventory item
                product_check = db.table('products').select('id').eq('code', item_code).execute()
                
                if product_check.data:
                    material_product_id = product_check.data[0]['id']
                else:
                    # Create product for inventory item
                    mat_product_dict = {
                        'code': item_code,
                        'name': inv_item['material_name'],
                        'category': 'Raw Material',
                        'unit': inv_item['unit'],
                        'is_active': True,
                        'created_by': user_id
                    }
                    mat_product_result = db.table('products').insert(mat_product_dict).execute()
                    material_product_id = mat_product_result.data[0]['id']
                
                # Create BOM material entry
                material_dict = {
                    'bom_id': created_bom['id'],
                    'material_id': material_product_id,
                    'quantity': float(qty),
                    'unit': unit,
                    'unit_cost': float(unit_cost) if unit_cost else 0,
                    'scrap_percentage': 0,
                    'sequence_number': idx
                }
                
                db.table('bom_materials').insert(material_dict).execute()
        
        # 5. Return the created BOM
        return await BOMService.get_bom_by_id(created_bom['id'])
    
    @staticmethod
    async def create_bom(bom_data: BOMCreate, user_id: str) -> BOMResponse:
        """
        Create a new BOM with materials.
        Automatically sets version 1 and creates version snapshot.
        """
        db = get_db()
        
        # Validate product exists and is finished goods
        product = db.table('products').select('id', 'category').eq('id', bom_data.product_id).execute()
        if not product.data:
            raise NotFoundException(detail="Product not found")
        if product.data[0].get('category') != 'Finished Goods':
            raise ValidationException(detail="BOM can only be created for finished goods")
        
        # Check if active BOM already exists for this product
        existing = db.table('boms').select('id').eq('product_id', bom_data.product_id).eq('is_active', True).execute()
        if existing.data and not bom_data.is_template:
            raise ValidationException(detail="Active BOM already exists for this product. Use update instead.")
        
        # Validate all materials exist and are raw materials
        for material in bom_data.materials:
            mat = db.table('products').select('id', 'category').eq('id', material.material_id).execute()
            if not mat.data:
                raise ValidationException(detail=f"Material {material.material_id} not found")
            if mat.data[0].get('category') != 'Raw Material':
                raise ValidationException(detail=f"Product {material.material_id} is not a raw material")
        
        # Create BOM header
        bom_dict = {
            'product_id': bom_data.product_id,
            'batch_size': float(bom_data.batch_size),
            'version': 1,
            'is_active': not bom_data.is_template,  # Templates are inactive by default
            'is_template': bom_data.is_template,
            'template_name': bom_data.template_name if bom_data.is_template else None,
            'effective_date': date.today().isoformat(),
            'notes': bom_data.notes,
            'created_by': user_id
        }
        
        bom_result = db.table('boms').insert(bom_dict).execute()
        
        if not bom_result.data:
            raise Exception("Failed to create BOM")
        
        created_bom = bom_result.data[0]
        
        # Create BOM materials
        materials_snapshot = []
        for idx, material in enumerate(bom_data.materials, start=1):
            material_dict = {
                'bom_id': created_bom['id'],
                'material_id': material.material_id,
                'quantity': float(material.quantity),
                'unit': material.unit,
                'scrap_percentage': float(material.scrap_percentage),
                'unit_cost': float(material.unit_cost),
                'sequence_number': material.sequence_number or idx
            }
            
            mat_result = db.table('bom_materials').insert(material_dict).execute()
            materials_snapshot.append(mat_result.data[0] if mat_result.data else material_dict)
        
        # Create version snapshot
        await BOMService._create_version_snapshot(
            bom_id=created_bom['id'],
            version=1,
            user_id=user_id,
            notes="Initial version"
        )
        
        # Return complete BOM
        return await BOMService.get_bom_by_id(created_bom['id'])
    
    @staticmethod
    async def _create_version_snapshot(
        bom_id: str,
        version: int,
        user_id: str,
        notes: Optional[str] = None
    ):
        """Create a version snapshot for BOM history."""
        db = get_db()
        
        # Get current BOM state
        bom = db.table('boms').select('*').eq('id', bom_id).execute()
        materials = db.table('bom_materials').select('*').eq('bom_id', bom_id).execute()
        
        snapshot = {
            'bom': bom.data[0] if bom.data else {},
            'materials': materials.data if materials.data else []
        }
        
        # Create version record
        db.table('bom_versions').insert({
            'bom_id': bom_id,
            'version': version,
            'effective_date': date.today().isoformat(),
            'created_by': user_id,
            'notes': notes,
            'snapshot': json.dumps(snapshot)
        }).execute()
    
    @staticmethod
    async def list_boms(
        page: int = 1,
        limit: int = 20,
        product_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_template: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[BOMListItem]:
        """List BOMs with pagination and filters."""
        db = get_db()
        
        offset = (page - 1) * limit
        
        # Build query
        query = db.table('boms').select('*')
        
        if product_id:
            query = query.eq('product_id', product_id)
        
        if is_active is not None:
            query = query.eq('is_active', is_active)
        
        if is_template is not None:
            query = query.eq('is_template', is_template)
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        boms = []
        for bom in result.data:
            # Get product info
            product = db.table('products').select('code', 'name').eq('id', bom['product_id']).execute()
            
            if not product.data:
                continue
            
            # Count materials
            materials_count_result = db.table('bom_materials').select('id', count='exact').eq('bom_id', bom['id']).execute()
            materials_count = materials_count_result.count if hasattr(materials_count_result, 'count') else 0
            
            # Calculate total cost WITH SCRAP
            materials = db.table('bom_materials').select('quantity', 'unit_cost', 'scrap_percentage').eq('bom_id', bom['id']).execute()
            total_cost = Decimal('0')
            for m in materials.data:
                qty = Decimal(str(m['quantity']))
                cost = Decimal(str(m['unit_cost']))
                scrap = Decimal(str(m.get('scrap_percentage', 0)))
                total_cost += qty * cost * (1 + scrap / 100)
            
            # Apply search filter
            if search:
                product_code = product.data[0]['code'].lower()
                product_name = product.data[0]['name'].lower()
                search_lower = search.lower()
                
                if search_lower not in product_code and search_lower not in product_name:
                    continue
            
            boms.append(BOMListItem(
                id=bom['id'],
                product_id=bom['product_id'],
                product_code=product.data[0]['code'],
                product_name=product.data[0]['name'],
                version=bom.get('version', 1),
                batch_size=Decimal(str(bom.get('batch_size', 100))),
                is_active=bom['is_active'],
                is_template=bom.get('is_template', False),
                template_name=bom.get('template_name'),
                materials_count=materials_count,
                total_cost=total_cost,
                effective_date=bom.get('effective_date', bom['created_at']),
                created_at=datetime.fromisoformat(bom['created_at'].replace('Z', '+00:00'))
            ))
        
        return boms
    
    @staticmethod
    async def get_bom_by_id(bom_id: str) -> BOMResponse:
        """Get BOM by ID with all materials."""
        db = get_db()
        
        # Get BOM header
        bom_result = db.table('boms').select('*').eq('id', bom_id).execute()
        
        if not bom_result.data:
            raise NotFoundException(detail="BOM not found")
        
        bom = bom_result.data[0]
        
        # Get product info
        product = db.table('products').select('code', 'name').eq('id', bom['product_id']).execute()
        product_code = product.data[0]['code'] if product.data else None
        product_name = product.data[0]['name'] if product.data else None
        
        # Get BOM materials with details
        materials_result = db.table('bom_materials').select('*').eq('bom_id', bom_id).order('sequence_number').execute()
        
        materials = []
        total_bom_cost = Decimal('0')
        
        for mat in materials_result.data:
            # Get material product info
            mat_product = db.table('products').select('code', 'name').eq('id', mat['material_id']).execute()
            
            quantity = Decimal(str(mat['quantity']))
            unit_cost = Decimal(str(mat['unit_cost']))
            scrap_pct = Decimal(str(mat.get('scrap_percentage', 0)))
            
            # Calculate total cost WITH SCRAP
            total_cost = quantity * unit_cost * (1 + scrap_pct / 100)
            total_bom_cost += total_cost
            
            materials.append(BOMMaterialResponse(
                id=mat['id'],
                bom_id=mat['bom_id'],
                material_id=mat['material_id'],
                material_code=mat_product.data[0]['code'] if mat_product.data else None,
                material_name=mat_product.data[0]['name'] if mat_product.data else None,
                quantity=quantity,
                unit=mat['unit'],
                scrap_percentage=scrap_pct,
                unit_cost=unit_cost,
                total_cost=total_cost,
                sequence_number=mat.get('sequence_number'),
                created_at=datetime.fromisoformat(mat['created_at'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(mat['updated_at'].replace('Z', '+00:00'))
            ))
        
        return BOMResponse(
            id=bom['id'],
            product_id=bom['product_id'],
            product_code=product_code,
            product_name=product_name,
            batch_size=Decimal(str(bom.get('batch_size', 100))),
            version=bom.get('version', 1),
            is_active=bom['is_active'],
            is_template=bom.get('is_template', False),
            template_name=bom.get('template_name'),
            effective_date=bom.get('effective_date', bom['created_at']),
            notes=bom.get('notes'),
            materials=materials,
            total_bom_cost=total_bom_cost,
            created_at=datetime.fromisoformat(bom['created_at'].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(bom['updated_at'].replace('Z', '+00:00')),
            created_by=bom.get('created_by')
        )
    
    @staticmethod
    async def get_bom_by_product_id(product_id: str) -> BOMResponse:
        """Get active BOM by product ID."""
        db = get_db()
        
        bom = db.table('boms').select('id').eq('product_id', product_id).eq('is_active', True).execute()
        
        if not bom.data:
            raise NotFoundException(detail="No active BOM found for this product")
        
        return await BOMService.get_bom_by_id(bom.data[0]['id'])
    
    @staticmethod
    async def update_bom(bom_id: str, update_data: BOMUpdate, user_id: str) -> BOMResponse:
        """
        Update BOM - creates new version if BOM is active.
        """
        db = get_db()
        
        # Check if BOM exists
        existing = db.table('boms').select('*').eq('id', bom_id).execute()
        if not existing.data:
            raise NotFoundException(detail="BOM not found")
        
        bom = existing.data[0]
        
        # If BOM is active, create new version
        if bom['is_active']:
            current_version = bom.get('version', 1)
            new_version = current_version + 1
            
            # Update version number
            db.table('boms').update({
                'version': new_version,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', bom_id).execute()
            
            # Create version snapshot
            await BOMService._create_version_snapshot(
                bom_id=bom_id,
                version=new_version,
                user_id=user_id,
                notes=update_data.notes or f"Updated to version {new_version}"
            )
        
        # Update BOM fields
        update_dict = {}
        
        if update_data.batch_size is not None:
            update_dict['batch_size'] = float(update_data.batch_size)
        
        if update_data.notes is not None:
            update_dict['notes'] = update_data.notes
        
        if update_dict:
            update_dict['updated_at'] = datetime.utcnow().isoformat()
            db.table('boms').update(update_dict).eq('id', bom_id).execute()
        
        # If materials are being updated, replace all materials
        if update_data.materials is not None:
            # Validate all materials
            for material in update_data.materials:
                mat = db.table('products').select('id', 'category').eq('id', material.material_id).execute()
                if not mat.data:
                    raise ValidationException(detail=f"Material {material.material_id} not found")
                if mat.data[0].get('category') != 'Raw Material':
                    raise ValidationException(detail=f"Product {material.material_id} is not a raw material")
            
            # Delete existing materials
            db.table('bom_materials').delete().eq('bom_id', bom_id).execute()
            
            # Add new materials
            for idx, material in enumerate(update_data.materials, start=1):
                material_dict = {
                    'bom_id': bom_id,
                    'material_id': material.material_id,
                    'quantity': float(material.quantity),
                    'unit': material.unit,
                    'scrap_percentage': float(material.scrap_percentage),
                    'unit_cost': float(material.unit_cost),
                    'sequence_number': material.sequence_number or idx
                }
                
                db.table('bom_materials').insert(material_dict).execute()
        
        return await BOMService.get_bom_by_id(bom_id)
    
    @staticmethod
    async def delete_bom(bom_id: str) -> dict:
        """Delete BOM (soft delete - deactivate)."""
        db = get_db()
        
        # Check if BOM exists
        existing = db.table('boms').select('id').eq('id', bom_id).execute()
        if not existing.data:
            raise NotFoundException(detail="BOM not found")
        
        # Deactivate BOM
        db.table('boms').update({
            'is_active': False,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', bom_id).execute()
        
        return {"message": "BOM deactivated successfully"}
    
    @staticmethod
    async def get_bom_versions(bom_id: str) -> List[BOMVersion]:
        """Get version history for a BOM."""
        db = get_db()
        
        # Check if BOM exists
        bom = db.table('boms').select('id').eq('id', bom_id).execute()
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        # Get versions
        versions = db.table('bom_versions').select('*').eq('bom_id', bom_id).order('version', desc=True).execute()
        
        result = []
        for ver in versions.data:
            snapshot = json.loads(ver['snapshot']) if isinstance(ver['snapshot'], str) else ver['snapshot']
            
            result.append(BOMVersion(
                id=ver['id'],
                bom_id=ver['bom_id'],
                version=ver['version'],
                effective_date=ver['effective_date'],
                created_by=ver.get('created_by'),
                created_at=datetime.fromisoformat(ver['created_at'].replace('Z', '+00:00')),
                notes=ver.get('notes'),
                snapshot=snapshot
            ))
        
        return result
    
    @staticmethod
    async def duplicate_bom(
        bom_id: str,
        duplicate_data: BOMDuplicateRequest,
        user_id: str
    ) -> BOMResponse:
        """Duplicate an existing BOM for a new product."""
        db = get_db()
        
        # Get source BOM
        source_bom = await BOMService.get_bom_by_id(bom_id)
        
        # Validate new product
        product = db.table('products').select('id', 'category').eq('id', duplicate_data.new_product_id).execute()
        if not product.data:
            raise NotFoundException(detail="Target product not found")
        if product.data[0].get('category') != 'Finished Goods':
            raise ValidationException(detail="Target product must be finished goods")
        
        # Check if BOM already exists for new product
        existing = db.table('boms').select('id').eq('product_id', duplicate_data.new_product_id).eq('is_active', True).execute()
        if existing.data and not duplicate_data.copy_as_template:
            raise ValidationException(detail="Active BOM already exists for target product")
        
        # Create new BOM
        new_bom_dict = {
            'product_id': duplicate_data.new_product_id,
            'batch_size': float(source_bom.batch_size),
            'version': 1,
            'is_active': not duplicate_data.copy_as_template,
            'is_template': duplicate_data.copy_as_template,
            'template_name': duplicate_data.template_name if duplicate_data.copy_as_template else None,
            'effective_date': date.today().isoformat(),
            'notes': f"Duplicated from BOM {bom_id}",
            'created_by': user_id
        }
        
        new_bom_result = db.table('boms').insert(new_bom_dict).execute()
        
        if not new_bom_result.data:
            raise Exception("Failed to duplicate BOM")
        
        new_bom = new_bom_result.data[0]
        
        # Copy materials
        for material in source_bom.materials:
            material_dict = {
                'bom_id': new_bom['id'],
                'material_id': material.material_id,
                'quantity': float(material.quantity),
                'unit': material.unit,
                'scrap_percentage': float(material.scrap_percentage),
                'unit_cost': float(material.unit_cost),
                'sequence_number': material.sequence_number
            }
            
            db.table('bom_materials').insert(material_dict).execute()
        
        # Create version snapshot
        await BOMService._create_version_snapshot(
            bom_id=new_bom['id'],
            version=1,
            user_id=user_id,
            notes="Initial version (duplicated)"
        )
        
        return await BOMService.get_bom_by_id(new_bom['id'])
    
    @staticmethod
    async def validate_bom(bom_id: str) -> BOMValidationResult:
        """Validate BOM against inventory availability."""
        db = get_db()
        
        # Get BOM
        bom = await BOMService.get_bom_by_id(bom_id)
        
        total_materials = len(bom.materials)
        available_materials = 0
        shortage_materials = 0
        shortages = []
        
        for material in bom.materials:
            # Check inventory
            inventory = db.table('inventory').select('available_qty', 'allocated_qty').eq(
                'product_id', material.material_id
            ).execute()
            
            total_free = sum(
                Decimal(str(i['available_qty'])) - Decimal(str(i['allocated_qty']))
                for i in inventory.data
            ) if inventory.data else Decimal('0')
            
            required_qty = material.quantity
            
            if total_free >= required_qty:
                available_materials += 1
            else:
                shortage_materials += 1
                shortages.append({
                    'material_id': material.material_id,
                    'material_code': material.material_code,
                    'material_name': material.material_name,
                    'required_qty': float(required_qty),
                    'available_qty': float(total_free),
                    'shortage_qty': float(required_qty - total_free),
                    'unit': material.unit
                })
        
        return BOMValidationResult(
            is_valid=shortage_materials == 0,
            total_materials=total_materials,
            available_materials=available_materials,
            shortage_materials=shortage_materials,
            shortages=shortages
        )
    
    @staticmethod
    async def calculate_material_requirements(
        product_id: str,
        quantity: Decimal
    ) -> List[BOMCalculation]:
        """
        Calculate material requirements for a production order.
        Includes scrap percentage in calculation.
        """
        db = get_db()
        
        # Get active BOM
        bom_result = db.table('boms').select('*').eq('product_id', product_id).eq('is_active', True).execute()
        
        if not bom_result.data:
            raise NotFoundException(detail="No active BOM found for this product")
        
        bom = bom_result.data[0]
        batch_size = Decimal(str(bom.get('batch_size', 100)))
        
        # Get materials
        materials = db.table('bom_materials').select('*').eq('bom_id', bom['id']).execute()
        
        calculations = []
        
        for mat in materials.data:
            # Get material info
            mat_product = db.table('products').select('code', 'name').eq('id', mat['material_id']).execute()
            
            mat_quantity = Decimal(str(mat['quantity']))
            mat_unit_cost = Decimal(str(mat['unit_cost']))
            scrap_pct = Decimal(str(mat.get('scrap_percentage', 0)))
            
            # Calculate required quantity: (order_qty / batch_size) * material_qty * (1 + scrap%)
            required_quantity = (quantity / batch_size) * mat_quantity * (1 + scrap_pct / 100)
            total_cost = required_quantity * mat_unit_cost
            
            calculations.append(BOMCalculation(
                material_id=mat['material_id'],
                material_code=mat_product.data[0]['code'] if mat_product.data else '',
                material_name=mat_product.data[0]['name'] if mat_product.data else '',
                required_quantity=required_quantity,
                unit=mat['unit'],
                unit_cost=mat_unit_cost,
                scrap_percentage=scrap_pct,
                total_cost=total_cost
            ))
        
        return calculations

    @staticmethod
    async def add_material_to_bom(
        bom_id: str, 
        material: BOMMaterialCreate, 
        user_id: str
    ) -> BOMResponse:
        """Add a single material to existing BOM."""
        db = get_db()
        
        # Validate BOM exists
        bom = db.table('boms').select('*').eq('id', bom_id).execute()
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        # Validate material
        mat = db.table('products').select('id', 'category').eq('id', material.material_id).execute()
        if not mat.data:
            raise ValidationException(detail="Material not found")
        if mat.data[0]['category'] != 'Raw Material':
            raise ValidationException(detail="Product must be a raw material")
        
        # Check if material already exists in BOM
        existing = db.table('bom_materials').select('id').eq('bom_id', bom_id).eq('material_id', material.material_id).execute()
        if existing.data:
            raise ValidationException(detail="Material already exists in BOM")
        
        # Get next sequence number
        max_seq = db.table('bom_materials').select('sequence_number').eq('bom_id', bom_id).order('sequence_number', desc=True).limit(1).execute()
        next_seq = (max_seq.data[0]['sequence_number'] + 1) if max_seq.data else 1
        
        # Insert material
        material_dict = {
            'bom_id': bom_id,
            'material_id': material.material_id,
            'quantity': float(material.quantity),
            'unit': material.unit,
            'scrap_percentage': float(material.scrap_percentage),
            'unit_cost': float(material.unit_cost),
            'sequence_number': material.sequence_number or next_seq
        }
        
        db.table('bom_materials').insert(material_dict).execute()
        
        # Create new version if BOM is active
        if bom.data[0]['is_active']:
            new_version = bom.data[0].get('version', 1) + 1
            db.table('boms').update({
                'version': new_version,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', bom_id).execute()
            
            await BOMService._create_version_snapshot(
                bom_id, new_version, user_id, "Material added"
            )
        
        return await BOMService.get_bom_by_id(bom_id)


    @staticmethod
    async def update_bom_material(
        bom_id: str,
        material_id: str,
        material_update: BOMMaterialCreate,
        user_id: str
    ) -> BOMResponse:
        """Update a single material in BOM."""
        db = get_db()
        
        # Validate BOM exists
        bom = db.table('boms').select('*').eq('id', bom_id).execute()
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        # Validate material exists in BOM
        existing = db.table('bom_materials').select('id').eq('bom_id', bom_id).eq('id', material_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Material not found in BOM")
        
        # Update material
        update_dict = {
            'quantity': float(material_update.quantity),
            'unit': material_update.unit,
            'scrap_percentage': float(material_update.scrap_percentage),
            'unit_cost': float(material_update.unit_cost),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        if material_update.sequence_number:
            update_dict['sequence_number'] = material_update.sequence_number
        
        db.table('bom_materials').update(update_dict).eq('id', material_id).execute()
        
        # Create new version if BOM is active
        if bom.data[0]['is_active']:
            new_version = bom.data[0].get('version', 1) + 1
            db.table('boms').update({
                'version': new_version,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', bom_id).execute()
            
            await BOMService._create_version_snapshot(
                bom_id, new_version, user_id, "Material updated"
            )
        
        return await BOMService.get_bom_by_id(bom_id)


    @staticmethod
    async def remove_material_from_bom(
        bom_id: str,
        material_id: str,
        user_id: str
    ) -> dict:
        """Remove a single material from BOM."""
        db = get_db()
        
        # Validate BOM exists
        bom = db.table('boms').select('*').eq('id', bom_id).execute()
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        # Validate material exists in BOM
        existing = db.table('bom_materials').select('id').eq('bom_id', bom_id).eq('id', material_id).execute()
        if not existing.data:
            raise NotFoundException(detail="Material not found in BOM")
        
        # Delete material
        db.table('bom_materials').delete().eq('id', material_id).execute()
        
        # Create new version if BOM is active
        if bom.data[0]['is_active']:
            new_version = bom.data[0].get('version', 1) + 1
            db.table('boms').update({
                'version': new_version,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', bom_id).execute()
            
            await BOMService._create_version_snapshot(
                bom_id, new_version, user_id, "Material removed"
            )
        
        return {"message": "Material removed successfully"}


    @staticmethod
    async def activate_bom(bom_id: str) -> BOMResponse:
        """Activate a BOM version. Deactivates other versions for same product."""
        db = get_db()
        
        # Get BOM
        bom = db.table('boms').select('*').eq('id', bom_id).execute()
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        product_id = bom.data[0]['product_id']
        
        # Deactivate all other BOMs for this product
        db.table('boms').update({
            'is_active': False,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('product_id', product_id).neq('id', bom_id).execute()
        
        # Activate this BOM
        db.table('boms').update({
            'is_active': True,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', bom_id).execute()
        
        return await BOMService.get_bom_by_id(bom_id)


    @staticmethod
    async def get_cost_breakdown(bom_id: str, quantity: Decimal = Decimal('1')) -> dict:
        """Get detailed cost breakdown by material with percentages."""
        db = get_db()
        
        # Get BOM
        bom = await BOMService.get_bom_by_id(bom_id)
        
        batch_size = bom.batch_size
        total_cost = Decimal('0')
        
        # Calculate costs with scaling
        breakdown = []
        for material in bom.materials:
            # Scale by quantity and batch size
            scaled_qty = (quantity / batch_size) * material.quantity
            material_total = scaled_qty * material.unit_cost * (1 + material.scrap_percentage / 100)
            total_cost += material_total
            
            breakdown.append({
                'material_id': material.material_id,
                'material_code': material.material_code,
                'material_name': material.material_name,
                'base_quantity': float(material.quantity),
                'scaled_quantity': float(scaled_qty),
                'unit': material.unit,
                'unit_cost': float(material.unit_cost),
                'scrap_percentage': float(material.scrap_percentage),
                'total_cost': float(material_total)
            })
        
        # Add percentages
        for item in breakdown:
            item['cost_percentage'] = round((item['total_cost'] / float(total_cost)) * 100, 2) if total_cost > 0 else 0
        
        return {
            'bom_id': bom_id,
            'product_code': bom.product_code,
            'product_name': bom.product_name,
            'quantity': float(quantity),
            'batch_size': float(batch_size),
            'total_cost': float(total_cost),
            'cost_per_unit': float(total_cost / quantity) if quantity > 0 else 0,
            'materials': breakdown
        }
    @staticmethod
    async def calculate_requirements_with_shortages(
        product_id: str,
        quantity: Decimal,
        target_location_id: Optional[str] = None,
        include_allocated: bool = False
    ) -> BOMShortageCalculation:
        """
        Calculate material requirements with shortage analysis.
        
        Checks inventory availability and calculates shortages.
        """
        from app.schemas.bom import MaterialShortageDetail, BOMShortageCalculation
        
        db = get_db()
        
        # Get active BOM
        bom = db.table('boms').select('*').eq('product_id', product_id).eq('is_active', True).execute()
        
        if not bom.data:
            raise NotFoundException(detail="No active BOM found for this product")
        
        bom_data = bom.data[0]
        batch_size = Decimal(str(bom_data.get('batch_size', 100)))
        
        # Get product details
        product = db.table('products').select('code', 'name').eq('id', product_id).execute()
        product_code = product.data[0]['code'] if product.data else 'Unknown'
        product_name = product.data[0]['name'] if product.data else 'Unknown'
        
        # Get BOM materials
        materials = db.table('bom_materials').select('*').eq('bom_id', bom_data['id']).execute()
        
        shortage_details = []
        total_bom_cost = Decimal('0')
        
        sufficient_count = 0
        moderate_count = 0
        critical_count = 0
        out_of_stock_count = 0
        
        for material in materials.data:
            material_id = material['material_id']
            
            # Get material details (without unit_cost - it's in BOM, not products)
            mat_product = db.table('products').select('code', 'name', 'unit').eq('id', material_id).execute()
            
            if not mat_product.data:
                continue
            
            mat = mat_product.data[0]
            
            # Calculate required quantity
            material_qty = Decimal(str(material['quantity']))
            scrap_pct = Decimal(str(material.get('scrap_percentage', 0)))
            
            required_qty = (quantity / batch_size) * material_qty * (1 + scrap_pct / 100)
            required_qty = required_qty.quantize(Decimal('0.001'))
            
            # Calculate cost (unit_cost is in BOM materials, not products table)
            unit_cost = Decimal(str(material.get('unit_cost', 0)))
            material_cost = required_qty * unit_cost
            total_bom_cost += material_cost
            
            # Check inventory availability
            inventory_query = db.table('inventory').select('*').eq('product_id', material_id)
            
            if target_location_id:
                inventory_query = inventory_query.eq('location_id', target_location_id)
            
            inventory_result = inventory_query.execute()
            
            # Aggregate inventory across locations
            available_qty = Decimal('0')
            allocated_qty = Decimal('0')
            location_breakdown = []
            
            for inv in inventory_result.data:
                inv_available = Decimal(str(inv['available_qty']))
                inv_allocated = Decimal(str(inv['allocated_qty']))
                
                available_qty += inv_available
                allocated_qty += inv_allocated
                
                # Get location name
                loc = db.table('locations').select('code', 'name').eq('id', inv['location_id']).execute()
                loc_name = loc.data[0]['name'] if loc.data else 'Unknown'
                
                location_breakdown.append({
                    'location_id': inv['location_id'],
                    'location_name': loc_name,
                    'available_qty': float(inv_available),
                    'allocated_qty': float(inv_allocated),
                    'free_qty': float(inv_available - inv_allocated)
                })
            
            # Calculate free quantity
            if include_allocated:
                free_qty = available_qty
            else:
                free_qty = available_qty - allocated_qty
            
            # Calculate shortage
            shortage_qty = max(Decimal('0'), required_qty - free_qty)
            
            # Determine shortage status
            if free_qty >= required_qty:
                shortage_status = "Sufficient"
                procurement_needed = False
                sufficient_count += 1
            elif free_qty == 0:
                shortage_status = "Out of Stock"
                procurement_needed = True
                out_of_stock_count += 1
            elif free_qty >= required_qty * Decimal('0.5'):
                shortage_status = "Moderate"
                procurement_needed = True
                moderate_count += 1
            else:
                shortage_status = "Critical"
                procurement_needed = True
                critical_count += 1
            
            shortage_details.append(MaterialShortageDetail(
                material_id=material_id,
                material_code=mat['code'],
                material_name=mat['name'],
                required_qty=required_qty,
                unit=mat['unit'],
                available_qty=available_qty,
                allocated_qty=allocated_qty,
                free_qty=free_qty,
                shortage_qty=shortage_qty,
                shortage_status=shortage_status,
                procurement_needed=procurement_needed,
                location_breakdown=location_breakdown if location_breakdown else None
            ))
        
        # Summary
        summary = {
            'total_materials': len(shortage_details),
            'sufficient': sufficient_count,
            'moderate': moderate_count,
            'critical': critical_count,
            'out_of_stock': out_of_stock_count,
            'procurement_required': moderate_count + critical_count + out_of_stock_count,
            'can_produce': sufficient_count == len(shortage_details),
            'total_shortage_items': len(shortage_details) - sufficient_count
        }
        
        return BOMShortageCalculation(
            product_id=product_id,
            product_code=product_code,
            product_name=product_name,
            production_qty=quantity,
            bom_batch_size=batch_size,
            total_bom_cost=total_bom_cost,
            materials=shortage_details,
            summary=summary
        )

    @staticmethod
    async def get_bom_materials_with_shortages(
        bom_id: str,
        production_qty: Decimal
    ) -> List[BOMMaterialWithShortage]:
        """
        Get BOM materials with shortage information for UI display.
        """
        from app.schemas.bom import BOMMaterialWithShortage
        
        db = get_db()
        
        # Get BOM
        bom = db.table('boms').select('*').eq('id', bom_id).execute()
        
        if not bom.data:
            raise NotFoundException(detail="BOM not found")
        
        bom_data = bom.data[0]
        batch_size = Decimal(str(bom_data.get('batch_size', 1)))
        product_id = bom_data['product_id']
        
        # Get shortage calculation
        shortage_calc = await BOMService.calculate_requirements_with_shortages(
            product_id=product_id,
            quantity=production_qty,
            target_location_id=None,
            include_allocated=False
        )
        
        # Get BOM materials
        materials = db.table('bom_materials').select('*').eq('bom_id', bom_id).order('sequence_number').execute()
        
        result = []
        
        for mat in materials.data:
            material_id = mat['material_id']
            
            # Find corresponding shortage detail
            shortage_detail = next(
                (s for s in shortage_calc.materials if s.material_id == material_id),
                None
            )
            
            if not shortage_detail:
                continue
            
            # Get material product info
            mat_product = db.table('products').select('code', 'name').eq('id', material_id).execute()
            
            quantity_per_unit = Decimal(str(mat['quantity']))
            
            # Create shortage display text
            if shortage_detail.shortage_qty > 0:
                shortage_display = f"Need {float(shortage_detail.shortage_qty)} {shortage_detail.unit}"
            else:
                shortage_display = None
            
            result.append(BOMMaterialWithShortage(
                id=mat['id'],
                material_id=material_id,
                material_code=mat_product.data[0]['code'] if mat_product.data else '',
                material_name=mat_product.data[0]['name'] if mat_product.data else '',
                quantity_per_unit=quantity_per_unit,
                required_qty=shortage_detail.required_qty,
                unit=mat['unit'],
                scrap_percentage=Decimal(str(mat.get('scrap_percentage', 0))),
                unit_cost=Decimal(str(mat.get('unit_cost', 0))),
                sequence_number=mat.get('sequence_number'),
                stock_qty=shortage_detail.available_qty,
                available_qty=shortage_detail.available_qty,
                allocated_qty=shortage_detail.allocated_qty,
                free_qty=shortage_detail.free_qty,
                shortage_qty=shortage_detail.shortage_qty,
                shortage_status=shortage_detail.shortage_status,
                shortage_display=shortage_display
            ))
        
        return result

# Singleton instance
bom_service = BOMService()