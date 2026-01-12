from app.database import get_db
from app.schemas.finished_good import (
    FinishedGoodCreate, FinishedGoodUpdate, FinishedGoodResponse,
    DispatchCreate, DispatchUpdate, DispatchResponse, POProgressResponse
)
from app.core.exceptions import NotFoundException, ValidationException
from typing import List, Optional
from decimal import Decimal


class FinishedGoodService:
    def __init__(self):
        self.db = get_db()

    async def create_finished_good(
        self, data: FinishedGoodCreate, user_id: str
    ) -> FinishedGoodResponse:
        """Create finished good entry from completed work order"""
        
        # Validate product exists
        product_result = self.db.table("products").select("*").eq("id", data.product_id).execute()
        if not product_result.data:
            raise NotFoundException("Product not found")
        
        product = product_result.data[0]
        
        # Create FG entry
        fg_data = {
            "product_id": data.product_id,
            "work_order_id": data.work_order_id,
            "purchase_order_id": data.purchase_order_id,
            "quantity": float(data.quantity),
            "unit": data.unit,
            "location_id": data.location_id,
            "status": data.status,
            "quality_status": data.quality_status,
            "batch_number": data.batch_number,
            "manufactured_date": data.manufactured_date.isoformat() if data.manufactured_date else None,
            "expiry_date": data.expiry_date.isoformat() if data.expiry_date else None,
            "notes": data.notes,
            "created_by": user_id
        }
        
        result = self.db.table("finished_goods").insert(fg_data).execute()
        
        if not result.data:
            raise ValidationException("Failed to create finished good")
        
        return await self.get_finished_good_by_id(result.data[0]["id"])

    async def get_finished_good_by_id(self, fg_id: str) -> FinishedGoodResponse:
        """Get finished good details"""
        
        query = """
            finished_goods.id,
            finished_goods.quantity,
            finished_goods.unit,
            finished_goods.status,
            finished_goods.quality_status,
            finished_goods.batch_number,
            finished_goods.manufactured_date,
            finished_goods.expiry_date,
            finished_goods.notes,
            finished_goods.created_by,
            finished_goods.created_at,
            finished_goods.updated_at,
            products!inner(id, code, name),
            work_orders(id, work_order_number),
            purchase_orders(id, order_number),
            locations(id, name)
        """
        
        result = self.db.table("finished_goods").select(query).eq("id", fg_id).execute()
        
        if not result.data:
            raise NotFoundException("Finished good not found")
        
        fg = result.data[0]
        
        return FinishedGoodResponse(
            id=fg["id"],
            product_id=fg["products"]["id"],
            product_code=fg["products"]["code"],
            product_name=fg["products"]["name"],
            work_order_id=fg["work_orders"]["id"] if fg.get("work_orders") else None,
            work_order_number=fg["work_orders"]["work_order_number"] if fg.get("work_orders") else None,
            purchase_order_id=fg["purchase_orders"]["id"] if fg.get("purchase_orders") else None,
            purchase_order_number=fg["purchase_orders"]["order_number"] if fg.get("purchase_orders") else None,
            quantity=Decimal(str(fg["quantity"])),
            unit=fg["unit"],
            location_id=fg["locations"]["id"] if fg.get("locations") else None,
            location_name=fg["locations"]["name"] if fg.get("locations") else None,
            status=fg["status"],
            quality_status=fg["quality_status"],
            batch_number=fg.get("batch_number"),
            manufactured_date=fg.get("manufactured_date"),
            expiry_date=fg.get("expiry_date"),
            notes=fg.get("notes"),
            created_by=fg.get("created_by"),
            created_at=fg["created_at"],
            updated_at=fg["updated_at"]
        )

    async def list_finished_goods(
        self,
        page: int = 1,
        limit: int = 50,
        product_id: Optional[str] = None,
        status: Optional[str] = None,
        purchase_order_id: Optional[str] = None
    ) -> List[FinishedGoodResponse]:
        """List finished goods with filters"""
        
        offset = (page - 1) * limit
        
        query = """
            finished_goods.id,
            finished_goods.quantity,
            finished_goods.unit,
            finished_goods.status,
            finished_goods.quality_status,
            finished_goods.batch_number,
            finished_goods.manufactured_date,
            finished_goods.expiry_date,
            finished_goods.notes,
            finished_goods.created_by,
            finished_goods.created_at,
            finished_goods.updated_at,
            products!inner(id, code, name),
            work_orders(id, work_order_number),
            purchase_orders(id, order_number),
            locations(id, name)
        """
        
        query_builder = self.db.table("finished_goods").select(query)
        
        if product_id:
            query_builder = query_builder.eq("product_id", product_id)
        if status:
            query_builder = query_builder.eq("status", status)
        if purchase_order_id:
            query_builder = query_builder.eq("purchase_order_id", purchase_order_id)
        
        result = query_builder.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        return [
            FinishedGoodResponse(
                id=fg["id"],
                product_id=fg["products"]["id"],
                product_code=fg["products"]["code"],
                product_name=fg["products"]["name"],
                work_order_id=fg["work_orders"]["id"] if fg.get("work_orders") else None,
                work_order_number=fg["work_orders"]["work_order_number"] if fg.get("work_orders") else None,
                purchase_order_id=fg["purchase_orders"]["id"] if fg.get("purchase_orders") else None,
                purchase_order_number=fg["purchase_orders"]["order_number"] if fg.get("purchase_orders") else None,
                quantity=Decimal(str(fg["quantity"])),
                unit=fg["unit"],
                location_id=fg["locations"]["id"] if fg.get("locations") else None,
                location_name=fg["locations"]["name"] if fg.get("locations") else None,
                status=fg["status"],
                quality_status=fg["quality_status"],
                batch_number=fg.get("batch_number"),
                manufactured_date=fg.get("manufactured_date"),
                expiry_date=fg.get("expiry_date"),
                notes=fg.get("notes"),
                created_by=fg.get("created_by"),
                created_at=fg["created_at"],
                updated_at=fg["updated_at"]
            )
            for fg in result.data
        ]

    async def create_dispatch(
        self, data: DispatchCreate, user_id: str
    ) -> DispatchResponse:
        """Create dispatch record"""
        
        # Validate PO and product
        po_result = self.db.table("purchase_orders").select("*").eq("id", data.purchase_order_id).execute()
        if not po_result.data:
            raise NotFoundException("Purchase order not found")
        
        product_result = self.db.table("products").select("*").eq("id", data.product_id).execute()
        if not product_result.data:
            raise NotFoundException("Product not found")
        
        # Check FG availability
        fg_result = self.db.table("finished_goods")\
            .select("quantity")\
            .eq("product_id", data.product_id)\
            .eq("purchase_order_id", data.purchase_order_id)\
            .eq("status", "In Stock")\
            .execute()
        
        available_qty = sum(Decimal(str(fg["quantity"])) for fg in fg_result.data)
        
        if available_qty < data.quantity:
            raise ValidationException(
                f"Insufficient finished goods. Available: {available_qty}, Requested: {data.quantity}"
            )
        
        # Create dispatch
        dispatch_data = {
            "purchase_order_id": data.purchase_order_id,
            "product_id": data.product_id,
            "quantity": float(data.quantity),
            "unit": data.unit,
            "dispatch_date": data.dispatch_date.isoformat() if data.dispatch_date else None,
            "customer_name": data.customer_name,
            "delivery_address": data.delivery_address,
            "vehicle_number": data.vehicle_number,
            "driver_name": data.driver_name,
            "driver_contact": data.driver_contact,
            "status": data.status,
            "notes": data.notes,
            "created_by": user_id
        }
        
        result = self.db.table("dispatches").insert(dispatch_data).execute()
        
        if not result.data:
            raise ValidationException("Failed to create dispatch")
        
        # Update FG status to dispatched
        remaining_qty = data.quantity
        for fg_id in data.finished_good_ids:
            if remaining_qty <= 0:
                break
            
            fg = self.db.table("finished_goods").select("quantity").eq("id", fg_id).execute()
            if fg.data:
                fg_qty = Decimal(str(fg.data[0]["quantity"]))
                dispatch_qty = min(fg_qty, remaining_qty)
                
                # Create dispatch item link
                self.db.table("dispatch_items").insert({
                    "dispatch_id": result.data[0]["id"],
                    "finished_good_id": fg_id,
                    "quantity": float(dispatch_qty)
                }).execute()
                
                # Update FG quantity or status
                if dispatch_qty >= fg_qty:
                    self.db.table("finished_goods").update({"status": "Dispatched"}).eq("id", fg_id).execute()
                else:
                    new_qty = fg_qty - dispatch_qty
                    self.db.table("finished_goods").update({"quantity": float(new_qty)}).eq("id", fg_id).execute()
                
                remaining_qty -= dispatch_qty
        
        return await self.get_dispatch_by_id(result.data[0]["id"])

    async def get_dispatch_by_id(self, dispatch_id: str) -> DispatchResponse:
        """Get dispatch details"""
        
        query = """
            dispatches.id,
            dispatches.dispatch_number,
            dispatches.quantity,
            dispatches.unit,
            dispatches.dispatch_date,
            dispatches.customer_name,
            dispatches.delivery_address,
            dispatches.vehicle_number,
            dispatches.driver_name,
            dispatches.driver_contact,
            dispatches.status,
            dispatches.notes,
            dispatches.created_by,
            dispatches.created_at,
            dispatches.updated_at,
            products!inner(id, code, name),
            purchase_orders!inner(id, order_number)
        """
        
        result = self.db.table("dispatches").select(query).eq("id", dispatch_id).execute()
        
        if not result.data:
            raise NotFoundException("Dispatch not found")
        
        dispatch = result.data[0]
        
        return DispatchResponse(
            id=dispatch["id"],
            dispatch_number=dispatch["dispatch_number"],
            purchase_order_id=dispatch["purchase_orders"]["id"],
            purchase_order_number=dispatch["purchase_orders"]["order_number"],
            product_id=dispatch["products"]["id"],
            product_code=dispatch["products"]["code"],
            product_name=dispatch["products"]["name"],
            quantity=Decimal(str(dispatch["quantity"])),
            unit=dispatch["unit"],
            dispatch_date=dispatch["dispatch_date"],
            customer_name=dispatch.get("customer_name"),
            delivery_address=dispatch.get("delivery_address"),
            vehicle_number=dispatch.get("vehicle_number"),
            driver_name=dispatch.get("driver_name"),
            driver_contact=dispatch.get("driver_contact"),
            status=dispatch["status"],
            notes=dispatch.get("notes"),
            created_by=dispatch.get("created_by"),
            created_at=dispatch["created_at"],
            updated_at=dispatch["updated_at"]
        )

    async def get_po_progress(self, po_id: str) -> POProgressResponse:
        """Get purchase order progress with drill-down"""
        
        # Get PO details
        po_result = self.db.table("purchase_orders").select("*").eq("id", po_id).execute()
        if not po_result.data:
            raise ValidationException(detail="Purchase order not found")
        
        po = po_result.data[0]
        
        # Get product details
        product_result = self.db.table("products").select("*").eq("id", po["product_id"]).execute()
        product = product_result.data[0] if product_result.data else {}
        
        # Get work orders for this PO
        wo_result = self.db.table("work_orders")\
            .select("id, work_order_number, quantity, quantity_completed, status")\
            .eq("purchase_order_id", po_id)\
            .execute()
        
        work_orders = [
            {
                "id": wo["id"],
                "work_order_number": wo["work_order_number"],
                "quantity": float(wo["quantity"]),
                "quantity_completed": float(wo.get("quantity_completed", 0)),
                "status": wo["status"]
            }
            for wo in wo_result.data
        ]
        
        ordered_qty = Decimal(str(po["quantity"]))
        completed_qty = Decimal(str(po.get("quantity_completed", 0)))
        in_fg_qty = Decimal(str(po.get("quantity_in_fg", 0)))
        dispatched_qty = Decimal(str(po.get("quantity_dispatched", 0)))
        reworked_qty = Decimal(str(po.get("quantity_reworked", 0)))
        scrapped_qty = Decimal(str(po.get("quantity_scrapped", 0)))
        pending_qty = ordered_qty - completed_qty - reworked_qty - scrapped_qty
        
        completion_pct = float((completed_qty / ordered_qty) * 100) if ordered_qty > 0 else 0
        dispatch_pct = float((dispatched_qty / ordered_qty) * 100) if ordered_qty > 0 else 0
        
        return POProgressResponse(
            purchase_order_id=po["id"],
            purchase_order_number=po["order_number"],
            product_id=product.get("id", ""),
            product_code=product.get("code", ""),
            product_name=product.get("name", ""),
            ordered_quantity=ordered_qty,
            quantity_completed=completed_qty,
            quantity_pending=pending_qty,
            quantity_in_fg=in_fg_qty,
            quantity_dispatched=dispatched_qty,
            quantity_reworked=reworked_qty,
            quantity_scrapped=scrapped_qty,
            completion_percentage=completion_pct,
            dispatch_percentage=dispatch_pct,
            work_orders=work_orders
        )


finished_good_service = FinishedGoodService()
