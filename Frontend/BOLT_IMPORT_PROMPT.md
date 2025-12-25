# OMNIX - Complete Build Prompt for Bolt
**Precision at every step.**

## 🎯 Project Overview

Build **OMNIX** - an AI-enabled, voice-ready manufacturing execution system for apparel manufacturing units in India. The system must work on web (dashboard for owners/PMs/store managers) with a bold, factory-floor-friendly design that supports **8 Indian languages** (English, Hindi, Kannada, Tamil, Telugu, Marathi, Gujarati, Punjabi) with native script display.

**Core Principle**: Replace 80% of manual clicks with AI-powered natural language commands while maintaining QR scan fallback workflows.

---

## 🎨 Design System Requirements

### **Color Palette**
- **Primary**: Emerald/Green - `bg-emerald-600`, `hover:bg-emerald-700`, `text-emerald-900`
- **Success**: Green - `bg-green-600`, `text-green-800`
- **Warning**: Amber - `bg-amber-500`, `text-amber-900`
- **Error/Urgent**: Red - `bg-red-600`, `text-red-800`
- **Info**: Blue - `bg-blue-600`, `text-blue-800`
- **Neutral**: Zinc scale - `bg-zinc-50`, `text-zinc-600`, `text-zinc-900`, `border-zinc-200`

### **UI Design Principles**
- ✅ **Bold, Factory-Floor Friendly**: High contrast, large text, clear visual hierarchy
- ✅ **Large Touch Targets**: Minimum 44px for buttons and interactive elements
- ✅ **Card-Based Layout**: Use shadcn/ui Card components with proper spacing
- ✅ **Status Badges**: Color-coded badges for all statuses (pending, completed, urgent, etc.)
- ✅ **Icons**: Use Lucide React icons throughout
- ✅ **Responsive**: Mobile-first design, works on tablets and phones
- ✅ **Clean & Modern**: Modal-based workflows, smooth transitions

### **Typography**
- Use Tailwind's default typography without custom font size classes
- Let the browser defaults handle heading sizes
- High contrast: `text-zinc-900` for headings, `text-zinc-600` for secondary text

---

## 🏗️ Technical Stack

### **Required Libraries**
```typescript
// Core
import React, { useState } from 'react';

// Icons
import { Package, Plus, Search, X, Check, AlertCircle, History, 
         ArrowLeftRight, MapPin, FileText, Calendar, User, 
         Clock, Building, Settings, LogOut, Menu } from 'lucide-react';

// UI Components (create these in /components/ui/)
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
```

### **Project Structure**
```
/
├── App.tsx (main component with navigation)
├── components/
│   ├── ProductionOrders.tsx
│   ├── BOMPlanning.tsx
│   ├── MaterialTransfer.tsx
│   ├── MaterialRequest.tsx
│   ├── InventoryDashboard.tsx
│   ├── AIAssistant.tsx
│   └── ui/
│       ├── card.tsx
│       ├── button.tsx
│       ├── input.tsx
│       └── badge.tsx
├── lib/
│   └── apparel-data.ts
└── styles/
    └── globals.css
```

---

## 📊 Data Structure (lib/apparel-data.ts)

### **Product SKUs**
```typescript
export const PRODUCT_SKUS = {
  'TSH-BLK-S': {
    name: 'Classic Cotton T-Shirt',
    variant: 'Black, Size S',
    category: 'T-Shirts',
    color: 'Black',
    size: 'S'
  },
  'HOD-NVY-M': {
    name: 'Fleece Pullover Hoodie',
    variant: 'Navy Blue, Size M',
    category: 'Hoodies',
    color: 'Navy Blue',
    size: 'M'
  },
  'TRP-GRY-L': {
    name: 'Athletic Track Pants',
    variant: 'Grey, Size L',
    category: 'Track Pants',
    color: 'Grey',
    size: 'L'
  }
  // Add more SKUs as needed
};
```

