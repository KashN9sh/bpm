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
    id: str
    node_type: NodeType
    label: str = ""
    form_definition_id: str | None = None  # для step — привязка формы
    position_x: float = 0.0
    position_y: float = 0.0
    expression: str | None = None  # для gateway — условие перехода


@dataclass
class Edge:
    id: str
    source_node_id: str
    target_node_id: str
    label: str = ""
    condition_expression: str | None = None  # опциональное условие на ребре


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
