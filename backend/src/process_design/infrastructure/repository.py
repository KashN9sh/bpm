import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.process_design.domain import ProcessDefinition, Node, Edge, NodeType
from src.process_design.infrastructure.models import ProcessDefinitionModel


def _validator_keys_from_node_dict(d: dict) -> list[str]:
    """Ключи валидаторов: из validator_keys или из старого формата validators (список объектов с key)."""
    keys = d.get("validator_keys")
    if isinstance(keys, list):
        return [str(k).strip() for k in keys if k]
    old = d.get("validators") or []
    if isinstance(old, list):
        return [str(v.get("key", v.get("name", ""))).strip() for v in old if isinstance(v, dict) and (v.get("key") or v.get("name"))]
    return []


def _serialize_node(n: Node) -> dict:
    return {
        "id": n.id,
        "node_type": n.node_type.value,
        "label": n.label,
        "form_definition_id": n.form_definition_id,
        "position_x": n.position_x,
        "position_y": n.position_y,
        "expression": n.expression,
        "validator_keys": getattr(n, "validator_keys", None) or [],
    }


def _deserialize_node(d: dict) -> Node:
    return Node(
        id=d["id"],
        node_type=NodeType(d.get("node_type", "step")),
        label=d.get("label", ""),
        form_definition_id=d.get("form_definition_id"),
        position_x=float(d.get("position_x", 0)),
        position_y=float(d.get("position_y", 0)),
        expression=d.get("expression"),
        validator_keys=_validator_keys_from_node_dict(d),
    )


def _transition_validator_keys_from_edge_dict(d: dict) -> list[str]:
    keys = d.get("transition_validator_keys")
    if isinstance(keys, list):
        return [str(k).strip() for k in keys if k]
    return []


def _edge_key_from_dict(d: dict) -> str:
    """Системное имя ребра: из key или из id для обратной совместимости."""
    k = d.get("key")
    if isinstance(k, str) and k.strip():
        return k.strip()
    return d.get("id", "") or ""


def _serialize_edge(e: Edge) -> dict:
    return {
        "id": e.id,
        "source_node_id": e.source_node_id,
        "target_node_id": e.target_node_id,
        "key": getattr(e, "key", None) or "",
        "label": e.label,
        "condition_expression": e.condition_expression,
        "transition_validator_keys": getattr(e, "transition_validator_keys", None) or [],
    }


def _deserialize_edge(d: dict) -> Edge:
    return Edge(
        id=d["id"],
        source_node_id=d["source_node_id"],
        target_node_id=d["target_node_id"],
        key=_edge_key_from_dict(d),
        label=d.get("label", ""),
        condition_expression=d.get("condition_expression"),
        transition_validator_keys=_transition_validator_keys_from_edge_dict(d),
    )


def _deserialize_process(row: ProcessDefinitionModel) -> ProcessDefinition:
    nodes_data = json.loads(row.nodes_schema) if row.nodes_schema else []
    edges_data = json.loads(row.edges_schema) if row.edges_schema else []
    nodes = [_deserialize_node(n) for n in nodes_data]
    edges = [_deserialize_edge(e) for e in edges_data]
    project_id = UUID(row.project_id) if getattr(row, "project_id", None) else None
    return ProcessDefinition(
        id=UUID(row.id),
        name=row.name,
        description=row.description or "",
        version=row.version or 1,
        project_id=project_id,
        nodes=nodes,
        edges=edges,
    )


class ProcessDefinitionRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        name: str,
        description: str = "",
        project_id: UUID | None = None,
        nodes: list[dict] | None = None,
        edges: list[dict] | None = None,
    ) -> ProcessDefinition:
        nodes_json = json.dumps(nodes or [])
        edges_json = json.dumps(edges or [])
        model = ProcessDefinitionModel(
            name=name,
            description=description,
            project_id=str(project_id) if project_id else None,
            nodes_schema=nodes_json,
            edges_schema=edges_json,
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return _deserialize_process(model)

    async def get_by_id(self, process_id: UUID) -> ProcessDefinition | None:
        result = await self._session.execute(
            select(ProcessDefinitionModel).where(ProcessDefinitionModel.id == str(process_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _deserialize_process(row)

    async def list_all(self, project_id: UUID | None = None) -> list[ProcessDefinition]:
        q = select(ProcessDefinitionModel).order_by(ProcessDefinitionModel.name)
        if project_id is not None:
            q = q.where(ProcessDefinitionModel.project_id == str(project_id))
        result = await self._session.execute(q)
        rows = result.scalars().all()
        return [_deserialize_process(r) for r in rows]

    async def update(
        self,
        process_id: UUID,
        name: str | None = None,
        description: str | None = None,
        project_id: UUID | None = None,
        nodes: list[dict] | None = None,
        edges: list[dict] | None = None,
    ) -> ProcessDefinition | None:
        result = await self._session.execute(
            select(ProcessDefinitionModel).where(ProcessDefinitionModel.id == str(process_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        if name is not None:
            row.name = name
        if description is not None:
            row.description = description
        if project_id is not None:
            row.project_id = str(project_id) if project_id else None
        if nodes is not None:
            row.nodes_schema = json.dumps(nodes)
        if edges is not None:
            row.edges_schema = json.dumps(edges)
        await self._session.flush()
        await self._session.refresh(row)
        return _deserialize_process(row)

    async def delete(self, process_id: UUID) -> bool:
        result = await self._session.execute(
            select(ProcessDefinitionModel).where(ProcessDefinitionModel.id == str(process_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True
