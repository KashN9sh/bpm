"""Зависимости авторизации: текущий пользователь и проверка роли admin."""

from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.identity.application.auth_service import decode_access_token
from src.identity.domain import User
from src.identity.infrastructure.repository import IdentityRepository

ADMIN_ROLE_NAME = "admin"


def get_identity_repo(session: AsyncSession = Depends(get_session)) -> IdentityRepository:
    return IdentityRepository(session)


async def get_current_user_required(
    authorization: str | None = Header(None),
    repo: IdentityRepository = Depends(get_identity_repo),
) -> User:
    """Возвращает текущего пользователя по JWT или 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.removeprefix("Bearer ").strip()
    sub = decode_access_token(token)
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await repo.get_user_by_id(UUID(sub))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(
    user: User = Depends(get_current_user_required),
    repo: IdentityRepository = Depends(get_identity_repo),
) -> User:
    """Требует роль admin; иначе 403."""
    roles = await repo.get_roles_for_user(user.id)
    if not any(r.name == ADMIN_ROLE_NAME for r in roles):
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
