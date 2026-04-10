# OMNIX - Manufacturing Operations System

OMNIX is a comprehensive Manufacturing Operations System designed to streamline production management, inventory tracking, and workflow optimization. It provides a robust platform for managing manufacturing facilities with real-time data visibility and integrated modules.

## Key Features

### Production and Workflow Management
- **Dashboard**: Real-time visualization of production metrics and key performance indicators (KPIs).
- **AI Assistant**: Intelligent chatbot powered by Google Gemini and LangGraph for module guidance, data lookup, and workflow support.
- **Purchase Orders**: Systematic management of production orders from planning to completion.
- **WIP Board**: Visual tracking of production stages using a configurable Kanban-style interface.
- **BOM Planner**: Management of Bill of Materials and component requirements.

### Inventory and Supply Chain
- **Inventory Management**: Comprehensive tracking of raw materials, components, and finished goods.
- **Material Requisitions**: Streamlined requests and approvals for material movement.
- **Gate Entry/Exit**: Monitoring and logging of material movement at facility entry points.
- **Quality Control**: Integrated inspection workflows to ensure product standards.

### Platform Capabilities
- **Real-time Synchronization**: Live updates and notifications powered by WebSockets.
- **Multi-language Interface**: Support for 8 regional languages (English, Hindi, Kannada, Tamil, Telugu, Marathi, Gujarati, Punjabi).
- **Role-Based Access Control**: Secure, granular permissions for administrative and operational staff.

---

## Technical Stack

### Backend
- **Framework**: FastAPI (Python)
- **AI Engine**: LangGraph and LangChain for agentic workflows
- **LLM**: Google Gemini (Pro & Flash)
- **Database**: PostgreSQL (Supabase)
- **Real-time**: WebSockets
- **Authentication**: JWT with secure token management

### Frontend
- **Framework**: React with TypeScript
- **Styling**: TailwindCSS and shadcn/ui
- **State Management**: Zustand
- **Internationalization**: i18next

---

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- Supabase account (PostgreSQL)

### Database Configuration

1. Initialize a new project on the Supabase platform.
2. Obtain the API credentials (URL, Public Key, and Service Role Key).
3. Execute the consolidated migration scripts located in `Backend/migrations_consolidated/` in the following order:
   - `001_core_platform.sql`
   - `002_inventory_and_supply_chain.sql`
   - `003_orders_and_wip.sql`
   - `004_monitoring_and_utilities.sql`
   - `005_material_requisitions.sql`
   - `006_notifications.sql`
   - `007_qc_enhancements.sql`
   - `008_missing_tables.sql`


### Backend Installation

1. Navigate to the `Backend` directory.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure the environment by creating a `.env` file based on `.env.example`.
5. Start the application:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Installation

1. Navigate to the `Frontend` directory.
2. Install the necessary packages:
   ```bash
   npm install
   ```
3. Configure the environment variables by creating a `.env` file based on `.env.example`.
4. Launch the development server:
   ```bash
   npm run dev
   ```

---

## Project Structure

```text
Omnix/
├── Backend/                    # FastAPI Application
│   ├── app/                    # Source code
│   ├── migrations_consolidated/# Database schema definitions
│   └── requirements.txt        # Backend dependencies
├── Frontend/                   # React Application
│   ├── src/                    # Components and logic
│   └── package.json            # Frontend dependencies
└── README.md                   # Project documentation
```

## Support and Licensing

This software is proprietary. For support or inquiries, please contact the development team through official channels.

---

Made by Surviant LLC
