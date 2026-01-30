import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.projects.domain import Project
from src.projects.infrastructure.models import ProjectModel


def _parse_list_columns(raw: str | None) -> list[str]:
    if not raw:
        return ["process_name", "status"]
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else ["process_name", "status"]
    except (json.JSONDecodeError, TypeError):
        return ["process_name", "status"]


class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        name: str,
        description: str = "",
        sort_order: int = 0,
        list_columns: list[str] | None = None,
    ) -> Project:
        cols = list_columns if list_columns is not None else ["process_name", "status"]
        model = ProjectModel(
            name=name,
            description=description,
            sort_order=sort_order,
            list_columns=json.dumps(cols),
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return Project(
            id=UUID(model.id),
            name=model.name,
            description=model.description or "",
            sort_order=model.sort_order or 0,
            list_columns=_parse_list_columns(model.list_columns),
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
            list_columns=_parse_list_columns(getattr(row, "list_columns", None)),
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
                list_columns=_parse_list_columns(getattr(r, "list_columns", None)),
            )
            for r in rows
        ]

    async def update(
        self,
        project_id: UUID,
        name: str | None = None,
        description: str | None = None,
        sort_order: int | None = None,
        list_columns: list[str] | None = None,
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
        if list_columns is not None:
            row.list_columns = json.dumps(list_columns)
        await self._session.flush()
        await self._session.refresh(row)
        return Project(
            id=UUID(row.id),
            name=row.name,
            description=row.description or "",
            sort_order=row.sort_order or 0,
            list_columns=_parse_list_columns(getattr(row, "list_columns", None)),
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
