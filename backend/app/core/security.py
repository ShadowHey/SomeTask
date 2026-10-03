from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings
from typing import Optional

def get_fernet() -> Fernet:
    key = settings.encryption_key.encode('utf-8')
    return Fernet(key)

def encrypt_api_key(api_key: Optional[str]) -> Optional[str]:
    if not api_key:
        return None
    f = get_fernet()
    encrypted = f.encrypt(api_key.encode('utf-8'))
    return encrypted.decode('utf-8')

def decrypt_api_key(encrypted_key: Optional[str]) -> Optional[str]:
    if not encrypted_key:
        return None
    f = get_fernet()
    try:
        decrypted = f.decrypt(encrypted_key.encode('utf-8'))
        return decrypted.decode('utf-8')
    except InvalidToken:
        return None
