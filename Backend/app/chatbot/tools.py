from langchain_core.tools import tool
from typing import Optional
import logging

logger = logging.getLogger(__name__)


# ==========================================
# NAVIGATION & GUIDANCE TOOLS
# ==========================================

@tool
def get_module_guide(module_name: str) -> str:
    """Get step-by-step workflow guide for a specific module in OMNIX.
    Use this when the user asks HOW to do something, WHERE to find something,
    or wants a walkthrough of a module.
    
    Args:
        module_name: One of: dashboard, products, bom, orders, working-order,
                     wip, inventory, transfer, material-request, qc, 
                     gate-entry, gate-exit, settings
    """
    from app.chatbot.prompts import MODULE_GUIDES
    guide = MODULE_GUIDES.get(module_name)
    if guide:
        return guide.strip()
    
    available = ", ".join(MODULE_GUIDES.keys())
    return f"No guide found for module '{module_name}'. Available modules: {available}"


@tool
def get_prerequisites(action: str) -> str:
    """Check what needs to exist before performing an action.
    Use when user wants to create something and you need to tell them
    what's required first, or when a creation fails and you need to explain why.
    
    Args:
        action: The action to check. One of: create_bom, create_purchase_order,
                create_work_order, create_material_transfer, create_material_request,
                create_gate_entry, create_gate_exit, create_qc_inspection, add_inventory_material
    """
    prereqs = {
        "create_bom": (
            "To create a BOM you need:\n"
            "1. A Product Code and Product Name for the finished good.\n"
            "2. At least one raw material with Item Code, Material name, Quantity, Unit, and Unit Cost.\n"
            "Navigation: Sidebar → BOM → click '+ Create New BOM' (teal button, top right).\n"
            "Tip: If raw materials don't exist in inventory yet, you can still create the BOM — "
            "but shortage checks will flag everything as missing until you add stock."
        ),
        "create_purchase_order": (
            "To create a Purchase Order you need:\n"
            "1. A finished goods product must exist (created via BOM or Products module).\n"
            "2. An active BOM must exist for that product — without it, material requirements can't be calculated.\n"
            "3. Select the product, enter quantity, set due date and priority.\n"
            "Navigation: Sidebar → Purchase Orders → click '+ New Order' (blue button, top right)."
        ),
        "create_work_order": (
            "To create a Work Order you need:\n"
            "1. A Purchase Order must exist — select it from the dropdown.\n"
            "2. The product must have an active BOM.\n"
            "3. Sufficient raw material inventory — if materials are short, creation FAILS with an error.\n"
            "4. Choose WIP Stage Configuration, Shift, Start Date, and Quantity.\n"
            "Navigation: Sidebar → Working Order → click '+ New Work Order' (green button).\n"
            "Shortcut: You can also create from Purchase Orders → Action menu (⋮) → 'Create Working Order'."
        ),
        "create_material_transfer": (
            "To create a Material Transfer you need:\n"
            "1. The product must exist in inventory at the source location with sufficient available stock.\n"
            "2. Select the destination location/stage, quantity, priority, and transfer reason.\n"
            "Navigation: Sidebar → Material Transfer → open transfer view."
        ),
        "create_material_request": (
            "To create a Material Request you need:\n"
            "1. Select Department and Shift Number.\n"
            "2. Fill in Requested By and Reviewed By names.\n"
            "3. Add material items: RM Code (auto-fills description and unit), Quantity, Location, Priority.\n"
            "No product or BOM prerequisites — anyone can submit a request.\n"
            "Navigation: Sidebar → Material Request."
        ),
        "create_gate_entry": (
            "To create a Gate Entry you need:\n"
            "1. Entry Type (Material Delivery, Courier, Visitor, etc.).\n"
            "2. Vendor / Source name (required).\n"
            "3. Destination Department (Store, QA, Maintenance, Production, Admin).\n"
            "4. At least one material item with code, name, quantity, and unit.\n"
            "Optional: Vehicle Number, Driver Name, Linked Document (PO/Invoice/DC), Photos.\n"
            "Navigation: Sidebar → Gate Entry → 'New Entry' tab."
        ),
        "create_gate_exit": (
            "To create a Gate Exit you need:\n"
            "1. Exit Type (e.g., Finished Goods Dispatch).\n"
            "2. Destination (required) and Linked Document (SO/DC/Challan number, required).\n"
            "3. At least one material item with code, name, quantity, and unit.\n"
            "Optional: Customer/Party, Vehicle Number, Driver Name, Remarks.\n"
            "Navigation: Sidebar → Gate Exit → click 'Create Gate Exit' (purple button)."
        ),
        "create_qc_inspection": (
            "To create a QC Inspection you need:\n"
            "1. An existing Purchase Order or Work Order to inspect against.\n"
            "2. Search by order number, select from dropdowns, or Scan QR.\n"
            "3. Log defects from the Defect Library (Cracks, Dimensions, Scratches, Color Defects, Stitching Issues).\n"
            "4. The system auto-calculates Pass/Rework/Scrap percentages.\n"
            "Navigation: Sidebar → QC Check."
        ),
        "add_inventory_material": (
            "To add a new material to Inventory you need:\n"
            "1. Material Code (unique identifier) and Material Name.\n"
            "2. Available Quantity and Unit of Measurement.\n"
            "3. Reorder Level, Unit Cost, Storage Location, and Status.\n"
            "Navigation: Sidebar → Inventory → click 'Add New Material' button."
        ),
    }
    result = prereqs.get(action)
    if result:
        return result
    available = ", ".join(prereqs.keys())
    return f"Unknown action '{action}'. Available actions: {available}"