### **BOM Data (Bill of Materials)**
```typescript
export const BOM_DATA = {
  'TSH-BLK-S': {
    sku: 'TSH-BLK-S',
    productName: 'Classic Cotton T-Shirt',
    materials: [
      { name: 'Cotton Fabric (Black)', code: 'RM-FAB-1001', qty: 0.5, unit: 'kg' },
      { name: 'Sewing Thread (Black)', code: 'RM-THD-2001', qty: 150, unit: 'm' },
      { name: 'Neck Label', code: 'BOP-PKG-5001', qty: 1, unit: 'pcs' },
      { name: 'Care Label', code: 'BOP-PKG-5002', qty: 1, unit: 'pcs' },
      { name: 'Polybag', code: 'BOP-PKG-5003', qty: 1, unit: 'pcs' }
    ]
  },
  'HOD-NVY-M': {
    sku: 'HOD-NVY-M',
    productName: 'Fleece Pullover Hoodie',
    materials: [
      { name: 'Fleece Fabric (Navy)', code: 'RM-FAB-1002', qty: 0.8, unit: 'kg' },
      { name: 'Rib Fabric', code: 'RM-FAB-1003', qty: 0.2, unit: 'kg' },
      { name: 'Sewing Thread (Navy)', code: 'RM-THD-2002', qty: 300, unit: 'm' },
      { name: 'Zipper (20 inch)', code: 'RM-ZIP-3001', qty: 1, unit: 'pcs' },
      { name: 'Drawcord', code: 'RM-TRM-4001', qty: 1.5, unit: 'm' },
      { name: 'Neck Label', code: 'BOP-PKG-5001', qty: 1, unit: 'pcs' },
      { name: 'Size Label', code: 'BOP-PKG-5004', qty: 1, unit: 'pcs' },
      { name: 'Polybag', code: 'BOP-PKG-5003', qty: 1, unit: 'pcs' }
    ]
  },
  'TRP-GRY-L': {
    sku: 'TRP-GRY-L',
    productName: 'Athletic Track Pants',
    materials: [
      { name: 'Polyester Fabric (Grey)', code: 'RM-FAB-1004', qty: 0.6, unit: 'kg' },
      { name: 'Elastic Band (2 inch)', code: 'RM-TRM-4002', qty: 1, unit: 'm' },
      { name: 'Sewing Thread (Grey)', code: 'RM-THD-2003', qty: 200, unit: 'm' },
      { name: 'Drawcord', code: 'RM-TRM-4001', qty: 1.2, unit: 'm' },
      { name: 'Side Pockets (2 pcs)', code: 'RM-ACC-6001', qty: 2, unit: 'pcs' },
      { name: 'Brand Label', code: 'BOP-PKG-5005', qty: 1, unit: 'pcs' },
      { name: 'Polybag', code: 'BOP-PKG-5003', qty: 1, unit: 'pcs' }
    ]
  }
};
```

### **Inventory Stock**
```typescript
export const INVENTORY_STOCK = {
  'Cotton Fabric (Black)': { qty: 500, unit: 'kg', location: 'RM Store A', code: 'RM-FAB-1001' },
  'Fleece Fabric (Navy)': { qty: 300, unit: 'kg', location: 'RM Store B', code: 'RM-FAB-1002' },
  'Polyester Fabric (Grey)': { qty: 400, unit: 'kg', location: 'RM Store A', code: 'RM-FAB-1004' },
  'Rib Fabric': { qty: 150, unit: 'kg', location: 'RM Store A', code: 'RM-FAB-1003' },
  'Sewing Thread (Black)': { qty: 15000, unit: 'm', location: 'RM Store A', code: 'RM-THD-2001' },
  'Sewing Thread (Navy)': { qty: 12000, unit: 'm', location: 'RM Store A', code: 'RM-THD-2002' },
  'Sewing Thread (Grey)': { qty: 10000, unit: 'm', location: 'RM Store A', code: 'RM-THD-2003' },
  'Sewing Thread (White)': { qty: 18000, unit: 'm', location: 'RM Store A', code: 'RM-THD-2004' },
  'Zipper (20 inch)': { qty: 2000, unit: 'pcs', location: 'RM Store B', code: 'RM-ZIP-3001' },
  'Drawcord': { qty: 3000, unit: 'm', location: 'RM Store B', code: 'RM-TRM-4001' },
  'Elastic Band (2 inch)': { qty: 2500, unit: 'm', location: 'RM Store B', code: 'RM-TRM-4002' },
  'Neck Label': { qty: 10000, unit: 'pcs', location: 'Packaging Store', code: 'BOP-PKG-5001' },
  'Care Label': { qty: 10000, unit: 'pcs', location: 'Packaging Store', code: 'BOP-PKG-5002' },
  'Size Label': { qty: 8000, unit: 'pcs', location: 'Packaging Store', code: 'BOP-PKG-5004' },
  'Brand Label': { qty: 8000, unit: 'pcs', location: 'Packaging Store', code: 'BOP-PKG-5005' },
  'Polybag': { qty: 15000, unit: 'pcs', location: 'Packaging Store', code: 'BOP-PKG-5003' },
  'Packaging Box': { qty: 2000, unit: 'pcs', location: 'Packaging Store', code: 'BOP-PKG-5006' }
};
```

