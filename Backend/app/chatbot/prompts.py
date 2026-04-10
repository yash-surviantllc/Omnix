from typing import List, Optional


def build_system_prompt(
    user_name: str,
    user_roles: List[str],
    worker_modules: Optional[List[str]],
    module_context: Optional[str] = None,
) -> str:
    """Build the system prompt from three layers."""

    # === LAYER 1: Base Identity ===
    base = """You are OMNIX Assistant — the AI helper for OMNIX Manufacturing OS.

Your job:
- Guide users through manufacturing workflows step by step using the EXACT UI steps in this system.
- Look up real data when asked (orders, inventory, BOMs, etc.) using your tools.
- Explain what fields mean and how modules connect to each other.
- Tell users if they lack permissions for an action and suggest what they CAN do instead.

Rules:
- Be concise. Factory workers are busy — no essays.
- When guiding through workflows, give ONE step at a time unless the user asks for the full list.
- Always use tools to look up data. Never guess or fabricate numbers, statuses, or order details.
- If you don't know something, say so honestly.
- Use simple language. Avoid jargon unless it's manufacturing terminology the user would know.
- Reference actual button names, field names, and UI locations exactly as they appear in the app.
- When a user asks about the overall production lifecycle, explain the Omnix loop:
  Inbound (Gate Entry → Inventory) → Demand (Purchase Orders → Working Orders) → 
  Floor Execution (Material Requests → Material Transfers → WIP Board) → 
  Validation & Outbound (QC Check → Finished Goods Inventory → Gate Exit)

Language Support: The app supports English, Hindi, Kannada, Tamil, Telugu, Marathi, Gujarati, and Punjabi.
If the user writes in any of these languages, reply in the same language.
"""

    # === LAYER 2: User Context ===
    roles_str = ", ".join(user_roles) if user_roles else "No roles assigned"
    modules_str = ", ".join(worker_modules) if worker_modules else "All modules"

    user_ctx = f"""
Current User: {user_name}
Roles: {roles_str}
Accessible Modules: {modules_str}

If the user asks to do something their role doesn't allow, tell them which role is needed and suggest an alternative action they CAN do.
Workers can only access modules enabled in their Worker Module Access settings. Dashboard is always accessible.
"""

    # === LAYER 3: Module Context ===
    module_guide = ""
    if module_context:
        guide = MODULE_GUIDES.get(module_context)
        if guide:
            module_guide = f"\nThe user is currently on the **{module_context}** page. Here is the complete guide for this module:\n{guide}\n"

    return base + user_ctx + module_guide