@tool
def get_production_lifecycle() -> str:
    """Explain the full Omnix production lifecycle from start to finish.
    Use when user asks about the overall flow, how modules connect,
    or the end-to-end manufacturing process.
    """
    return """The Omnix Production Lifecycle (End-to-End Flow):

1. INBOUND SETUP:
   - Gate Entry logs incoming shipments from vendors → updates Inventory (Raw Materials).
   - BOM (Bill of Materials) defines the product recipes — what raw materials make each finished good.

2. DEMAND CREATION:
   - Purchase Orders capture client demand (product, quantity, due date, priority).
   - Purchase Orders directly trigger internal Working Orders for floor execution.

3. FLOOR EXECUTION:
   - Material Requests pull raw stock from inventory to the production line.
   - Material Transfers move items between stages/locations on the floor.
   - WIP Board monitors the active flow through stages (Cutting → Assembly → QC → Packaging → Dispatch).

4. VALIDATION & OUTBOUND:
   - QC Check validates produced batches (Pass/Rework/Scrap).
   - Passed yields push to Inventory (Finished Goods).
   - Gate Exit dispatches finished goods to customers.

Module connection: BOM → Purchase Order → Working Order → WIP Board → QC → Gate Exit.
Inventory is referenced at every step for stock availability and allocation."""


# ==========================================
# DATA LOOKUP TOOLS
# ==========================================

@tool
def lookup_product(search_term: str) -> str:
    """Search for a product by code or name.
    Use when user asks about a specific product, material, or SKU.
    
    Args:
        search_term: Product code or partial name to search for
    """
    try:
        from app.database import get_db
        db = get_db()
        
        result = db.table('products').select(
            'id, code, name, category, unit, is_active'
        ).or_(
            f"code.ilike.%{search_term}%,name.ilike.%{search_term}%"
        ).limit(5).execute()
        
        if not result.data:
            return f"No products found matching '{search_term}'."
        
        lines = []
        for p in result.data:
            status = "Active" if p['is_active'] else "Inactive"
            lines.append(
                f"- {p['code']} | {p['name']} | Category: {p['category']} | Unit: {p['unit']} | {status}"
            )
        
        return f"Found {len(result.data)} product(s):\n" + "\n".join(lines)
    except Exception as e:
        logger.error(f"lookup_product error: {e}")
        return f"Error looking up product: {str(e)}"


