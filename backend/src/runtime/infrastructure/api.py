from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.database import get_session
from src.identity.domain import User
from src.identity.infrastructure.deps import get_current_user_required
from src.runtime.application.runtime_service import RuntimeService
from src.rules.evaluator import evaluate_field_access
from src.runtime.infrastructure.repository import ProcessInstanceRepository, FormSubmissionRepository
from src.process_design.infrastructure.repository import ProcessDefinitionRepository
from src.form_builder.infrastructure.repository import FormDefinitionRepository
from src.catalogs.infrastructure.repository import CatalogRepository

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


class StartProcessResponse(BaseModel):
    instance_id: str
    current_node_id: str
    status: str


class CurrentFormResponse(BaseModel):
    instance_id: str
    node_id: str
    form_definition: dict
    submission_data: dict | None


class SubmitFormRequest(BaseModel):
    data: dict


class InstanceResponse(BaseModel):
    id: str
    process_definition_id: str
    current_node_id: str | None
    status: str
    context: dict


class DocumentListItem(BaseModel):
    id: str
    process_definition_id: str
    process_name: str
    status: str
    current_node_id: str | None


def get_instance_repo(session=Depends(get_session)) -> ProcessInstanceRepository:
    return ProcessInstanceRepository(session)


def get_submission_repo(session=Depends(get_session)) -> FormSubmissionRepository:
    return FormSubmissionRepository(session)


def get_process_repo(session=Depends(get_session)) -> ProcessDefinitionRepository:
    return ProcessDefinitionRepository(session)


def get_form_repo(session=Depends(get_session)) -> FormDefinitionRepository:
    return FormDefinitionRepository(session)


def get_catalog_repo(session=Depends(get_session)) -> CatalogRepository:
    return CatalogRepository(session)


def get_runtime_service(
    instance_repo: ProcessInstanceRepository = Depends(get_instance_repo),
    submission_repo: FormSubmissionRepository = Depends(get_submission_repo),
    process_repo: ProcessDefinitionRepository = Depends(get_process_repo),
    form_repo: FormDefinitionRepository = Depends(get_form_repo),
) -> RuntimeService:
    return RuntimeService(
        instance_repo=instance_repo,
        submission_repo=submission_repo,
        process_repo=process_repo,
        form_repo=form_repo,
    )


async def _form_to_dict(form, context: dict | None = None, catalog_repo: CatalogRepository | None = None):
    role_ids = (context or {}).get("role_ids", [])
    ctx = {**(context or {}), "role_ids": role_ids}
    fields_out = []
    for f in form.fields:
        rules = [
            {"role_id": r.role_id, "expression": r.expression, "permission": r.permission.value}
            for r in (f.access_rules or [])
        ]
        permission = evaluate_field_access(rules, ctx, "write")
        if permission == "hidden":
            continue
        options = f.options
        if f.catalog_id and catalog_repo:
            try:
                catalog = await catalog_repo.get_by_id(UUID(f.catalog_id))
                if catalog:
                    options = [{"value": i.value, "label": i.label} for i in catalog.items]
            except (ValueError, TypeError):
                pass
        fields_out.append({
            "name": f.name,
            "label": f.label,
            "field_type": f.field_type.value,
            "required": f.required,
            "options": options,
            "validations": f.validations,
            "read_only": permission == "read",
        })
    return {
        "id": str(form.id),
        "name": form.name,
        "description": form.description,
        "fields": fields_out,
    }


@router.get("/documents", response_model=list[DocumentListItem])
async def list_documents(
    _user: User = Depends(get_current_user_required),
    service: RuntimeService = Depends(get_runtime_service),
):
    return await service.list_documents()


@router.post("/processes/{process_definition_id}/start", response_model=StartProcessResponse)
async def start_process(
    process_definition_id: UUID,
    _user: User = Depends(get_current_user_required),
    service: RuntimeService = Depends(get_runtime_service),
):
    instance = await service.start_process(process_definition_id)
    if not instance:
        raise HTTPException(status_code=400, detail="Process not found or has no start node")
    return StartProcessResponse(
        instance_id=str(instance.id),
        current_node_id=instance.current_node_id or "",
        status=instance.status.value,
    )


@router.get("/instances/{instance_id}/current-form", response_model=CurrentFormResponse)
async def get_current_form(
    instance_id: UUID,
    user: User = Depends(get_current_user_required),
    service: RuntimeService = Depends(get_runtime_service),
    catalog_repo: CatalogRepository = Depends(get_catalog_repo),
):
    role_ids = [str(r) for r in user.role_ids]
    result = await service.get_current_form(instance_id, role_ids=role_ids)
    if not result:
        raise HTTPException(status_code=404, detail="No current form or process completed")
    form = result["form"]
    node_id = result["node_id"]
    instance = result["instance"]
    context = {**instance.context, "role_ids": role_ids}
    submission_data = await service.get_submission_data(instance_id, node_id)
    form_def = await _form_to_dict(form, context, catalog_repo)
    return CurrentFormResponse(
        instance_id=str(instance.id),
        node_id=node_id,
        form_definition=form_def,
        submission_data=submission_data,
    )


@router.post("/instances/{instance_id}/nodes/{node_id}/submit")
async def submit_form(
    instance_id: UUID,
    node_id: str,
    body: SubmitFormRequest,
    user: User = Depends(get_current_user_required),
    service: RuntimeService = Depends(get_runtime_service),
):
    role_ids = [str(r) for r in user.role_ids]
    result = await service.get_current_form(instance_id, role_ids=role_ids)
    if not result or result["node_id"] != node_id:
        raise HTTPException(status_code=400, detail="Invalid step or process state")
    form = result["form"]
    form_def_id = form.id
    instance = await service.submit_form(instance_id, node_id, form_def_id, body.data)
    if not instance:
        raise HTTPException(status_code=400, detail="Submit failed")
    return {
        "instance_id": str(instance.id),
        "status": instance.status.value,
        "current_node_id": instance.current_node_id,
        "completed": instance.is_completed,
    }


@router.get("/instances/{instance_id}", response_model=InstanceResponse)
async def get_instance(
    instance_id: UUID,
    _user: User = Depends(get_current_user_required),
    service: RuntimeService = Depends(get_runtime_service),
):
    instance = await service.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    return InstanceResponse(
        id=str(instance.id),
        process_definition_id=str(instance.process_definition_id),
        current_node_id=instance.current_node_id,
        status=instance.status.value,
        context=instance.context,
    )
