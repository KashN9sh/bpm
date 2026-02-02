from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.database import get_session
from src.identity.domain import User
from src.identity.infrastructure.deps import get_current_user_required, require_admin
from src.projects.domain import ProjectField, Validator
from src.projects.infrastructure.repository import ProjectRepository

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectFieldSchema(BaseModel):
    key: str
    label: str
    field_type: str = "text"
    catalog_id: str | None = None
    options: list[dict] | None = None


class ValidatorSchema(BaseModel):
    name: str
    type: str  # "field_visibility" | "step_access"
    code: str


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    sort_order: int = 0
    list_columns: list[str] = ["process_name", "status"]
    fields: list[ProjectFieldSchema] = []
    validators: list[ValidatorSchema] = []


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None
    list_columns: list[str] | None = None
    fields: list[ProjectFieldSchema] | None = None
    validators: list[ValidatorSchema] | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    sort_order: int
    list_columns: list[str]
    fields: list[ProjectFieldSchema] = []
    validators: list[ValidatorSchema] = []


def get_project_repo(session=Depends(get_session)) -> ProjectRepository:
    return ProjectRepository(session)


def _field_to_schema(f) -> ProjectFieldSchema:
    return ProjectFieldSchema(
        key=f.key,
        label=f.label,
        field_type=getattr(f, "field_type", "text"),
        catalog_id=getattr(f, "catalog_id", None),
        options=getattr(f, "options", None),
    )


def _validator_to_schema(v) -> ValidatorSchema:
    return ValidatorSchema(
        name=v.name,
        type=v.type,
        code=v.code,
    )


def _to_response(p) -> ProjectResponse:
    fields = getattr(p, "fields", None) or []
    validators = getattr(p, "validators", None) or []
    return ProjectResponse(
        id=str(p.id),
        name=p.name,
        description=p.description,
        sort_order=p.sort_order,
        list_columns=getattr(p, "list_columns", None) or ["process_name", "status"],
        fields=[_field_to_schema(f) for f in fields],
        validators=[_validator_to_schema(v) for v in validators],
    )


def _body_fields_to_domain(fields: list) -> list[ProjectField]:
    return [
        ProjectField(
            key=f.key,
            label=f.label,
            field_type=f.field_type or "text",
            catalog_id=f.catalog_id,
            options=f.options,
        )
        for f in fields
    ]


def _body_validators_to_domain(validators: list | None) -> list[Validator]:
    if validators is None:
        return []
    return [
        Validator(name=v.name, type=v.type or "field_visibility", code=v.code or "")
        for v in validators
    ]


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
        fields=_body_fields_to_domain(body.fields or []),
        validators=_body_validators_to_domain(body.validators or []),
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
        fields=_body_fields_to_domain(body.fields) if body.fields is not None else None,
        validators=_body_validators_to_domain(body.validators) if body.validators is not None else None,
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
