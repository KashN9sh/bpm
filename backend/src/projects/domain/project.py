from dataclasses import dataclass
from uuid import UUID


@dataclass
class Project:
    """Подпроект документов — настраивается админом, группирует процессы и документы."""
    id: UUID
    name: str
    description: str = ""
    sort_order: int = 0
