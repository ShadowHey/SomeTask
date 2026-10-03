"""FastAPI dependencies for authentication via Supabase."""

import uuid
import httpx
from typing import Optional

from pydantic import BaseModel

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

security = HTTPBearer()

class SupabaseUser(BaseModel):
    id: str
    email: Optional[str] = None
    user_metadata: dict = {}

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> SupabaseUser:
    """
    Validate the Supabase JWT token via Supabase Auth API directly to avoid sync SDK hangs.
    """
    token = credentials.credentials
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_service_role_key,
                }
            )
            
            if response.status_code != 200:
                raise ValueError(f"Invalid session: {response.text}")
                
            data = response.json()
            if "id" not in data:
                raise ValueError("No user id found")
                
            return SupabaseUser(
                id=data["id"],
                email=data.get("email"),
                user_metadata=data.get("user_metadata", {})
            )
    except Exception as e:
        import logging
        logging.error(f"Supabase auth validation failed: {type(e).__name__} - {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None


async def get_current_user_id(
    user: SupabaseUser = Depends(get_current_user),
) -> uuid.UUID:
    """Extract user's UUID from the authenticated user object."""
    return uuid.UUID(user.id)
