from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr  # requires pydantic[email]
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.identity.application.auth_service import AuthService, hash_password, decode_access_token
from src.identity.domain import User
from src.identity.infrastructure.repository import IdentityRepository

router = APIRouter(prefix="/api/identity", tags=["identity"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str

    @classmethod
    def from_user(cls, user: User) -> "UserResponse":
        return cls(id=str(user.id), email=user.email)


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    role_ids: list[str] | None = None


class CreateRoleRequest(BaseModel):
    name: str


class RoleResponse(BaseModel):
    id: str
    name: str


def get_identity_repo(session: AsyncSession = Depends(get_session)) -> IdentityRepository:
    return IdentityRepository(session)


def get_auth_service(repo: IdentityRepository = Depends(get_identity_repo)) -> AuthService:
    return AuthService(
        get_user_by_email=repo.get_user_by_email,
        get_user_roles=repo.get_roles_for_user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    auth: AuthService = Depends(get_auth_service),
):
    user = await auth.authenticate(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth.create_token_for_user(user)
    return TokenResponse(access_token=token)


@router.post("/users", response_model=UserResponse)
async def create_user(
    body: CreateUserRequest,
    repo: IdentityRepository = Depends(get_identity_repo),
):
    role_ids = [UUID(r) for r in (body.role_ids or [])]
    user = await repo.create_user(
        email=body.email,
        hashed_password=hash_password(body.password),
        role_ids=role_ids if role_ids else None,
    )
    return UserResponse.from_user(user)


@router.get("/users/me", response_model=UserResponse)
async def get_current_user(
    authorization: str | None = None,
    repo: IdentityRepository = Depends(get_identity_repo),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.removeprefix("Bearer ").strip()
    sub = decode_access_token(token)
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await repo.get_user_by_id(UUID(sub))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return UserResponse.from_user(user)


@router.post("/roles", response_model=RoleResponse)
async def create_role(
    body: CreateRoleRequest,
    repo: IdentityRepository = Depends(get_identity_repo),
):
    role = await repo.create_role(name=body.name)
    return RoleResponse(id=str(role.id), name=role.name)


@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(repo: IdentityRepository = Depends(get_identity_repo)):
    roles = await repo.list_roles()
    return [RoleResponse(id=str(r.id), name=r.name) for r in roles]