@tool
def check_inventory(product_name: str, location: Optional[str] = None) -> str:
    """Check current stock level for a product across all locations.
    Use when user asks about stock, availability, or inventory of a material.
    
    Args:
        product_name: Product code or name to check
        location: Optional location name to filter by
    """
    try:
        from app.database import get_db
        db = get_db()
        
        # Find product
        prod = db.table('products').select('id, code, name, unit').or_(
            f"code.ilike.%{product_name}%,name.ilike.%{product_name}%"
        ).limit(1).execute()
        
        if not prod.data:
            return f"No product found matching '{product_name}'."
        
        product = prod.data[0]
        
        # Get inventory across locations
        query = db.table('inventory').select(
            'available_qty, allocated_qty, location_id, locations(name, type)'
        ).eq('product_id', product['id'])
        
        if location:
            # Filter by location name via join
            loc = db.table('locations').select('id').ilike('name', f'%{location}%').limit(1).execute()
            if loc.data:
                query = query.eq('location_id', loc.data[0]['id'])
        
        inv = query.execute()
        
        if not inv.data:
            return f"{product['name']} ({product['code']}): No inventory records found. Stock is 0."
        
        lines = [f"Stock for {product['name']} ({product['code']}):"]
        total_available = 0
        total_allocated = 0
        
        for row in inv.data:
            avail = float(row['available_qty'])
            alloc = float(row['allocated_qty'])
            free = avail - alloc
            loc_name = row.get('locations', {}).get('name', 'Unknown') if row.get('locations') else 'Unknown'
            total_available += avail
            total_allocated += alloc
            lines.append(f"  {loc_name}: Available={avail}, Allocated={alloc}, Free={free} {product['unit']}")
        
        total_free = total_available - total_allocated
        lines.append(f"  TOTAL: Available={total_available}, Allocated={total_allocated}, Free={total_free} {product['unit']}")
        
        # Check stock alerts
        alerts = db.table('stock_alerts').select('min_qty, max_qty, reorder_qty').eq(
            'product_id', product['id']
        ).eq('is_active', True).execute()
        
        if alerts.data:
            a = alerts.data[0]
            min_qty = float(a['min_qty'])
            if total_free < min_qty:
                lines.append(f"  WARNING: BELOW MINIMUM STOCK! Min={min_qty}, Reorder Level={a['reorder_qty']}")
            else:
                lines.append(f"  Stock OK. Min={min_qty}, Reorder={a['reorder_qty']}")
        
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"check_inventory error: {e}")
        return f"Error checking inventory: {str(e)}"


@tool
def lookup_order(order_number: str) -> str:
    """Look up a purchase order by its order number.
    Use when user asks about a specific order status, progress, or details.
    
    Args:
        order_number: The order number or partial match (e.g., PO-2025-0001)
    """
    try:
        from app.database import get_db
        db = get_db()
        
        result = db.table('purchase_orders').select(
            '*, products(code, name)'
        ).ilike('order_number', f'%{order_number}%').limit(3).execute()
        
        if not result.data:
            return f"No order found matching '{order_number}'."
        
        lines = []
        for o in result.data:
            product = o.get('products', {}) or {}
            lines.append(
                f"Order: {o['order_number']}\n"
                f"  Product: {product.get('name', 'N/A')} ({product.get('code', 'N/A')})\n"
                f"  Quantity: {o['quantity']} {o.get('unit', 'pcs')}\n"
                f"  Status: {o['status']}\n"
                f"  Priority: {o.get('priority', 'N/A')}\n"
                f"  Due Date: {o.get('due_date', 'N/A')}\n"
                f"  Customer: {o.get('customer_name', 'N/A')}"
            )
        
        return "\n---\n".join(lines)
    except Exception as e:
        logger.error(f"lookup_order error: {e}")
        return f"Error looking up order: {str(e)}"


