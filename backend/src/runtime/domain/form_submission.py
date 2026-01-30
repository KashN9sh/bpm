from dataclasses import dataclass
from uuid import UUID
from typing import Any


@dataclass
class FormSubmission:
    id: UUID
    process_instance_id: UUID
    node_id: str
    form_definition_id: UUID
    data: dict[str, Any]  # значения полей формы
