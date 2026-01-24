# OMNIX - Manufacturing OS

A comprehensive Manufacturing Operations System designed to streamline production management, inventory tracking, and workflow optimization for manufacturing facilities.

## Features

### Core Modules
- **Dashboard** - Real-time overview of production metrics and KPIs
- **Production Orders** - Create, track, and manage production orders
- **WIP (Work in Progress) Board** - Visual Kanban-style tracking of production stages with configurable workflows
- **BOM (Bill of Materials) Planner** - Manage product components and material requirements
- **Inventory Management** - Track raw materials, components, and finished goods
- **Material Requests & Transfers** - Handle material requisitions and inter-department transfers
- **Gate Entry** - Manage incoming and outgoing materials at facility gates
- **QC (Quality Control)** - Quality inspection and approval workflows
- **User Management** - Role-based access control and user profiles
- **Settings** - Configurable system settings including WIP stages and workflows

### Technical Highlights
- **Multi-language Support** - English, Hindi, Gujarati, Marathi, Punjabi, Tamil, Telugu, Kannada
- **Real-time Updates** - Live production tracking and notifications via WebSockets
- **Modern UI/UX** - Built with React, TailwindCSS, and shadcn/ui components
- **RESTful API** - FastAPI backend with comprehensive documentation
- **Secure Authentication** - JWT-based authentication with refresh tokens
- **Database** - PostgreSQL via Supabase

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Backend Requirements
- **Python 3.10+** - [Download Python](https://www.python.org/downloads/)
- **uv** (Python package manager) - [Install uv](https://github.com/astral-sh/uv)
- **Git** - [Download Git](https://git-scm.com/)

### Frontend Requirements
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **npm** or **yarn** - Comes with Node.js

### Database
- **Supabase Account** (Free tier available) - [Sign up](https://supabase.com)

---

## Database Setup (Supabase)

### Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: OMNIX-Manufacturing-OS (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your location
4. Click **"Create new project"**
5. Wait 2-3 minutes for project initialization

### Step 2: Get Your Credentials

1. In your Supabase project, go to **Settings > API**
2. Copy the following values (you'll need them later):
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (this is your `SUPABASE_KEY`)
   - **service_role** key (this is your `SUPABASE_SERVICE_KEY`)

### Step 3: Run Database Migrations

You need to run all migration files in order to set up the database schema.

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Run each migration file in order:

**Execute migrations in this exact order:**

```
001_core_platform.sql              # Core tables (users, products, etc.)
002_inventory_and_supply_chain.sql # Inventory, BOM, and Supply Chain tables
003_orders_and_wip.sql             # Orders and WIP tracking tables
004_monitoring_and_utilities.sql   # Monitoring, Alerts, and Utilities
005_configurable_stages.sql        # Configurable WIP stages and workflows
006_schema_fixes.sql               # Critical schema fixes and constraints
```

**How to run each migration:**
1. Open the migration file from `Backend/migrations_consolidated/` folder
2. Copy the entire SQL content
3. Paste into Supabase SQL Editor
4. Click **"Run"** or press `Ctrl+Enter`
5. Verify success (should show "Success. No rows returned")
6. Repeat for next migration file

> **Important**: Run migrations in the exact order listed above to avoid dependency errors.

---

## Backend Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/yash-surviantllc/Omnix.git
cd Omnix/Backend
```

### Step 2: Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies

Using uv (recommended):
```bash
uv pip install -r requirements.txt
```

Or using pip:
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` file with your actual values:

```env
# Application
APP_NAME=Manufacturing OS
APP_VERSION=1.0.0
DEBUG=True
ENVIRONMENT=development

# Supabase (from Step 2 of Database Setup)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key

# JWT Security
SECRET_KEY=your-generated-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Email Configuration (Optional - for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=OMNIX Manufacturing OS
FRONTEND_URL=http://localhost:3000
```

3. Generate a secure `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Copy the output and paste it as your `SECRET_KEY` in `.env`

### Step 5: Run Backend Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at:
- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

### Step 6: Create First Admin User

1. Open http://localhost:8000/docs
2. Find the `/api/v1/auth/register` endpoint
3. Click **"Try it out"**
4. Fill in user details:
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!",
  "full_name": "Admin User",
  "role": "admin"
}
```
5. Click **"Execute"**

---

## Frontend Setup

### Step 1: Navigate to Frontend Directory

```bash
cd ../Frontend
```

### Step 2: Install Dependencies

Using npm:
```bash
npm install
```

Or using yarn:
```bash
yarn install
```

### Step 3: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` file:
```env
VITE_API_URL=http://localhost:8000/api/v1
```

> If your backend runs on a different port, update the URL accordingly.

### Step 4: Run Frontend Development Server

Using npm:
```bash
npm run dev
```

Or using yarn:
```bash
yarn dev
```

The frontend will be available at: **http://localhost:3000**

### Step 5: Login

1. Open http://localhost:3000 in your browser
2. Login with the admin credentials you created in Backend Step 6
3. Start exploring the Manufacturing OS!

---

## Project Structure

```
Manufacturing_OS/
├── Backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── endpoints/      # API route handlers
│   │   ├── core/                   # Core configurations
│   │   ├── schemas/                # Pydantic models
│   │   └── services/               # Business logic
│   ├── migrations_consolidated/    # Database migrations
│   ├── tests/                      # Test files
│   ├── requirements.txt            # Python dependencies
│   └── .env.example               # Environment template
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── features/          # Feature components
│   │   │   ├── layout/            # Layout components
│   │   │   └── ui/                # Reusable UI components
│   │   ├── lib/                   # Utilities and API clients
│   │   ├── stores/                # State management (Zustand)
│   │   ├── i18n/                  # Internationalization
│   │   └── types/                 # TypeScript types
│   ├── package.json               # Node dependencies
│   └── .env.example              # Environment template
│
└── README.md                      # This file
```

---

## Available Scripts

### Backend
```bash
# Run development server
uvicorn app.main:app --reload

# Run tests
pytest

# Format code
black app/

# Lint code
flake8 app/
```

### Frontend
```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Analyze bundle size
npm run build:analyze
```

---

## Default User Roles

The system supports the following roles:
- **admin** - Full system access
- **manager** - Production and inventory management
- **operator** - Production floor operations
- **viewer** - Read-only access

---

## Multi-language Support

The system supports 8 languages:
- English (en)
- Hindi (hi)
- Gujarati (gu)
- Marathi (mr)
- Punjabi (pa)
- Tamil (ta)
- Telugu (te)
- Kannada (kn)

Language can be changed from the user profile settings.

---

## Troubleshooting

### Backend Issues

**Supabase Connection Error**
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
- Ensure all migrations have been run successfully
- Check if Supabase project is active

**Password Hashing Error**
```bash
pip install --force-reinstall bcrypt==4.0.1
```

**Port Already in Use**
```bash
# Use a different port
uvicorn app.main:app --reload --port 8001
```

### Frontend Issues

**Module Not Found**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**API Connection Error**
- Verify backend is running on http://localhost:8000
- Check `VITE_API_URL` in `.env`
- Ensure CORS is properly configured in backend

**Build Errors**
```bash
# Clear cache and rebuild
npm run clean
npm install
npm run build
```

---

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

These provide interactive API documentation with the ability to test endpoints directly.

---

## WebSocket API

OMNIX supports real-time updates through WebSocket connections for live dashboard updates and notifications.

### WebSocket Endpoints

All WebSocket endpoints require authentication via JWT token in query parameter: `?token=<jwt_token>`

#### Dashboard Updates (`/ws/dashboard`)
- **Purpose**: Real-time dashboard KPI and metrics updates
- **Authentication**: Required (JWT token in query)
- **Message Format**: JSON
- **Events**: `dashboard_update` with types: `kpis`, `orders`, `shortages`, `rework`, `activities`

#### BOM Updates (`/ws/boms`)
- **Purpose**: Real-time BOM changes and validation updates
- **Authentication**: Required (JWT token in query)
- **Message Format**: JSON
- **Events**: BOM modifications, material updates, validation results

#### Purchase Order Updates (`/ws/purchase-orders`)
- **Purpose**: Real-time purchase order status changes and notifications
- **Authentication**: Required (JWT token in query)
- **Message Format**: JSON
- **Events**: Order status updates, approvals, stock changes

#### Inventory Updates (`/ws/inventory`)
- **Purpose**: Real-time inventory changes and alerts
- **Authentication**: Required (JWT token in query)
- **Message Format**: JSON
- **Events**: Stock updates, alerts, allocations, deallocations

### Connection Example

```javascript
// Frontend connection example
const ws = new WebSocket('ws://localhost:8000/ws/dashboard?token=' + jwtToken);

ws.onopen = function(event) {
    console.log('WebSocket connected');
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
};

ws.onclose = function(event) {
    console.log('WebSocket disconnected');
};
```

### Error Handling

WebSocket connections include error handling for:
- Authentication failures (closes with code 1008)
- Unexpected errors (sends error message with reconnection advice)
- Connection timeouts and disconnections

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

## Support

For issues, questions, or contributions, please contact:
- **Email**: support@surviant.com
- **GitHub Issues**: [Create an issue](https://github.com/yash-surviantllc/Omnix/issues)

---

## Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://react.dev/) - Frontend library
- [Supabase](https://supabase.com/) - Database and authentication
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Zustand](https://zustand-demo.pmnd.rs/) - State management

---

**Made by Surviant LLC**
