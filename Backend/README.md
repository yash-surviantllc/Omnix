# Manufacturing OS - Backend Setup

## Prerequisites
- Python 3.10+
- Supabase account (free tier)
- uv package manager

## Setup Instructions

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd manufacturing-os-backend
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
uv pip install -r requirements.txt
```

### 4. Create Supabase Project

1. Go to https://supabase.com
2. Create new project
3. Wait for setup to complete (~2 minutes)

### 5. Run Database Migration

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy content from `migrations/001_initial_schema.sql`
4. Paste and click "Run"

### 6. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
- Get them from: Supabase Dashboard → Settings → API

Generate SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 7. Run Application
```bash
uvicorn app.main:app --reload
```

Visit: http://localhost:8000/docs

### 8. Create First Admin User

Use the `/api/v1/auth/register` endpoint to create your first user.

## Project Structure
```
manufacturing-os-backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── endpoints/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   └── services/
├── migrations/
├── tests/
└── requirements.txt
```

## Troubleshooting

### Supabase Connection Error
- Check your SUPABASE_URL and SUPABASE_KEY
- Ensure database tables are created (run migration)

### Password Hashing Error
- Reinstall bcrypt: `uv pip install --force-reinstall bcrypt==4.0.1`

### SUPABASE setup:

#### Get Your Supabase Credentials

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (or create a new one if you haven't)
3. Go to Settings → API
4. You'll find:
    - Project URL (e.g., https://xxxxxxxxxxxxx.supabase.co)
    - Project API keys:
-> anon public key (this is SUPABASE_KEY)
-> service_role secret key (this is SUPABASE_SERVICE_KEY)

### To get JWT security KEY run this command -> in the terminal:

python -c "import secrets; print(secrets.token_urlsafe(32))" .