---

## 🧩 Module 1: Navigation & Layout (App.tsx)

### **Features**
1. **Top Navigation Bar** with:
   - App logo/title: "Universal MFG OS"
   - Active page indicator
   - Language selector dropdown (top-right)
   - User profile icon (optional)

2. **Sidebar Navigation** with icons:
   - 📊 Dashboard
   - 📦 Production Orders
   - 📋 BOM Planning
   - ↔️ Material Transfer
   - 📝 Material Request
   - 📊 Inventory
   - ✅ Quality Control
   - 🚚 Dispatch
   - 🤖 AI Assistant (always visible/floating)

3. **Language Selector** (8 languages):
   ```typescript
   const languages = [
     { code: 'en', name: 'English', nativeName: 'English' },
     { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
     { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
     { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
     { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
     { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
     { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
     { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' }
   ];
   ```

4. **Responsive Layout**:
   - Mobile: Bottom navigation or hamburger menu
   - Tablet/Desktop: Sidebar navigation
   - All content in main area with proper padding

---

## 🧩 Module 2: Production Orders Component

### **Features**

1. **Header Section**:
   - Title: "Production Orders"
   - Subtitle: "Manage production orders from planning to dispatch"
   - "New Order" button (emerald, with Plus icon)
   - Search bar with Search icon

2. **Filter Tabs**:
   - All Orders
   - Pending (yellow badge)
   - In Production (blue badge)
   - QC Pending (amber badge)
   - Completed (green badge)
   - Dispatched (gray badge)

3. **Order Cards Grid** (responsive: 1 col mobile, 2 col tablet, 3 col desktop):
   Each card shows:
   - PO Number (e.g., "PO-2025-001") with status badge
   - Product: SKU name and variant
   - Quantity: Large bold number with "units" label
   - Delivery Date: Calendar icon + date
   - Progress bar (visual indicator)
   - Timeline: Order Date → Delivery Date
   - "View Details" button

4. **Sample Data** (at least 6 orders):
   ```typescript
   {
     id: 'PO-2025-001',
     sku: 'TSH-BLK-S',
     productName: 'Classic Cotton T-Shirt',
     quantity: 5000,
     orderDate: '2025-11-25',
     deliveryDate: '2025-12-10',
     status: 'in_production',
     progress: 45
   }
   ```

5. **Status Colors**:
   - Pending: `bg-yellow-100 text-yellow-800 border-yellow-300`
   - In Production: `bg-blue-100 text-blue-800 border-blue-300`
   - QC Pending: `bg-amber-100 text-amber-800 border-amber-300`
   - Completed: `bg-green-100 text-green-800 border-green-300`
   - Dispatched: `bg-zinc-100 text-zinc-800 border-zinc-300`

6. **Search Functionality**:
   - Filter by PO number, product name, SKU
   - Real-time filtering as user types
   - Show "No orders found" message with icon when empty

