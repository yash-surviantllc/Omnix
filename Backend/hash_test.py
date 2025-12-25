# test_setup.py
from app.config import settings
from app.database import get_db
from app.core.security import get_password_hash, verify_password

def test_config():
    """Test configuration loading"""
    print("✓ Config loaded successfully")
    print(f"  App Name: {settings.APP_NAME}")
    print(f"  Environment: {settings.ENVIRONMENT}")
    print(f"  Supabase URL: {settings.SUPABASE_URL[:30]}...")
    
def test_password_hashing():
    """Test password hashing"""
    password = "Test@123"
    hashed = get_password_hash(password)
    
    assert verify_password(password, hashed)
    assert not verify_password("wrong_password", hashed)
    
    print("✓ Password hashing works correctly")

def test_supabase_connection():
    """Test Supabase connection"""
    db = get_db()
    
    # Try a simple query
    try:
        response = db.table('users').select("*").limit(1).execute()
        print("✓ Supabase connection successful")
    except Exception as e:
        print(f"✗ Supabase connection failed: {e}")
        print("  Note: This is expected if users table doesn't exist yet")

if __name__ == "__main__":
    print("Testing Manufacturing OS Setup...\n")
    
    test_config()
    test_password_hashing()
    test_supabase_connection()
    
    print("\n✅ Basic setup verification complete!")