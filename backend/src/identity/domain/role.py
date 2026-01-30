from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class Role:
    id: UUID
    name: str