---

## 🧩 Module 3: BOM Planning Component

### **Features**

1. **Header Section**:
   - Title: "BOM Planning"
   - Subtitle: "Bill of Materials for production planning"
   - Search bar for SKUs

2. **Two-Panel Layout**:

   **Left Panel - Product Selection**:
   - Grid of product cards (T-Shirts, Hoodies, Track Pants)
   - Each card shows:
     - Product image placeholder or icon
     - Product name
     - SKU code
     - Category badge
     - "View BOM" button

   **Right Panel - BOM Details** (shows when product selected):
   - Product header with SKU and name
   - "Calculate for Quantity" input field
   - Materials table with columns:
     - Material Name
     - RM/BOP Code (badge)
     - Quantity per unit
     - Total Quantity (calculated)
     - Unit (kg, m, pcs)
     - Available Stock
     - Status (Available/Low Stock/Out of Stock)
   - Summary card at bottom:
     - Total Raw Materials: X items
     - Total Packaging: Y items
     - Stock Status: All Available / Some Low / Out of Stock

3. **Stock Status Indicators**:
   - Green check icon: Available
   - Yellow alert: Low Stock
   - Red X: Out of Stock

4. **Quantity Calculator**:
   - Input field: "Calculate materials for ___ units"
   - Multiplies each material requirement
   - Shows total vs available stock
   - Highlights shortages in red

---

## 🧩 Module 4: Material Transfer Component ⭐ (CRITICAL)

### **Features**

1. **Tab Navigation**:
   - "New Transfer" tab (default)
   - "Transfer History" tab

2. **New Transfer Tab**:

   **Material Selection Section**:
   - Section title: "Select Material to Transfer"
   - Material count: "X materials" (shows filtered count)
   
   **Search Bar** (prominent placement):
   - Search icon on left
   - Placeholder: "Search materials..." (multi-language)
   - Clear button (X) appears when typing
   - Filters by:
     - Material name
     - RM/BOP code
     - Location
   
   **Material Cards Grid** (3 cols desktop, 2 tablet, 1 mobile):
   Each card shows:
   - Package icon (top-left)
   - RM/BOP Code badge (top-right) - e.g., "RM-FAB-1001"
   - Material name (bold)
   - Location with MapPin icon
   - Stock quantity (large) + unit (small)
   - Hover effect: border changes to emerald, background to emerald-50
   - Click: Opens transfer modal

3. **RM/BOP Code System**:
   ```typescript
   // Fabric materials
   RM-FAB-1001, RM-FAB-1002, RM-FAB-1003...
   
   // Thread & Sewing
   RM-THD-2001, RM-THD-2002, RM-THD-2003...
   
   // Zippers
   RM-ZIP-3001, RM-ZIP-3002...
   
   // Trims (Elastic, Drawcord)
   RM-TRM-4001, RM-TRM-4002...
   
   // Packaging (BOP)
   BOP-PKG-5001, BOP-PKG-5002, BOP-PKG-5003...
   
   // Accessories
   RM-ACC-6001, RM-ACC-6002...
   ```

4. **Transfer Modal** (opens on card click):
   - **Modal Header**:
     - ArrowLeftRight icon in emerald circle
     - Title: "Transfer Material"
     - Material name as subtitle
     - Close button (X)
   
   - **Available Stock Card** (zinc-50 background):
     - "Available Stock" label
     - Large quantity display
     - Current location with MapPin icon
     - RM/BOP code badge
   
   - **Transfer Form**:
     - Transfer Quantity: Number input with UOM display
     - From Location: Read-only display (current location)
     - To Location: Dropdown with 8 locations:
       - RM Store A
       - RM Store B
       - Cutting Floor
       - Sewing Floor
       - Finishing Floor
       - QC Floor
       - Packing Floor
       - FG Warehouse
     - Transfer Reason: Dropdown
       - Production Requirement
       - Restocking
       - Quality Issue
       - Maintenance
       - Emergency
       - Other
   
   - **Validation Rules**:
     - Quantity must be > 0
     - Quantity cannot exceed available stock
     - Destination must be selected
     - Source and destination cannot be same
     - Reason must be selected
     - Show red border + error message with AlertCircle icon
   
   - **Modal Footer**:
     - "Cancel" button (outline)
     - "Confirm Transfer" button (emerald, with Check icon)

