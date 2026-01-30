from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.database import get_session
from src.identity.domain import User
from src.identity.infrastructure.deps import get_current_user_required, require_admin
from src.projects.infrastructure.repository import ProjectRepository

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    sort_order: int = 0
    list_columns: list[str] = ["process_name", "status"]


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None
    list_columns: list[str] | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    sort_order: int
    list_columns: list[str]


def get_project_repo(session=Depends(get_session)) -> ProjectRepository:
    return ProjectRepository(session)


def _to_response(p) -> ProjectResponse:
    return ProjectResponse(
        id=str(p.id),
        name=p.name,
        description=p.description,
        sort_order=p.sort_order,
        list_columns=getattr(p, "list_columns", None) or ["process_name", "status"],
    )


@router.post("", response_model=ProjectResponse)
async def create_project(
    body: ProjectCreate,
    _admin: User = Depends(require_admin),
    repo: ProjectRepository = Depends(get_project_repo),
):
    project = await repo.create(
        name=body.name,
        description=body.description,
        sort_order=body.sort_order,
        list_columns=body.list_columns,
    )
    return _to_response(project)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    _user: User = Depends(get_current_user_required),
    repo: ProjectRepository = Depends(get_project_repo),
):
    projects = await repo.list_all()
    return [_to_response(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    _user: User = Depends(get_current_user_required),
    repo: ProjectRepository = Depends(get_project_repo),
):
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_response(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    _admin: User = Depends(require_admin),
    repo: ProjectRepository = Depends(get_project_repo),
):
    project = await repo.update(
        project_id,
        name=body.name,
        description=body.description,
        sort_order=body.sort_order,
        list_columns=body.list_columns,
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_response(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    _admin: User = Depends(require_admin),
    repo: ProjectRepository = Depends(get_project_repo),
):
    ok = await repo.delete(project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
