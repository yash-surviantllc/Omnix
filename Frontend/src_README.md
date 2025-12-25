# 🏭 OMNIX - Precision at every step.

## ✅ System Status: PRODUCTION READY

### 🚀 What's Built:

#### 1. **Complete Manufacturing Dashboard**
- Real-time production tracking for 3 apparel SKUs (T-Shirts, Hoodies, Track Pants)
- Production Orders: PO-1001, PO-1002, PO-1003
- WIP Board with 5-stage workflow (Cutting → Sewing → Finishing → QC → Packing)
- Inventory management with 13 raw materials
- Material transfer system
- **🆕 Dedicated Material Request page** with form UI
- QC check workflows

#### 2. **AI Material Request System** 🆕
- **200+ material aliases** in 8 Indian languages
- **Multi-department support** (Cutting, Sewing, Finishing, QC, Maintenance, etc.)
- **Smart stock validation** (Primary → Secondary warehouse → Purchase)
- **Partial stock handling** with 3 options
- **Mixed-language support** (Hinglish, Kanglish, Tanglish)
- **Approval routing** (Supervisor → Manager → Procurement)

#### 3. **AI Chatbot Assistant**
- Natural language processing in 8 languages
- Material requests, BOM creation, stock checks
- Production order tracking
- Shortage detection

### 📱 Try These Commands in the Chatbot:

```
English:
✓ "Request 50 kg Cotton Fabric for Cutting"
✓ "Show BOM for TS-001"
✓ "Stock status of Thread"
✓ "Status of PO-1001"
✓ "Show material shortages"

Hinglish:
✓ "Cutting को 20 kg cotton भेज दो"
✓ "Maintenance को urgent oil चाहिए"

Kanglish:
✓ "QC-ge 5 litres chemical beku testing ge"

Tanglish:
✓ "Stitching-ku thread red color venum"
```

### 🎯 Key Features:

**Multi-Language Support:**
- English, Hindi, Kannada, Tamil, Telugu, Marathi, Gujarati, Punjabi
- Real-time language switching
- Mixed-language command support

**Material Request Workflow:**
1. **Stock Available** → Issue materials + QR scan
2. **Partial Stock** → 3 options (Issue partial / Transfer / Purchase)
3. **No Stock** → Purchase requisition with approval routing

**Real Manufacturing Data:**
- **SKUs**: TS-001 (T-Shirt), HD-001 (Hoodie), TR-001 (Track Pants)
- **BOM**: 13 raw materials with scrap percentages
- **Inventory**: Real stock levels across 4 warehouses
- **Production**: 3 active orders with progress tracking

### 📊 Data Files:

- `/lib/apparel-data.ts` - Product catalog, BOMs, inventory, production orders
- `/lib/material-request-processor.ts` - AI request processing engine
- `/docs/ai-assistant-prompt.md` - Complete system documentation

### 🛠️ Components:

- `Dashboard` - Overview with KPIs
- `ProductionOrders` - PO management
- `BOMPlanner` - Bill of materials
- `WIPBoard` - Work-in-progress tracking
- `MaterialTransfer` - Warehouse transfers
- **`MaterialRequest`** - 🆕 Dedicated Material Request page with:
  - Natural language input form
  - Quick action buttons
  - Request history tracking
  - Real-time stock validation
  - Multi-language examples
- `QCCheck` - Quality control
- `Inventory` - Stock management
- `ChatBot` - AI assistant

### 🎨 Design:

- **Bold, factory-floor friendly** design
- **Mobile-first** responsive layout
- **Quick-scan** information with emojis
- **Dark mode** ready
- **Tailwind CSS** styling

### 🔧 Testing:

Open the chatbot (bottom-right floating button) and try any command above!

---

## 📖 Documentation:

See `/docs/ai-assistant-prompt.md` for complete AI system documentation including:
- Command examples
- Multi-language support
- Material request workflow
- Response formats
- Approval routing

---

**Last Updated:** December 1, 2025
**Status:** ✅ Production Ready