5. **Transfer History Tab**:
   - List of transfer cards showing:
     - Transfer ID (e.g., "TRF-1001")
     - Status badge
     - Material name
     - Quantity
     - From location → To location
     - Date
     - "View Details" button
   
   - Sample history data (3-5 records):
     ```typescript
     {
       id: 'TRF-1001',
       material: 'Cotton Fabric (Black)',
       materialCode: 'RM-FAB-1001',
       quantity: '50 kg',
       from: 'RM Store A',
       to: 'Cutting Floor',
       status: 'completed',
       date: '2025-11-30',
       reason: 'Production Requirement'
     }
     ```

---

## 🧩 Module 5: Material Request Component

### **Features**

1. **Header**:
   - Title: "Material Requests"
   - Subtitle: "Request materials for production departments"
   - "New Request" button (emerald, with Plus icon)

2. **Filter/Status Tabs**:
   - All Requests
   - Pending (yellow badge with count)
   - Approved (green badge)
   - Rejected (red badge)
   - In Process (blue badge)
   - Completed (gray badge)

3. **Request Cards Grid**:
   Each card shows:
   - Request ID (e.g., "MRQ-2025-001")
   - Status badge and Priority badge side-by-side
   - Department badge (Cutting/Sewing/Finishing/Packing)
   - Material name with RM/BOP code
   - Requested quantity + unit
   - Required date with Calendar icon
   - Request type
   - Requested by (user name)
   - Action buttons: "Approve" / "Reject" / "View Details"

4. **New Request Modal**:
   - Department: Dropdown (Cutting, Sewing, Finishing, Packing)
   - Material: Searchable dropdown (from inventory)
   - RM/BOP Code: Auto-filled based on material
   - Quantity: Number input
   - Unit: Display only (from material)
   - Request Type: Dropdown
     - Production Requirement
     - Emergency Requirement
     - Quality Replacement
     - Sample Development
   - Priority: Dropdown with colors
     - Low (green)
     - Medium (blue)
     - High (amber)
     - Urgent (red)
   - Required Date: Date picker
   - Purpose/Notes: Textarea

5. **Sample Data** (at least 5 requests):
   ```typescript
   {
     id: 'MRQ-2025-001',
     department: 'Cutting',
     material: 'Cotton Fabric (Black)',
     materialCode: 'RM-FAB-1001',
     quantity: 100,
     unit: 'kg',
     requestType: 'Production Requirement',
     priority: 'high',
     requiredDate: '2025-12-05',
     purpose: 'Urgent order PO-2025-003',
     status: 'pending',
     requestedBy: 'Rajesh Kumar',
     requestDate: '2025-12-02'
   }
   ```

6. **Priority Colors**:
   - Low: `bg-green-100 text-green-800`
   - Medium: `bg-blue-100 text-blue-800`
   - High: `bg-amber-100 text-amber-800`
   - Urgent: `bg-red-100 text-red-800`

---

## 🧩 Module 6: Inventory Dashboard

### **Features**

1. **Header with Summary Cards** (4 cards in row):
   - Total Materials: Count + icon
   - Low Stock Items: Count with warning icon
   - Total Value: ₹ amount
   - Stock Locations: Count

2. **Filters Section**:
   - Search bar
   - Category filter: All / Fabrics / Threads / Trims / Packaging / Accessories
   - Location filter: Dropdown
   - Stock status filter: All / Available / Low Stock / Out of Stock

3. **Inventory Table/Grid**:
   Columns:
   - Material Name
   - RM/BOP Code (badge)
   - Category (badge)
   - Current Stock (bold quantity + unit)
   - Location (with MapPin icon)
   - Status indicator (colored dot + label)
   - Min Stock Level
   - Last Updated
   - Actions: "Transfer" / "Request" buttons

