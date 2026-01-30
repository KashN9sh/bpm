from datetime import datetime, timezone, timedelta
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from src.config import settings
from src.identity.domain import User, Role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


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
