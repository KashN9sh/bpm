from dataclasses import dataclass, field
from uuid import UUID
from typing import Any


@dataclass
class ProjectField:
    """Определение поля проекта: используется в конструкторе форм и в списке документов."""
    key: str
    label: str
    field_type: str  # text, number, date, select, textarea, ...
    catalog_id: str | None = None
    options: list[dict[str, Any]] | None = None


@dataclass
class Project:
    """Подпроект документов — настраивается админом, группирует процессы и документы."""
    id: UUID
    name: str
    description: str = ""
    sort_order: int = 0
    list_columns: list[str] = field(default_factory=lambda: ["process_name", "status"])
    fields: list[ProjectField] = field(default_factory=list)
