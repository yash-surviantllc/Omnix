
import re

env_file = '.env'

try:
    with open(env_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace Access Token Expiry
    new_content = re.sub(
        r'ACCESS_TOKEN_EXPIRE_MINUTES=\d+',
        'ACCESS_TOKEN_EXPIRE_MINUTES=1440',
        content
    )
    
    # Replace Refresh Token Expiry
    new_content = re.sub(
        r'REFRESH_TOKEN_EXPIRE_DAYS=\d+',
        'REFRESH_TOKEN_EXPIRE_DAYS=30',
        new_content
    )

    with open(env_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Successfully updated .env file")

except Exception as e:
    print(f"Error updating .env: {e}")