@tool
def lookup_work_order(work_order_number: str) -> str:
    """Look up a work order by its number.
    Use when user asks about a specific work order, its progress, or stage status.
    
    Args:
        work_order_number: The work order number or partial match (e.g., WO-2025-0001)
    """
    try:
        from app.database import get_db
        db = get_db()
        
        result = db.table('work_orders').select(
            '*, products(code, name)'
        ).ilike('work_order_number', f'%{work_order_number}%').limit(3).execute()
        
        if not result.data:
            return f"No work order found matching '{work_order_number}'."
        
        lines = []
        for wo in result.data:
            product = wo.get('products', {}) or {}
            target = wo.get('target_qty', wo.get('quantity', 'N/A'))
            completed = wo.get('completed_qty', 0)
            lines.append(
                f"Work Order: {wo['work_order_number']}\n"
                f"  Product: {product.get('name', 'N/A')} ({product.get('code', 'N/A')})\n"
                f"  Target Qty: {target}\n"
                f"  Completed Qty: {completed}\n"
                f"  Status: {wo['status']}\n"
                f"  Shift: {wo.get('shift', 'N/A')}\n"
                f"  Created: {wo['created_at']}"
            )
        
        return "\n---\n".join(lines)
    except Exception as e:
        logger.error(f"lookup_work_order error: {e}")
        return f"Error looking up work order: {str(e)}"


@tool
def get_shortage_alerts() -> str:
    """Get current material shortage alerts — items below minimum stock level.
    Use when user asks about shortages, low stock, what needs reordering,
    or why the dashboard shows shortage warnings.
    """
    try:
        from app.database import get_db
        db = get_db()
        
        alerts = db.table('stock_alerts').select(
            'product_id, min_qty, reorder_qty, products(code, name, unit)'
        ).eq('is_active', True).execute()
        
        if not alerts.data:
            return "No stock alerts configured. Set up alerts in Inventory → Stock Alerts."
        
        shortages = []
        for alert in alerts.data:
            product = alert.get('products', {}) or {}
            pid = alert['product_id']
            
            inv = db.table('inventory').select('available_qty, allocated_qty').eq(
                'product_id', pid
            ).execute()
            
            current = sum(
                float(r['available_qty']) - float(r['allocated_qty'])
                for r in inv.data
            ) if inv.data else 0
            
            min_qty = float(alert['min_qty'])
            if current < min_qty:
                shortage = min_qty - current
                priority = "CRITICAL" if current == 0 else ("HIGH" if current < min_qty * 0.5 else "MEDIUM")
                shortages.append(
                    f"- [{priority}] {product.get('name', 'Unknown')} ({product.get('code', '?')}): "
                    f"Free Stock={current:.1f}, Min Required={min_qty:.1f}, "
                    f"Short by {shortage:.1f} {product.get('unit', '')}"
                )
        
        if not shortages:
            return "All stock levels are above minimum. No shortages detected."
        
        return f"Found {len(shortages)} material shortage(s):\n" + "\n".join(shortages)
    except Exception as e:
        logger.error(f"get_shortage_alerts error: {e}")
        return f"Error fetching shortages: {str(e)}"


@tool
def get_dashboard_summary() -> str:
    """Get current dashboard KPIs — live orders, shortages, completions.
    Use when user asks about overall factory status, daily summary, or KPI numbers.
    """
    try:
        from app.database import get_db
        from datetime import date
        db = get_db()
        
        # Live orders (Planned + In Progress)
        orders = db.table('purchase_orders').select('id', count='exact').in_(
            'status', ['Planned', 'In Progress']
        ).execute()
        live_orders = orders.count if hasattr(orders, 'count') else 0
        
        # Completed today
        today = date.today().isoformat()
        completed = db.table('purchase_orders').select('id', count='exact').eq(
            'status', 'Completed'
        ).gte('updated_at', today).execute()
        completed_today = completed.count if hasattr(completed, 'count') else 0
        
        # Total materials in system
        inv_count = db.table('inventory_items').select('id', count='exact').execute()
        total_materials = inv_count.count if hasattr(inv_count, 'count') else 0
        
        # Today's gate entries
        gate_entries = db.table('gate_entries').select('id', count='exact').gte(
            'created_at', today
        ).execute()
        today_entries = gate_entries.count if hasattr(gate_entries, 'count') else 0
        
        # Active work orders
        active_wo = db.table('work_orders').select('id', count='exact').in_(
            'status', ['Planned', 'In Progress']
        ).execute()
        active_work_orders = active_wo.count if hasattr(active_wo, 'count') else 0
        
        return (
            f"Dashboard Summary (as of today):\n"
            f"  Live Purchase Orders: {live_orders} (Planned + In Progress)\n"
            f"  Active Work Orders: {active_work_orders}\n"
            f"  Completed Today: {completed_today}\n"
            f"  Total Materials in System: {total_materials}\n"
            f"  Gate Entries Today: {today_entries}\n"
            f"\nFor detailed shortages, use the shortage alerts tool."
        )
    except Exception as e:
        logger.error(f"get_dashboard_summary error: {e}")
        return f"Error fetching dashboard summary: {str(e)}"


