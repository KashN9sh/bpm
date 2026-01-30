from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class Project:
    """Подпроект документов — настраивается админом, группирует процессы и документы."""
    id: UUID
    name: str
    description: str = ""
    sort_order: int = 0
    list_columns: list[str] = field(default_factory=lambda: ["process_name", "status"])
