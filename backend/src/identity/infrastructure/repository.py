from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.identity.domain import User, Role
from src.identity.infrastructure.models import UserModel, RoleModel, user_roles


class IdentityRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(UserModel).options(selectinload(UserModel.roles)).where(UserModel.id == str(user_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        role_ids = [UUID(r.id) for r in row.roles]
        return User(
            id=UUID(row.id),
            email=row.email,
            hashed_password=row.hashed_password,
            role_ids=tuple(role_ids),
        )

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(UserModel).options(selectinload(UserModel.roles)).where(UserModel.email == email)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        role_ids = [UUID(r.id) for r in row.roles]
        return User(
            id=UUID(row.id),
            email=row.email,
            hashed_password=row.hashed_password,
            role_ids=tuple(role_ids),
        )

    async def get_roles_for_user(self, user_id: UUID) -> list[Role]:
        result = await self._session.execute(
            select(RoleModel).join(user_roles, RoleModel.id == user_roles.c.role_id).where(
                user_roles.c.user_id == str(user_id)
            )
        )
        rows = result.scalars().all()
        return [Role(id=UUID(r.id), name=r.name) for r in rows]

    async def create_user(self, email: str, hashed_password: str, role_ids: list[UUID] | None = None) -> User:
        user = UserModel(email=email, hashed_password=hashed_password)
        self._session.add(user)
        await self._session.flush()
        if role_ids:
            for rid in role_ids:
                await self._session.execute(
                    user_roles.insert().values(user_id=user.id, role_id=str(rid))
                )
        await self._session.refresh(user)
        return User(
            id=UUID(user.id),
            email=user.email,
            hashed_password=user.hashed_password,
            role_ids=tuple(role_ids) if role_ids else (),
        )

    async def create_role(self, name: str) -> Role:
        role = RoleModel(name=name)
        self._session.add(role)
        await self._session.flush()
        await self._session.refresh(role)
        return Role(id=UUID(role.id), name=role.name)

    async def list_roles(self) -> list[Role]:
        result = await self._session.execute(select(RoleModel))
        rows = result.scalars().all()
        return [Role(id=UUID(r.id), name=r.name) for r in rows]

    async def list_users(self) -> list[User]:
        result = await self._session.execute(
            select(UserModel).options(selectinload(UserModel.roles)).order_by(UserModel.email)
        )
        rows = result.scalars().all()
        out = []
        for row in rows:
            role_ids = [UUID(r.id) for r in row.roles]
            out.append(
                User(
                    id=UUID(row.id),
                    email=row.email,
                    hashed_password=row.hashed_password,
                    role_ids=tuple(role_ids),
                )
            )
        return out
