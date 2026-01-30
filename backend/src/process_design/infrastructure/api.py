from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.database import get_session
from src.identity.domain import User
from src.identity.infrastructure.deps import get_current_user_required, require_admin
from src.process_design.application.process_service import ProcessService
from src.process_design.infrastructure.repository import ProcessDefinitionRepository

router = APIRouter(prefix="/api/processes", tags=["processes"])


class NodeSchema(BaseModel):
    id: str
    node_type: str = "step"
    label: str = ""
    form_definition_id: str | None = None
    position_x: float = 0.0
    position_y: float = 0.0
    expression: str | None = None


class EdgeSchema(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    label: str = ""
    condition_expression: str | None = None


class ProcessCreate(BaseModel):
    name: str
    description: str = ""
    nodes: list[NodeSchema] | None = None
    edges: list[EdgeSchema] | None = None


class ProcessUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    nodes: list[NodeSchema] | None = None
    edges: list[EdgeSchema] | None = None


class ProcessResponse(BaseModel):
    id: str
    name: str
    description: str
    version: int
    nodes: list[dict]
    edges: list[dict]


def _process_to_response(p) -> ProcessResponse:
    nodes = [
        {
            "id": n.id,
            "node_type": n.node_type.value,
            "label": n.label,
            "form_definition_id": n.form_definition_id,
            "position_x": n.position_x,
            "position_y": n.position_y,
            "expression": n.expression,
        }
        for n in p.nodes
    ]
    edges = [
        {
            "id": e.id,
            "source_node_id": e.source_node_id,
            "target_node_id": e.target_node_id,
            "label": e.label,
            "condition_expression": e.condition_expression,
        }
        for e in p.edges
    ]
    return ProcessResponse(
        id=str(p.id),
        name=p.name,
        description=p.description,
        version=p.version,
        nodes=nodes,
        edges=edges,
    )


def get_process_repo(session=Depends(get_session)) -> ProcessDefinitionRepository:
    return ProcessDefinitionRepository(session)


def get_process_service(repo: ProcessDefinitionRepository = Depends(get_process_repo)) -> ProcessService:
    return ProcessService(repo)


@router.post("", response_model=ProcessResponse)
async def create_process(
    body: ProcessCreate,
    _admin: User = Depends(require_admin),
    service: ProcessService = Depends(get_process_service),
):
    nodes = [n.model_dump() for n in (body.nodes or [])]
    edges = [e.model_dump() for e in (body.edges or [])]
    process = await service.create_process(
        name=body.name, description=body.description, nodes=nodes, edges=edges
    )
    return _process_to_response(process)


@router.get("", response_model=list[ProcessResponse])
async def list_processes(
    _user: User = Depends(get_current_user_required),
    service: ProcessService = Depends(get_process_service),
):
    processes = await service.list_processes()
    return [_process_to_response(p) for p in processes]


@router.get("/{process_id}", response_model=ProcessResponse)
async def get_process(
    process_id: UUID,
    _user: User = Depends(get_current_user_required),
    service: ProcessService = Depends(get_process_service),
):
    process = await service.get_process(process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    return _process_to_response(process)


@router.patch("/{process_id}", response_model=ProcessResponse)
async def update_process(
    process_id: UUID,
    body: ProcessUpdate,
    _admin: User = Depends(require_admin),
    service: ProcessService = Depends(get_process_service),
):
    nodes = [n.model_dump() for n in body.nodes] if body.nodes is not None else None
    edges = [e.model_dump() for e in body.edges] if body.edges is not None else None
    process = await service.update_process(
        process_id, name=body.name, description=body.description, nodes=nodes, edges=edges
    )
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    return _process_to_response(process)


@router.delete("/{process_id}", status_code=204)
async def delete_process(
    process_id: UUID,
    _admin: User = Depends(require_admin),
    service: ProcessService = Depends(get_process_service),
):
    ok = await service.delete_process(process_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Process not found")
