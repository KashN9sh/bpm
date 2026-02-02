from dataclasses import dataclass, field
from enum import Enum
from uuid import UUID
from typing import Any


class NodeType(str, Enum):
    START = "start"
    STEP = "step"  # шаг с формой
    GATEWAY = "gateway"  # шлюз (условие)
    END = "end"


@dataclass
class Node:
    """Узел процесса. validator_keys — ключи валидаторов проекта (field_visibility), привязанных к этапу (шаг с формой)."""
    id: str
    node_type: NodeType
    label: str = ""
    form_definition_id: str | None = None  # для step — привязка формы
    position_x: float = 0.0
    position_y: float = 0.0
    expression: str | None = None  # для gateway — условие перехода
    validator_keys: list[str] = field(default_factory=list)  # ключи валидаторов проекта (видимость полей)


@dataclass
class Edge:
    """Ребро процесса. key — системное имя для логирования; label — название перехода; transition_validator_keys — ключи валидаторов (step_access)."""
    id: str
    source_node_id: str
    target_node_id: str
    key: str = ""  # системное имя (для логирования)
    label: str = ""  # название перехода
    condition_expression: str | None = None  # опциональное условие на ребре
    transition_validator_keys: list[str] = field(default_factory=list)  # ключи валидаторов проекта (доступ к этапу)


@dataclass
class ProcessDefinition:
    id: UUID
    name: str
    description: str
    version: int
    project_id: UUID | None = None
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)

    def get_node(self, node_id: str) -> Node | None:
        for n in self.nodes:
            if n.id == node_id:
                return n
        return None

    def get_start_node(self) -> Node | None:
        for n in self.nodes:
            if n.node_type == NodeType.START:
                return n
        return None

    def get_edges_from(self, node_id: str) -> list[Edge]:
        return [e for e in self.edges if e.source_node_id == node_id]
