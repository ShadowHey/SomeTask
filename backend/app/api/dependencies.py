"""FastAPI dependencies for authentication via Supabase."""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.supabase import supabase_client

security = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    """
    Validate the Supabase JWT token and extract the user's UUID.
    This replaces our custom JWT/Argon2 logic because Supabase Auth handles identity.
    """
    token = credentials.credentials
    try:
        # We verify the JWT by asking Supabase to get the user for this token.
        # This guarantees the token is valid, unexpired, and belongs to a real user.
        response = supabase_client.auth.get_user(token)
        if not response.user:
            raise ValueError("No user found")

        return uuid.UUID(response.user.id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