@tool
def check_production_feasibility(product_name: str, quantity: float) -> str:
    """Check if a product can be produced in the given quantity with current inventory.
    Use when user asks 'can we produce X?', 'do we have enough materials?',
    or wants to validate before creating an order.
    
    Args:
        product_name: Product code or name
        quantity: How many units to check feasibility for
    """
    try:
        from app.database import get_db
        from decimal import Decimal
        db = get_db()
        
        # Find product
        prod = db.table('products').select('id, code, name').or_(
            f"code.ilike.%{product_name}%,name.ilike.%{product_name}%"
        ).limit(1).execute()
        
        if not prod.data:
            return f"Product '{product_name}' not found. Check the product code or name."
        
        product = prod.data[0]
        
        # Check BOM exists
        bom = db.table('boms').select('id, batch_size').eq(
            'product_id', product['id']
        ).eq('is_active', True).execute()
        
        if not bom.data:
            return (
                f"No active BOM found for {product['name']} ({product['code']}). "
                f"Create a BOM first: Sidebar → BOM → '+ Create New BOM'."
            )
        
        bom_data = bom.data[0]
        batch_size = Decimal(str(bom_data.get('batch_size', 1)))
        multiplier = Decimal(str(quantity)) / batch_size
        
        # Get BOM materials
        materials = db.table('bom_materials').select(
            'material_id, quantity, unit, scrap_percentage, products(code, name)'
        ).eq('bom_id', bom_data['id']).execute()
        
        if not materials.data:
            return f"BOM for {product['name']} has no materials defined. Add materials in BOM Planner."
        
        can_produce = True
        material_lines = []
        
        for mat in materials.data:
            mat_product = mat.get('products', {}) or {}
            mat_qty = Decimal(str(mat['quantity'])) * multiplier
            scrap_pct = Decimal(str(mat.get('scrap_percentage', 0)))
            required = mat_qty * (1 + scrap_pct / 100)
            
            # Check inventory
            inv = db.table('inventory').select('available_qty, allocated_qty').eq(
                'product_id', mat['material_id']
            ).execute()
            
            free_stock = Decimal('0')
            if inv.data:
                for r in inv.data:
                    free_stock += Decimal(str(r['available_qty'])) - Decimal(str(r['allocated_qty']))
            
            if free_stock < 0:
                free_stock = Decimal('0')
            
            shortage = required - free_stock if required > free_stock else Decimal('0')
            status = "OK" if shortage == 0 else "SHORT"
            
            if shortage > 0:
                can_produce = False
            
            material_lines.append(
                f"  {'[SHORT]' if status == 'SHORT' else '[OK]   '} "
                f"{mat_product.get('name', 'Unknown')} ({mat_product.get('code', '?')}): "
                f"Need={float(required):.2f}, Free={float(free_stock):.2f}"
                f"{f', Short by {float(shortage):.2f}' if shortage > 0 else ''} {mat['unit']}"
            )
        
        header = (
            f"Feasibility check for {product['name']} ({product['code']}) × {quantity} units:\n"
            f"Result: {'CAN PRODUCE' if can_produce else 'CANNOT PRODUCE — materials short'}\n"
        )
        
        return header + "\n".join(material_lines)
    except Exception as e:
        logger.error(f"check_production_feasibility error: {e}")
        return f"Error checking feasibility: {str(e)}"


