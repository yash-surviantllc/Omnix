
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.config import settings

def verify_auth_config():
    print("Verifying Auth Configuration...")
    print(f"ACCESS_TOKEN_EXPIRE_MINUTES: {settings.ACCESS_TOKEN_EXPIRE_MINUTES}")
    print(f"REFRESH_TOKEN_EXPIRE_DAYS: {settings.REFRESH_TOKEN_EXPIRE_DAYS}")
    
    if settings.ACCESS_TOKEN_EXPIRE_MINUTES == 1440:
        print("✓ Access Token Expiry correct (24h)")
    else:
        print(f"✗ Access Token Expiry incorrect: expected 1440, got {settings.ACCESS_TOKEN_EXPIRE_MINUTES}")
        sys.exit(1)
        
    if settings.REFRESH_TOKEN_EXPIRE_DAYS == 30:
        print("✓ Refresh Token Expiry correct (30 days)")
    else:
        print(f"✗ Refresh Token Expiry incorrect: expected 30, got {settings.REFRESH_TOKEN_EXPIRE_DAYS}")
        sys.exit(1)

if __name__ == "__main__":
    verify_auth_config()
