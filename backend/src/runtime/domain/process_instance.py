from dataclasses import dataclass
from enum import Enum
from uuid import UUID
from typing import Any


class InstanceStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class ProcessInstance:
    id: UUID
    document_number: int  # автоинкрементный № документа в БД
    process_definition_id: UUID
    current_node_id: str | None
    status: InstanceStatus
    context: dict[str, Any]  # данные, накопленные по шагам (form submissions)

    @property
    def is_active(self) -> bool:
        return self.status == InstanceStatus.ACTIVE

    @property
    def is_completed(self) -> bool:
        return self.status == InstanceStatus.COMPLETED