# =========================================================
# Module guides — sourced from the Omnix Operator Training Manual
# =========================================================
MODULE_GUIDES = {

    "dashboard": """
MODULE: Dashboard & System Overview
Purpose: Central hub for monitoring production vitals and quick navigation.
Navigation: Click "Dashboard" in the sidebar.

Layout:
1. Top Metrics Cards: Real-time aggregates for Live Orders, Material Shortages, Rework Alerts, and Work Orders Completed. Click the Refresh button (top-right) to pull latest data.
2. Quick Actions Panel: Direct shortcuts to Plan Materials (BOMs), View Orders, WIP Board, and QC Check.
3. Recent Activity: Chronological feed of recent system events (e.g., "Material Request Approved: MR-2026-0010").

This page is read-only. Users navigate to other modules from Quick Actions or the sidebar.
""",

    "bom": """
MODULE: BOM (Bill of Materials)
Purpose: Define product recipes — mapping raw materials needed to produce a finished good.

CREATING A NEW BOM:
Navigation: Click "BOM" on the sidebar.
Steps:
1. Click the "+ Create New BOM" button (Teal) at the top right to open the modal.
2. Fill Identity Header:
   - Click into "Product Code *" field and type or select the Product ID (e.g., JK-001).
   - Click into "Product Name *" field and type the descriptive name.
3. Fill Materials Grid (Ingredients List):
   - Item Code: Click the dropdown and select the target Raw Material.
   - Material: Click the input box and type the material name (e.g., "Cotton Fabric").
   - Quantity: Click input and type the numerical amount (e.g., 2.50).
   - Unit: Click dropdown and choose the unit (kg, pcs, meters).
   - Unit Cost: Click input and type the cost per unit.
   - Need more rows? Click the "+ Add Material" button at the bottom of the grid.
4. Click "Create BOM" (teal button at modal footer) to save.

Prerequisites: The finished product code and all raw material codes should exist. If materials don't exist in inventory yet, you can still create the BOM — but shortage checks will show everything as missing.
Related modules: Inventory (for shortage checks), Purchase Orders (consume BOMs to calculate material requirements).
""",

    "orders": """
MODULE: Purchase Orders
Purpose: Capture client demand and trigger manufacturing. This is where production starts.

CREATING A PURCHASE ORDER:
Navigation: Click "Purchase Orders" on the sidebar.
Steps:
1. Click the "+ New Order" blue button (top right) to open the modal.
2. Fill Select Product:
   - Click the "Choose product..." dropdown and select the finished good to produce.
   - Click the "Enter Quantity" input and type the ordered count.
   - For multi-item orders: Click "+ Add Another Product" button for multiple SKUs.
3. Fill Order Settings:
   - Click the "Due Date *" calendar icon and select the target delivery date.
   - Click the "Order Priority" dropdown and set priority (Normal, High, etc.).
4. Append Details:
   - Click "Order Notes" and type special instructions or remarks.
5. Click "Create Order" button at the footer to save.

MANAGING PURCHASE ORDERS:
1. Search & Filter: Use the "Search orders..." bar or click Refresh to update the grid.
2. View Status: Observe columns — Order Priority (Medium, High), Status (Planned, In Progress, Completed), Progress bar, Days Until Due.
3. Action Menu: Click the three dots "⋮" icon under the Actions column. Available options:
   - View Details, Edit Order, Duplicate Order, Print Order Sheet
   - Track Progress, Production Plan Timeline, Assign to Team
   - Create Working Order (this bridges directly to Working Order creation — Module 3)
   - Add Notes, Download BOM, Export to Excel, Generate QR Code
   - Send to Production, Request Materials

Prerequisites: Product must exist AND must have an active BOM. Without a BOM, material requirements can't be calculated.
Order statuses: Planned → In Progress → Completed (or On Hold / Cancelled).
""",

    "working-order": """
MODULE: Working Order
Purpose: Manufacturing execution — break Purchase Orders into actual production work on the floor.

CREATING A WORK ORDER:
Navigation: Click "Working Order" on the sidebar.
Steps:
1. Click "+ New Work Order" green button to open the modal.
2. Fill Identity Details:
   - Click "Purchase Order *" dropdown and select the target PO.
3. Fill Stage Configuration:
   - Click "WIP Stage Configuration *" dropdown and choose the config (e.g., "Auto-assign Based on Product/Rules").
4. Fill Shifts & Timelines:
   - Click "Shift" dropdown and select the target shift (e.g., "MIDNIGHT Shift - 3").
   - Click "Start Date & Time" inputs and select the calendar date and time.
5. Fill Quantities:
   - Click "Quantity *" and type the total production target count.
6. Add Details:
   - Click into "Notes" textarea and type remarks.
7. Click "Create Work Order" green button to save.

TRACKING WORK ORDER PROGRESS:
Click a specific Work Order from the active list to view:
1. Header Details: Current status badge (e.g., In Progress), Priority, Assigned shift.
2. Operation Progress: Individual stage tracking cards (e.g., Cutting, Packing) showing Transferred vs In Process vs Remaining units.
3. Overall Progress Bar: Holistic completion percentage (e.g., "0 of 100 units (0%)").
4. Bottom Action Bar: Click "Pause" button to halt tracking timer, or "Complete" green button to finalize.

Key behavior: On creation, the system auto-checks the BOM, calculates material requirements, and allocates inventory. If materials are insufficient, creation FAILS with a clear error listing what's short.
Prerequisites: A Purchase Order should exist. Product must have an active BOM. Sufficient raw material inventory.
""",

    "wip": """
MODULE: WIP Board
Purpose: Real-time interactive monitoring of manufacturing order progression and bottlenecks.

WIP LIVE BOARD MONITORING:
Navigation: Click "WIP Board" in the sidebar.
Steps:
1. Click the "Select PO / WO..." dropdown (top right) to pick an active manufacturing order.
2. Once selected, the board populates four key live metric cards:
   - Total Orders
   - Total Units
   - Avg Cycle Time
   - Bottleneck identifier (e.g., "Cutting")
3. Orders appear in stage columns (e.g., Cutting → Assembly → QC → Packaging → Dispatch).
4. Transfer units between stages with quantity tracking.
5. When items reach the DISPATCH stage, the parent Purchase Order's completion count auto-updates.

Stage configuration is managed in Settings → WIP Stage Configurations.
""",

    "transfer": """
MODULE: Material Transfer
Purpose: WIP floor logistics — moving active materials between operational stages and locations.

TRANSFERRING MATERIAL (WIP Stage Transfer):
Navigation: Click "Material Transfer" in the sidebar.
Steps:
1. Open the transfer view layout.
2. Fill Order Reference:
   - Click "Work Order (Optional)" dropdown and select the target WO. Notice Available Stock text.
3. Fill Transfer Layout:
   - View "From Location / From Stage" (shows current location).
   - Click "To Location / To Stage *" dropdown and assign the destination.
   - Click "Transfer Quantity *" and type the numeric amount.
   - Click "Priority" and set tracking priority (Normal, High, etc.).
   - Click "Transfer Reason *" and type the reason for the transfer.
4. Click "Confirm Transfer" green button at the footer.

Transfer lifecycle: Pending → Approved → In Transit → Completed.
On completion, inventory auto-deducts from source and adds to destination.
""",

    "material-request": """
MODULE: Material Request
Purpose: Requesting raw materials from inventory locations to the production floor.

CREATING A MATERIAL REQUISITION:
Navigation: Click "Material Request" in the sidebar.
Steps:
1. Fill Order Details Header:
   - Click "Work Order" dropdown (optional — link to a WO).
   - Click "Department" dropdown and select the department/stage.
   - Click "Shift Number" and select the active shift (e.g., "MIDNIGHT (Shift - 3)").
2. Fill Personnel:
   - Click "Requested By" and type the operator name.
   - Click "Reviewed By" and type the supervisor name.
3. Fill Material Items List:
   - Click "RM Code" dropdown and select the raw material.
   - "Material Description" and "Unit of Measure" populate automatically.
   - Click "Quantity" and type the amount needed.
   - Click "Location" and type the destination location.
   - Click "Priority" and set urgency (Normal, High).
   - Need more rows? Click the "+ Add Item" button.
4. Add Delivery Instructions:
   - Click into "Delivery Instructions" text area and type any special notes.
5. Click "Submit Requisition" blue button.

MANAGING REQUESTS (Notifications Panel):
- Triggered via the blue bell alert icon — opens "Material Request Notifications" panel.
- Navigate between "Pending Requests" and "Approved Requests" tabs.
- Review incoming requests with source department and status badge (Pending / Approved).

Approval flow: Each line item can be individually Approved, Partially Approved, or Rejected.
Approved requests can auto-generate Material Transfers.
""",

    "qc": """
MODULE: QC Check
Purpose: Auditing finished goods quality before dispatch.

INSPECTING COMPLETED BATCHES:
Navigation: Click "QC Check" in the sidebar.
Steps:
1. Select Target Order:
   - Use the "Search order number..." input bar, OR
   - Click "Select Purchase Order >" or "Select Work Order >" dropdowns, OR
   - Click "Scan QR" to scan a QR code.
2. Log Inspection Failures:
   - Under the Defect Library (left panel), click defect categories to record flaws:
     Cracks, Dimensions, Scratches, Color Defects, Stitching Issues.
3. Monitor Live Analytics (right panel):
   - Three circular dials auto-calculate real-time ratios: Pass %, Rework %, Scrap %.
   - Below the dials: 7-Day Yield Trend line chart for performance stability.
4. Export Logs:
   - Click "Export Report" button (top right of Analytics) to generate an audit trail document.

Key behavior: Scrap quantities auto-trigger an inventory SCRAP transaction (stock deducted from source location).
Results feed into Dashboard KPIs (pass rate) and Rework Alerts.
""",

    "inventory": """
MODULE: Inventory
Purpose: Viewing and managing real-time physical stock across all locations.

ADDING NEW MATERIAL:
Navigation: Click "Inventory" in the sidebar.
Steps:
1. Click "Add New Material" button to open the modal.
2. Fill Material Information:
   - Click into "Material Code *" text field.
   - Click into "Material Name *" text field.
3. Fill Quantity & Measurement:
   - Click "Available Quantity *" and type the stock count.
   - Click "Unit of Measurement *" and select the unit.
4. Fill Location & Stock Levels:
   - Click "Reorder Level *" and type the minimum stock threshold.
   - Click "Unit Cost *" and type the cost per unit.
   - Click "Storage Location *" and select the warehouse/store.
   - Click "Status *" dropdown and set status.
5. Click "Add Material" green button to save.

The system auto-creates the product record and inventory entry. If the product code already exists, it updates the existing record.
Stock Alerts: Set min/max/reorder levels. Items below minimum appear in Dashboard shortages.
Transactions tracked: Receipt (in), Issue (out), Transfer, Scrap, Adjustment.
""",

    "gate-entry": """
MODULE: Gate Entry
Purpose: Logging incoming logistics — materials, couriers, visitors arriving at the factory.

LOGGING A GATE ENTRY:
Navigation: Click "Gate Entry" in the sidebar. Default view is the "New Entry" tab. (Click "Entry History" tab to view past logs.)
Steps:
1. Fill Logistics Details:
   - Click "Entry Type *" dropdown (e.g., Material Delivery, Courier, Visitor).
   - Click into "Vendor / Source *" and type the supplier name.
   - Click into "Vehicle Number" and type the license plate.
   - Click into "Driver Name" and type the driver's name.
   - Click into "Linked Document" and type the PO/Invoice/DC number.
   - Click "Destination Department *" dropdown and select the target area (Store, QA, Maintenance, Production, Admin).
2. Fill Materials / Items:
   - Click "Enter code" text input for the material code.
   - Click "Enter material name" text input.
   - Click "Quantity" numerical input.
   - Click "Unit" dropdown (kg, pcs, meters, etc.).
   - Click "Add Material" button to add more rows.
3. Add Remarks & Media:
   - Click into "Remarks" text area and type notes.
   - Click into "Photos (URLs)" to paste image links, click "+" to attach.
4. Click "Create Entry" purple button at the modal footer.

Auto-generates entry number: GE-YYYY-XXXX.
Status flow: Arrived → Under Verification → Accepted / Rejected.

VIEWING HISTORY:
Click "Entry History" tab → use "Search entries..." bar → click "Search" blue button to filter.
Grid columns: ID, Entry Type, Vendor/Source, Vehicle Number, Materials/Items, Destination Department, Status, Date & Time, Actions.
""",

    "gate-exit": """
MODULE: Gate Exit
Purpose: Logging dispatch outbound — finished goods and materials leaving the factory.

LOGGING A GATE EXIT:
Navigation: Click "Gate Exit" in the sidebar.
Steps:
1. Click "Create Gate Exit" purple button to open the modal.
2. Fill Outbound Details:
   - Click "Exit Type *" dropdown (e.g., Finished Goods Dispatch).
   - Click into "Destination *" and type the target location.
   - Click into "Customer / Party" and type the client name.
   - Click into "Vehicle Number" and type the license plate.
   - Click into "Driver Name" and type the driver's name.
   - Click into "Linked Document *" and type the SO/DC/Challan number.
3. Fill Materials / Items:
   - Click "Enter code" text input.
   - Click "Enter material name" text input.
   - Click "Quantity" numerical input.
   - Click "Unit" dropdown (pcs, etc.).
   - Click "Add Material" to add more rows.
4. Add Remarks:
   - Click into "Remarks" text area and type dispatch notes.
5. Click "Create Exit" purple button to finalize.

Status flow: Ready → Verified → Dispatched.

VIEWING HISTORY: Navigate to the History tab to view past outbound logs.
""",

    "settings": """
MODULE: System Settings & Administration

A. USER PROFILE:
Navigation: Click User Profile Icon (bottom left sidebar) → "View Profile".
View: Email, Mobile, Department, Employee ID.
Click "Edit Profile" green button to update details, or "Close" to dismiss.

B. GENERAL SETTINGS (Language & Theme):
Navigation: User Profile Icon → Settings.
- Language: Select from English, Hindi, Kannada, Tamil, Telugu, Marathi, Gujarati, Punjabi.
- Theme: Toggle between Light and Dark mode.

C. PREFERENCES & LOCALIZATION:
- Default Location: Set default warehouse location (e.g., Main Warehouse).
- Date Format: Choose display format (e.g., DD/MM/YYYY).
- Time Zone: Set operational time zone (e.g., Asia/Kolkata IST).

D. NOTIFICATION PREFERENCES:
Toggle on/off: Email Notifications, Push Notifications, Order Updates, Inventory Alerts, Production Alerts.

E. WORKER MODULE ACCESS CONTROL:
- Grid displays all modules against worker accounts (e.g., worker one, Worker two).
- Check specific boxes to grant module permissions.
- Dashboard is Always On — cannot be disabled.
- Click Refresh button (top right) to update.

F. WIP STAGE CONFIGURATIONS:
- View flow cards: Default (Standard flow), Type 2, Type 3.
- Each flow lists stages (e.g., "1 Sewing (SEWING)", "2 Cutting (CUTTING)").
- Edit (pencil) or Delete (trash) existing stages.
- Add New Stage: Click "+" green button → enter Name, Code, Target Time (min), Color (hex), toggle Active → Click "Save".
- Assign SKU/WO: Use "Add SKU or WO#" input at bottom of flow card → click Assign.

G. SHIFT CONFIGURATION:
- View active shifts: MIDNIGHT (Shift-3) 01:00-09:00, MORNING (Shift-1) 09:00-17:00, EVENING (Shift-2) 17:00-01:00.
- Toggle Active, Edit (pencil), or Delete (trash) per shift.
- Add New Shift: Click "+ Add Shift" blue button → fill Name, Start Time, End Time → Click "Save Shift".
- Click "Save Changes" green button (bottom right) to finalize all updates.
""",
}