@tool
def get_bom_for_product(product_name: str) -> str:
    """Get the active BOM (Bill of Materials) for a product — its recipe.
    Use when user asks what materials are needed, what's in the BOM,
    or the recipe for a product.
    
    Args:
        product_name: Product code or name
    """
    try:
        from app.database import get_db
        db = get_db()
        
        # Find product
        prod = db.table('products').select('id, code, name').or_(
            f"code.ilike.%{product_name}%,name.ilike.%{product_name}%"
        ).limit(1).execute()
        
        if not prod.data:
            return f"Product '{product_name}' not found."
        
        product = prod.data[0]
        
        # Get active BOM
        bom = db.table('boms').select('id, batch_size, version, notes').eq(
            'product_id', product['id']
        ).eq('is_active', True).execute()
        
        if not bom.data:
            return f"No active BOM for {product['name']} ({product['code']}). Create one in BOM Planner."
        
        bom_data = bom.data[0]
        
        # Get materials
        materials = db.table('bom_materials').select(
            'quantity, unit, unit_cost, scrap_percentage, sequence_number, products(code, name)'
        ).eq('bom_id', bom_data['id']).order('sequence_number').execute()
        
        lines = [
            f"BOM for {product['name']} ({product['code']}):",
            f"  Version: {bom_data.get('version', 1)} | Batch Size: {bom_data.get('batch_size', 1)}",
            f"  Notes: {bom_data.get('notes') or 'None'}",
            f"  Materials:"
        ]
        
        total_cost = 0
        for mat in materials.data:
            mp = mat.get('products', {}) or {}
            qty = float(mat['quantity'])
            cost = float(mat.get('unit_cost', 0))
            scrap = float(mat.get('scrap_percentage', 0))
            line_cost = qty * cost
            total_cost += line_cost
            lines.append(
                f"    {mat.get('sequence_number', '-')}. {mp.get('name', 'Unknown')} ({mp.get('code', '?')}): "
                f"Qty={qty} {mat['unit']}, Cost={cost}/unit, Scrap={scrap}%"
            )
        
        lines.append(f"  Total BOM Cost (per batch): {total_cost:.2f}")
        
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"get_bom_for_product error: {e}")
        return f"Error fetching BOM: {str(e)}"


@tool
def lookup_gate_entry(entry_number: str) -> str:
    """Look up a gate entry by its entry number.
    Use when user asks about a specific inbound shipment or gate entry.
    
    Args:
        entry_number: Gate entry number or partial match (e.g., GE-2025-0001)
    """
    try:
        from app.database import get_db
        db = get_db()
        
        result = db.table('gate_entries').select('*').ilike(
            'entry_number', f'%{entry_number}%'
        ).limit(3).execute()
        
        if not result.data:
            return f"No gate entry found matching '{entry_number}'."
        
        lines = []
        for entry in result.data:
            # Get materials
            mats = db.table('gate_entry_materials').select(
                'material_name, quantity, uom'
            ).eq('gate_entry_id', entry['id']).execute()
            
            mat_list = ", ".join(
                f"{m['material_name']} ({m['quantity']} {m['uom']})"
                for m in mats.data
            ) if mats.data else "None"
            
            lines.append(
                f"Entry: {entry['entry_number']}\n"
                f"  Type: {entry['entry_type']}\n"
                f"  Vendor: {entry.get('vendor', 'N/A')}\n"
                f"  Vehicle: {entry.get('vehicle_number', 'N/A')}\n"
                f"  Status: {entry['status']}\n"
                f"  Destination: {entry.get('destination_department', 'N/A')}\n"
                f"  Materials: {mat_list}\n"
                f"  Date: {entry['created_at']}"
            )
        
        return "\n---\n".join(lines)
    except Exception as e:
        logger.error(f"lookup_gate_entry error: {e}")
        return f"Error looking up gate entry: {str(e)}"