4. **Stock Status Indicators**:
   - Green dot: Available (>50% of max)
   - Yellow dot: Low Stock (10-50% of max)
   - Red dot: Critical (<10% of max)

5. **Empty State**:
   - Package icon
   - "No materials found"
   - "Try adjusting your filters"

---

## 🧩 Module 7: AI Assistant Component

### **Features**

1. **Floating Button** (bottom-right corner):
   - Circular emerald button with sparkle/robot icon
   - Badge showing "AI" or robot emoji
   - Pulse animation
   - Click to open chat panel

2. **Chat Panel** (slides from right):
   - Header:
     - "AI Manufacturing Assistant" title
     - Language indicator
     - Close button
   - Chat messages area:
     - User messages: right-aligned, emerald background
     - AI messages: left-aligned, zinc-100 background
     - Timestamp for each message
     - Typing indicator (3 dots animation)
   - Input area:
     - Text input field
     - Microphone button (for voice - show as disabled for now)
     - Send button (emerald)

3. **Sample Conversation** (preloaded):
   ```
   AI: "Hello! I'm your manufacturing assistant. How can I help you today?"
   User: "Show me all pending production orders"
   AI: "I found 3 pending production orders:
        - PO-2025-001: 5000 T-Shirts
        - PO-2025-004: 2000 Hoodies
        - PO-2025-007: 3000 Track Pants
        Would you like details on any of these?"
   ```

4. **Quick Actions** (buttons above input):
   - "Check Stock"
   - "Create Transfer"
   - "View Orders"
   - "Material Request"

---

## 🌐 Multi-Language Implementation

### **Translation Structure**

Each component must have translations object:

```typescript
const translations = {
  en: {
    title: 'Material Transfer',
    subtitle: 'Transfer materials between locations',
    searchMaterial: 'Search materials...',
    availableStock: 'Available Stock',
    // ... all strings
  },
  hi: {
    title: 'सामग्री स्थानांतरण',
    subtitle: 'स्थानों के बीच सामग्री स्थानांतरित करें',
    searchMaterial: 'सामग्री खोजें...',
    availableStock: 'उपलब्ध स्टॉक',
    // ... all strings
  },
  // ... repeat for kn, ta, te, mr, gu, pa
};

const t = translations[language] || translations.en;
```

### **Required Translations**

Provide at minimum English and Hindi translations for all:
- Page titles and subtitles
- Button labels
- Form labels
- Status labels
- Error messages
- Placeholder text
- Search placeholders
- Empty state messages

---

## 🎨 UI Components (components/ui/)

### **Card Component**
```typescript
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  );
}
```

### **Button Component**
```typescript
export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '',
  ...props 
}: ButtonProps) {
  const baseStyles = 'rounded-lg font-medium transition-colors flex items-center justify-center';
  
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    outline: 'border-2 border-zinc-300 text-zinc-700 hover:bg-zinc-50',
    ghost: 'text-zinc-700 hover:bg-zinc-100',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

### **Input Component**
```typescript
export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${className}`}
      {...props}
    />
  );
}
```

### **Badge Component**
```typescript
export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}
```

---

## 🎯 Critical Implementation Details

### **1. Material Transfer Search**
- Must filter in real-time as user types
- Must search across: material name, RM/BOP code, location
- Must show filtered count: "X materials"
- Clear button (X) must appear only when search has text

### **2. RM/BOP Code Generation**
```typescript
// Auto-generate codes based on material type
if (name.includes('fabric')) return `RM-FAB-${1001 + index}`;
if (name.includes('thread')) return `RM-THD-${2001 + index}`;
if (name.includes('zipper')) return `RM-ZIP-${3001 + index}`;
if (name.includes('elastic') || name.includes('drawcord')) return `RM-TRM-${4001 + index}`;
if (name.includes('label') || name.includes('polybag') || name.includes('box')) return `BOP-PKG-${5001 + index}`;
return `RM-ACC-${6001 + index}`;
```

