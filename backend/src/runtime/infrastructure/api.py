from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.database import get_session
from src.identity.domain import User
from src.identity.infrastructure.deps import get_current_user_required
from src.runtime.application.runtime_service import RuntimeService
from src.runtime.infrastructure.repository import ProcessInstanceRepository, FormSubmissionRepository
from src.process_design.infrastructure.repository import ProcessDefinitionRepository
from src.form_builder.infrastructure.repository import FormDefinitionRepository
from src.catalogs.infrastructure.repository import CatalogRepository
from src.projects.infrastructure.repository import ProjectRepository
from src.rules.validator_runner import run_field_visibility_validators, run_step_access_validators
from src.rules.evaluator import evaluate_expression

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


class StartProcessResponse(BaseModel):
    instance_id: str
    current_node_id: str
    status: str


class AvailableTransition(BaseModel):
    edge_id: str
    key: str
    label: str
    target_node_id: str


class CurrentFormResponse(BaseModel):
    instance_id: str
    node_id: str
    form_definition: dict
    submission_data: dict | None
    available_transitions: list[AvailableTransition] = []


class SubmitFormRequest(BaseModel):
    data: dict
    chosen_edge_key: str | None = None


class SaveStepRequest(BaseModel):
    data: dict


class InstanceResponse(BaseModel):
    id: str
    document_number: int
    process_definition_id: str
    current_node_id: str | None
    status: str
    context: dict


class DocumentListItem(BaseModel):
    id: str
    document_number: int
    process_definition_id: str
    process_name: str
    status: str
    current_node_id: str | None
    context: dict = {}


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


def get_project_repo(session=Depends(get_session)) -> ProjectRepository:
    return ProjectRepository(session)


def get_runtime_service(
    instance_repo: ProcessInstanceRepository = Depends(get_instance_repo),
    submission_repo: FormSubmissionRepository = Depends(get_submission_repo),
    process_repo: ProcessDefinitionRepository = Depends(get_process_repo),
    form_repo: FormDefinitionRepository = Depends(get_form_repo),
    project_repo: ProjectRepository = Depends(get_project_repo),
) -> RuntimeService:
    return RuntimeService(
        instance_repo=instance_repo,
        submission_repo=submission_repo,
        process_repo=process_repo,
        form_repo=form_repo,
        project_repo=project_repo,
    )


async def _form_to_dict(
    form,
    context: dict | None = None,
    catalog_repo: CatalogRepository | None = None,
    validators=None,
):
    """validators — список валидаторов этапа (узла процесса), для видимости полей."""
    role_ids = (context or {}).get("role_ids", [])
    ctx = {**(context or {}), "role_ids": role_ids}
    validator_overrides = {}
    if validators:
        flat_ctx = _flatten_context_for_validators(ctx)
        validator_overrides = run_field_visibility_validators(validators, flat_ctx)
    fields_out = []
    for f in form.fields:
        permission = validator_overrides.get(f.name, "hidden")
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
            "width": f.width,
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
    project_id: UUID | None = None,
):
    return await service.list_documents(project_id=project_id)


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


def _flatten_context_for_validators(ctx: dict) -> dict:
    """Плоский контекст для валидаторов: данные всех узлов + role_ids."""
    flat = {}
    for k, v in (ctx or {}).items():
        if k == "role_ids":
            flat["role_ids"] = v
        elif isinstance(v, dict):
            flat.update(v)
    if "role_ids" not in flat:
        flat["role_ids"] = []
    return flat


@router.get("/instances/{instance_id}/current-form", response_model=CurrentFormResponse)
async def get_current_form(
    instance_id: UUID,
    user: User = Depends(get_current_user_required),
    service: RuntimeService = Depends(get_runtime_service),
    catalog_repo: CatalogRepository = Depends(get_catalog_repo),
    process_repo: ProcessDefinitionRepository = Depends(get_process_repo),
    project_repo: ProjectRepository = Depends(get_project_repo),
):
    role_ids = [str(r) for r in user.role_ids]
    result = await service.get_current_form(instance_id, role_ids=role_ids)
    if not result:
        raise HTTPException(status_code=404, detail="No current form or process completed")
    form = result["form"]
    node_id = result["node_id"]
    instance = result["instance"]
    submission_data = await service.get_submission_data(instance_id, node_id)
    context = {**(instance.context or {}), node_id: submission_data or {}, "role_ids": role_ids}
    flat_ctx = _flatten_context_for_validators(context)
    process_def = await process_repo.get_by_id(instance.process_definition_id)
    node_validators = []
    available_transitions: list[AvailableTransition] = []
    if process_def:
        current_node = process_def.get_node(node_id)
        keys = getattr(current_node, "validator_keys", None) or [] if current_node else []
        project = await project_repo.get_by_id(process_def.project_id) if process_def.project_id else None
        if keys and project and getattr(project, "validators", None):
            key_set = set(keys)
            node_validators = [v for v in project.validators if getattr(v, "type", None) == "field_visibility" and getattr(v, "key", None) in key_set]
        for edge in process_def.get_edges_from(node_id):
            if edge.condition_expression and not evaluate_expression(edge.condition_expression, flat_ctx):
                continue
            transition_keys = getattr(edge, "transition_validator_keys", None) or []
            if transition_keys and project and getattr(project, "validators", None):
                key_set = set(transition_keys)
                transition_validators = [v for v in project.validators if getattr(v, "type", None) == "step_access" and getattr(v, "key", None) in key_set]
                if transition_validators and not run_step_access_validators(transition_validators, flat_ctx, edge.target_node_id):
                    continue
            available_transitions.append(AvailableTransition(
                edge_id=edge.id,
                key=getattr(edge, "key", "") or edge.id,
                label=getattr(edge, "label", "") or "",
                target_node_id=edge.target_node_id,
            ))
    form_def = await _form_to_dict(form, context, catalog_repo, validators=node_validators)
    return CurrentFormResponse(
        instance_id=str(instance.id),
        node_id=node_id,
        form_definition=form_def,
        submission_data=submission_data,
        available_transitions=available_transitions,
    )


@router.post("/instances/{instance_id}/nodes/{node_id}/save")
async def save_step(
    instance_id: UUID,
    node_id: str,
    body: SaveStepRequest,
    user: User = Depends(get_current_user_required),
    service: RuntimeService = Depends(get_runtime_service),
):
    result = await service.get_current_form(instance_id, role_ids=[str(r) for r in user.role_ids])
    if not result or result["node_id"] != node_id:
        raise HTTPException(status_code=400, detail="Invalid step or process state")
    form = result["form"]
    ok = await service.save_step_data(instance_id, node_id, form.id, body.data)
    if not ok:
        raise HTTPException(status_code=403, detail="Save failed")
    return {"saved": True}


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
    instance = await service.submit_form(
        instance_id, node_id, form_def_id, body.data, role_ids=role_ids, chosen_edge_key=body.chosen_edge_key
    )
    if not instance:
        raise HTTPException(status_code=403, detail="Submit failed")
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
        document_number=instance.document_number,
        process_definition_id=str(instance.process_definition_id),
        current_node_id=instance.current_node_id,
        status=instance.status.value,
        context=instance.context,
    )
