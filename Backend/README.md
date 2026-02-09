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

### Notifications
A centralized system for triggering and delivering operational alerts across the platform.

## Setup

Detailed setup instructions are available in the root `README.md`.

### Developer Tools
- **API Docs**: Available at `/docs` when the server is running.
- **Seed Data**: Use the scripts provided in the `migrations_consolidated` directory for initial schema setup.

---

Made by Surviant LLC