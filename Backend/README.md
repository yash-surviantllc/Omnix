# OMNIX Backend Services

The OMNIX backend is a high-performance REST API built with FastAPI, providing the core logic and data management for the Manufacturing Operations System.

## Architecture

The system follows a modular architecture:
- **API Layer**: Fast and documented endpoints using FastAPI.
- **Service Layer**: Business logic encapsulation for production, inventory, and notifications.
- **Data Layer**: PostgreSQL integration with real-time capabilities via Supabase.
- **Communication**: Real-time event broadcasting using WebSockets.

## Key Modules

### Production (WIP)
Handles the lifecycle of production orders, workstation management, and real-time stage tracking.

### Inventory
Manages stock levels, material transactions, and reorder alerts.

### AI Chatbot (OMNIX Assistant)
Integrated AI agent powered by LangGraph and Google Gemini. It uses a state-of-the-art graph-based architecture to provide contextual guidance and automated data lookups.

### Notifications
A centralized system for triggering and delivering operational alerts across the platform.

### Finished Goods
Tracking of production completion and dispatch-ready inventory.

## Setup

Detailed setup instructions are available in the root `README.md`.

### Database Migrations

Execute migration scripts in `migrations_consolidated/` directory in numerical order:
1. `001_core_platform.sql` - Users, roles, locations
2. `002_inventory_and_supply_chain.sql` - Inventory, suppliers, gate entries/exits
3. `003_orders_and_wip.sql` - Production orders and WIP tracking
4. `004_monitoring_and_utilities.sql` - Logs and monitoring
5. `005_material_requisitions.sql` - Material request workflows
6. `006_notifications.sql` - Notification system
7. `007_qc_enhancements.sql` - Quality control
8. `008_missing_tables.sql` - Additional tables and relationships

**Note**: Run `008_pre_execution.sql` before `008_missing_tables.sql` if you encounter foreign key issues.

### Developer Tools
- **API Docs**: Available at `/docs` when the server is running.
- **Interactive Schema**: Available at `/redoc` for alternative documentation view.

---

Made by Surviant LLC