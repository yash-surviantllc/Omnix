from supabase import create_client, Client
from app.config import settings

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# Service role client (for admin operations)
supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def get_db():
    """
    Dependency to get database client.
    """
    return supabase


def get_admin_db():
    """
    Dependency to get admin database client.
    """
    return supabase_admin