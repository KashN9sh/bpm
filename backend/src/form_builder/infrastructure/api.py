from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.database import get_session
from src.form_builder.application.form_service import FormService
from src.form_builder.infrastructure.repository import FormDefinitionRepository

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


def _form_to_response(form) -> FormResponse:
    fields = []
    for f in form.fields:
        fields.append({
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
        })
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


@router.post("", response_model=FormResponse)
async def create_form(body: FormCreate, service: FormService = Depends(get_form_service)):
    fields = [f.model_dump() for f in (body.fields or [])]
    form = await service.create_form(name=body.name, description=body.description, fields=fields)
    return _form_to_response(form)


@router.get("", response_model=list[FormResponse])
async def list_forms(service: FormService = Depends(get_form_service)):
    forms = await service.list_forms()
    return [_form_to_response(f) for f in forms]


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(form_id: UUID, service: FormService = Depends(get_form_service)):
    form = await service.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return _form_to_response(form)


@router.patch("/{form_id}", response_model=FormResponse)
async def update_form(
    form_id: UUID,
    body: FormUpdate,
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
async def delete_form(form_id: UUID, service: FormService = Depends(get_form_service)):
    ok = await service.delete_form(form_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Form not found")
