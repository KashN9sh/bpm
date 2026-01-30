import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.process_design.domain import ProcessDefinition, Node, Edge, NodeType
from src.process_design.infrastructure.models import ProcessDefinitionModel


def _serialize_node(n: Node) -> dict:
    return {
        "id": n.id,
        "node_type": n.node_type.value,
        "label": n.label,
        "form_definition_id": n.form_definition_id,
        "position_x": n.position_x,
        "position_y": n.position_y,
        "expression": n.expression,
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
    )


def _serialize_edge(e: Edge) -> dict:
    return {
        "id": e.id,
        "source_node_id": e.source_node_id,
        "target_node_id": e.target_node_id,
        "label": e.label,
        "condition_expression": e.condition_expression,
    }


def _deserialize_edge(d: dict) -> Edge:
    return Edge(
        id=d["id"],
        source_node_id=d["source_node_id"],
        target_node_id=d["target_node_id"],
        label=d.get("label", ""),
        condition_expression=d.get("condition_expression"),
    )


def _deserialize_process(row: ProcessDefinitionModel) -> ProcessDefinition:
    nodes_data = json.loads(row.nodes_schema) if row.nodes_schema else []
    edges_data = json.loads(row.edges_schema) if row.edges_schema else []
    nodes = [_deserialize_node(n) for n in nodes_data]
    edges = [_deserialize_edge(e) for e in edges_data]
    return ProcessDefinition(
        id=UUID(row.id),
        name=row.name,
        description=row.description or "",
        version=row.version or 1,
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
        nodes: list[dict] | None = None,
        edges: list[dict] | None = None,
    ) -> ProcessDefinition:
        nodes_json = json.dumps(nodes or [])
        edges_json = json.dumps(edges or [])
        model = ProcessDefinitionModel(
            name=name,
            description=description,
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

    async def list_all(self) -> list[ProcessDefinition]:
        result = await self._session.execute(
            select(ProcessDefinitionModel).order_by(ProcessDefinitionModel.name)
        )
        rows = result.scalars().all()
        return [_deserialize_process(r) for r in rows]

    async def update(
        self,
        process_id: UUID,
        name: str | None = None,
        description: str | None = None,
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