### **3. Modal Implementation**
- Fixed positioning: `fixed inset-0`
- Dark overlay: `bg-black/50 z-50`
- Centered content: `flex items-center justify-center`
- Scrollable content: `max-h-[90vh] overflow-y-auto`
- Sticky header and footer
- Click outside to close (optional)

### **4. Status Badge Colors**
Must be consistent across all modules:
- Pending: `bg-yellow-100 text-yellow-800 border-yellow-300`
- In Progress / In Production: `bg-blue-100 text-blue-800 border-blue-300`
- Completed / Approved: `bg-green-100 text-green-800 border-green-300`
- Rejected / Failed: `bg-red-100 text-red-800 border-red-300`
- Urgent: `bg-red-100 text-red-800 border-red-300`
- High: `bg-amber-100 text-amber-800 border-amber-300`

### **5. Responsive Grid Classes**
- Mobile (default): `grid-cols-1`
- Tablet (md): `md:grid-cols-2`
- Desktop (lg): `lg:grid-cols-3`
- Full pattern: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`

### **6. Form Validation**
- Show red border on error: `border-red-500`
- Show error message below field with AlertCircle icon
- Prevent form submission until all validations pass
- Clear errors when user starts typing

---

## 🚀 Build Order

### **Phase 1: Foundation**
1. Create UI components (Card, Button, Input, Badge)
2. Create data file (apparel-data.ts) with all SKUs, BOMs, Inventory
3. Set up App.tsx with navigation and language selector
4. Implement language switching logic

### **Phase 2: Core Modules**
5. Build Production Orders component (with search and filters)
6. Build BOM Planning component (with calculator)
7. Build Inventory Dashboard

### **Phase 3: Material Management** ⭐
8. Build Material Transfer component with:
   - Search functionality
   - RM/BOP codes
   - Transfer modal with validation
   - Transfer history
9. Build Material Request component

### **Phase 4: Additional Features**
10. Build AI Assistant (basic chat UI)
11. Add Quality Control module (basic)
12. Polish and test all interactions

---

## ✅ Success Criteria

The implementation is complete when:

- ✅ All 7+ modules are functional with proper navigation
- ✅ Language selector works and shows all 8 languages in native scripts
- ✅ Material Transfer has working search that filters by name, code, and location
- ✅ All RM/BOP codes are properly generated and displayed
- ✅ Transfer modal has complete validation and prevents invalid transfers
- ✅ All status badges use correct colors consistently
- ✅ Design is responsive (mobile, tablet, desktop)
- ✅ UI is bold, factory-floor friendly with high contrast
- ✅ At minimum, English and Hindi translations are complete
- ✅ All sample data is realistic apparel manufacturing data
- ✅ Cards have proper hover effects and interactions
- ✅ Modals have proper styling with sticky headers/footers

---

## 🎯 Key Differentiators

What makes this MFG OS unique:

1. **AI-First**: Natural language interface (even if basic initially)
2. **Multi-Language**: 8 Indian languages with native scripts
3. **Factory-Optimized**: Bold UI, large targets, high contrast
4. **Real Apparel Data**: T-Shirts, Hoodies, Track Pants with actual BOMs
5. **RM/BOP Coding**: Industry-standard material coding system
6. **Smart Search**: Search materials by name, code, or location
7. **Complete Workflow**: PO → BOM → Transfer → Request → QC → Dispatch
8. **Modal-Based**: Clean, modern UX with modal workflows

---

## 📝 Final Notes

- Use Tailwind CSS for all styling (no custom CSS files except globals.css)
- Use Lucide React for all icons
- Keep components modular and reusable
- Add proper TypeScript types
- Include loading states for better UX
- Add empty states with helpful messages
- Make all interactive elements accessible (keyboard navigation)
- Test on mobile viewport (375px) and desktop (1920px)

**Start with Material Transfer module as it's the most complex with search, codes, and modal validation.**

---

Build this as a production-ready manufacturing execution system that can actually be deployed in Indian apparel factories. Good luck! 🏭✨