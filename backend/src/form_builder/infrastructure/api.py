from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.database import get_session
from src.form_builder.application.form_service import FormService
from src.form_builder.infrastructure.repository import FormDefinitionRepository
from src.projects.infrastructure.repository import ProjectRepository
from src.identity.domain import User
from src.identity.infrastructure.deps import require_admin

router = APIRouter(prefix="/api/forms", tags=["forms"])


class FieldAccessRuleSchema(BaseModel):
    role_id: str | None = None
    expression: str | None = None
    permission: str = "read"


class FieldSchema(BaseModel):
    name: str
    label: str = ""
    field_type: str = "text"
    required: bool = False
    options: list[dict] | None = None
    catalog_id: str | None = None
    validations: dict | None = None
    access_rules: list[FieldAccessRuleSchema] | None = None
    width: int | None = None  # колонок из 12 (1-12)


class FormCreate(BaseModel):
    name: str
    description: str = ""
    fields: list[FieldSchema] | None = None


class FormUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    fields: list[FieldSchema] | None = None


class FormResponse(BaseModel):
    id: str
    name: str
    description: str
    fields: list[dict]


def _form_to_response(form, project_fields_map: dict[str, dict] | None = None) -> FormResponse:
    """project_fields_map: словарь {field_key: project_field_dict} для синхронизации типов полей"""
    fields = []
    for f in form.fields:
        # Если есть проект и поле существует в проекте, синхронизируем тип поля
        field_data = {
            "name": f.name,
            "label": f.label,
            "field_type": f.field_type.value,
            "required": f.required,
            "options": f.options,
            "catalog_id": f.catalog_id,
            "validations": f.validations,
            "access_rules": [
                {"role_id": r.role_id, "expression": r.expression, "permission": r.permission.value}
                for r in (f.access_rules or [])
            ],
            "width": f.width,
        }
        
        if project_fields_map and f.name in project_fields_map:
            project_field = project_fields_map[f.name]
            # Обновляем тип поля, опции и catalog_id из проекта
            field_data["field_type"] = project_field["field_type"]
            if project_field.get("options") is not None:
                field_data["options"] = project_field["options"]
            if project_field.get("catalog_id") is not None:
                field_data["catalog_id"] = project_field["catalog_id"]
        
        fields.append(field_data)
    return FormResponse(
        id=str(form.id),
        name=form.name,
        description=form.description,
        fields=fields,
    )


def get_form_repo(session=Depends(get_session)) -> FormDefinitionRepository:
    return FormDefinitionRepository(session)


def get_form_service(repo: FormDefinitionRepository = Depends(get_form_repo)) -> FormService:
    return FormService(repo)


def get_project_repo(session=Depends(get_session)) -> ProjectRepository:
    return ProjectRepository(session)


@router.post("", response_model=FormResponse)
async def create_form(
    body: FormCreate,
    _admin: User = Depends(require_admin),
    service: FormService = Depends(get_form_service),
):
    fields = [f.model_dump() for f in (body.fields or [])]
    form = await service.create_form(name=body.name, description=body.description, fields=fields)
    return _form_to_response(form)


@router.get("", response_model=list[FormResponse])
async def list_forms(
    _admin: User = Depends(require_admin),
    service: FormService = Depends(get_form_service),
):
    forms = await service.list_forms()
    return [_form_to_response(f) for f in forms]


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(
    form_id: UUID,
    project_id: UUID | None = Query(None, description="Опциональный ID проекта для синхронизации типов полей"),
    _admin: User = Depends(require_admin),
    service: FormService = Depends(get_form_service),
    project_repo: ProjectRepository = Depends(get_project_repo),
):
    form = await service.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    project_fields_map = None
    if project_id:
        project = await project_repo.get_by_id(project_id)
        if project:
            # Создаем словарь полей проекта для быстрого поиска
            project_fields_map = {pf.key: {
                "field_type": pf.field_type,
                "options": pf.options,
                "catalog_id": pf.catalog_id,
            } for pf in project.fields}
    
    return _form_to_response(form, project_fields_map)


@router.patch("/{form_id}", response_model=FormResponse)
async def update_form(
    form_id: UUID,
    body: FormUpdate,
    _admin: User = Depends(require_admin),
    service: FormService = Depends(get_form_service),
):
    fields = [f.model_dump() for f in body.fields] if body.fields is not None else None
    form = await service.update_form(
        form_id, name=body.name, description=body.description, fields=fields
    )
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return _form_to_response(form)


@router.delete("/{form_id}", status_code=204)
async def delete_form(
    form_id: UUID,
    _admin: User = Depends(require_admin),
    service: FormService = Depends(get_form_service),
):
    ok = await service.delete_form(form_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Form not found")
