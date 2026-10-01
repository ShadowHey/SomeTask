"""Authentication API routes."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.models import User
from app.schemas.schemas import LoginRequest, RegisterRequest, UserResponse
from app.services.auth.service import (
    create_access_token,
    create_user,
    get_user_by_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    """Register a new user with email and password."""
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = await create_user(db, body.email, body.password)
    return user


@router.post("/login")
async def login(
    body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Authenticate and set HTTP-only cookie."""
    user = await get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=not settings.debug,  # Secure in production
        samesite="lax",
        max_age=settings.jwt_expiry_minutes * 60,
        path="/",
    )

    return UserResponse.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    """Clear the authentication cookie."""
    response.delete_cookie(key="access_token", path="/")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Get the current authenticated user."""
    return current_user