@tool
def list_recent_orders(status: Optional[str] = None, limit: int = 5) -> str:
    """List recent purchase orders, optionally filtered by status.
    Use when user asks to see recent orders, pending orders, or a list of orders.
    
    Args:
        status: Optional filter — one of: Planned, In Progress, Completed, On Hold, Cancelled
        limit: Number of orders to return (default 5, max 10)
    """
    try:
        from app.database import get_db
        db = get_db()
        
        if limit > 10:
            limit = 10
        
        query = db.table('purchase_orders').select(
            'order_number, status, priority, quantity, due_date, created_at, products(code, name)'
        )
        
        if status:
            query = query.eq('status', status)
        
        result = query.order('created_at', desc=True).limit(limit).execute()
        
        if not result.data:
            filter_msg = f" with status '{status}'" if status else ""
            return f"No purchase orders found{filter_msg}."
        
        lines = [f"Recent Purchase Orders{f' (Status: {status})' if status else ''}:"]
        for o in result.data:
            product = o.get('products', {}) or {}
            lines.append(
                f"  {o['order_number']} | {product.get('name', 'N/A')} | "
                f"Qty: {o['quantity']} | {o['status']} | Priority: {o.get('priority', 'N/A')} | "
                f"Due: {o.get('due_date', 'N/A')}"
            )
        
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"list_recent_orders error: {e}")
        return f"Error listing orders: {str(e)}"


@tool
def check_user_permissions(action: str) -> str:
    """Check which role is required to perform a specific action in OMNIX.
    Use when user asks if they can do something or gets a permission error.
    
    Args:
        action: The action to check permissions for, e.g. 'create_bom', 'approve_transfer',
                'delete_order', 'create_qc_inspection', 'manage_users', 'configure_stages'
    """
    permission_map = {
        "create_bom": "Planner role required. Operators and Workers cannot create or edit BOMs.",
        "edit_bom": "Planner role required.",
        "create_purchase_order": "Planner role required to create orders.",
        "edit_purchase_order": "Planner role required to edit orders.",
        "cancel_purchase_order": "Planner or Admin role required.",
        "create_work_order": "Most roles can create work orders if they have the 'working-order' module access.",
        "create_material_transfer": "Store Manager or Supervisor role required.",
        "approve_material_transfer": "Store Manager or Supervisor role required.",
        "create_material_request": "Any role can submit a material request — no special permissions needed.",
        "approve_material_request": "Store Manager or Supervisor role required for approval.",
        "create_qc_inspection": "QC Inspector role required. Must have 'qc' module access.",
        "create_gate_entry": "Security role or anyone with 'gate-entry' module access.",
        "create_gate_exit": "Security role or anyone with 'gate-exit' module access.",
        "add_inventory": "Store Manager role or anyone with 'inventory' module access.",
        "delete_anything": "Admin role required for all delete operations.",
        "manage_users": "Admin role required. Only Admins can view/edit user list, assign roles, and manage worker module access.",
        "configure_stages": "Admin role required. WIP Stage Configurations are in Settings.",
        "configure_shifts": "Admin role required. Shift Configuration is in Settings.",
        "assign_team": "Supervisor role required to assign team members to purchase orders.",
    }
    
    result = permission_map.get(action)
    if result:
        return result
    
    available = ", ".join(permission_map.keys())
    return f"Unknown action '{action}'. I can check permissions for: {available}"


# ==========================================
# COLLECT ALL TOOLS FOR REGISTRATION
# ==========================================

def get_all_tools() -> list:
    """Return all chatbot tools for LangGraph registration."""
    return [
        # Guidance
        get_module_guide,
        get_prerequisites,
        get_production_lifecycle,
        # Data lookup
        lookup_product,
        check_inventory,
        lookup_order,
        lookup_work_order,
        get_shortage_alerts,
        get_dashboard_summary,
        check_production_feasibility,
        get_bom_for_product,
        lookup_gate_entry,
        list_recent_orders,
        # Permissions
        check_user_permissions,
    ]