from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.projects.domain import Project
from src.projects.infrastructure.models import ProjectModel


class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, name: str, description: str = "", sort_order: int = 0) -> Project:
        model = ProjectModel(name=name, description=description, sort_order=sort_order)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return Project(
            id=UUID(model.id),
            name=model.name,
            description=model.description or "",
            sort_order=model.sort_order or 0,
        )

    async def get_by_id(self, project_id: UUID) -> Project | None:
        result = await self._session.execute(
            select(ProjectModel).where(ProjectModel.id == str(project_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return Project(
            id=UUID(row.id),
            name=row.name,
            description=row.description or "",
            sort_order=row.sort_order or 0,
        )

    async def list_all(self) -> list[Project]:
        result = await self._session.execute(
            select(ProjectModel).order_by(ProjectModel.sort_order, ProjectModel.name)
        )
        rows = result.scalars().all()
        return [
            Project(
                id=UUID(r.id),
                name=r.name,
                description=r.description or "",
                sort_order=r.sort_order or 0,
            )
            for r in rows
        ]

    async def update(
        self,
        project_id: UUID,
        name: str | None = None,
        description: str | None = None,
        sort_order: int | None = None,
    ) -> Project | None:
        result = await self._session.execute(
            select(ProjectModel).where(ProjectModel.id == str(project_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        if name is not None:
            row.name = name
        if description is not None:
            row.description = description
        if sort_order is not None:
            row.sort_order = sort_order
        await self._session.flush()
        await self._session.refresh(row)
        return Project(
            id=UUID(row.id),
            name=row.name,
            description=row.description or "",
            sort_order=row.sort_order or 0,
        )

    async def delete(self, project_id: UUID) -> bool:
        result = await self._session.execute(
            select(ProjectModel).where(ProjectModel.id == str(project_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True
