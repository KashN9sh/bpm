from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class User:
    id: UUID
    email: str
    hashed_password: str
    role_ids: tuple[UUID, ...]

    @property
    def is_authenticated(self) -> bool:
        return True
