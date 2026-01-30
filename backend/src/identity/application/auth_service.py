import hashlib
from datetime import datetime, timezone, timedelta
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from src.config import settings
from src.identity.domain import User, Role

# Предварительный SHA256 избегает лимита 72 байт у bcrypt и убирает зависимость от passlib
def _password_digest(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    digest = _password_digest(plain_password)
    stored = hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password
    return bcrypt.checkpw(digest, stored)


def hash_password(password: str) -> str:
    digest = _password_digest(password)
    return bcrypt.hashpw(digest, bcrypt.gensalt()).decode("utf-8")


def create_access_token(subject: str | UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": str(subject), "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None


class AuthService:
    def __init__(self, get_user_by_email, get_user_roles):
        self._get_user_by_email = get_user_by_email
        self._get_user_roles = get_user_roles

    async def authenticate(self, email: str, password: str) -> User | None:
        user = await self._get_user_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            return None
        return user

    def create_token_for_user(self, user: User) -> str:
        return create_access_token(user.id)

    async def get_user_with_roles(self, user_id: UUID) -> tuple[User, list[Role]] | None:
        raise NotImplementedError("Inject get_user_by_id and get_roles in infrastructure")
