"""Legacy backup of the purchase order service.

Historically this file contained a production-order implementation. To keep
backwards compatibility while avoiding drift, we now simply re-export the
current :class:`PurchaseOrderService`.
"""

from app.services.purchase_order_service import PurchaseOrderService

# Legacy symbols preserved for modules that still import from this file
ProductionOrderService = PurchaseOrderService
production_order_service = PurchaseOrderService()