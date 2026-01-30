from dataclasses import dataclass, field
from enum import Enum
from uuid import UUID
from typing import Any


class FieldType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    SELECT = "select"
    MULTISELECT = "multiselect"
    TEXTAREA = "textarea"


class AccessPermission(str, Enum):
    READ = "read"
    WRITE = "write"
    HIDDEN = "hidden"


@dataclass(frozen=False)
class FieldAccessRule:
    """Правило доступа к полю: по роли или по выражению."""
    role_id: str | None  # если задано — правило по роли
    expression: str | None  # если задано — условие по данным (e.g. "field_x > 10")
    permission: AccessPermission


@dataclass(frozen=False)
class FieldDefinition:
    name: str
    label: str
    field_type: FieldType
    required: bool = False
    options: list[dict[str, Any]] | None = None  # для select/multiselect: [{"value": "a", "label": "A"}]
    validations: dict[str, Any] | None = None  # e.g. {"min": 0, "max": 100}
    access_rules: list[FieldAccessRule] = field(default_factory=list)  # правила видимости/редактирования


@dataclass
class FormDefinition:
    id: UUID
    name: str
    description: str
    fields: list[FieldDefinition] = field(default_factory=list)

    def add_field(self, field: FieldDefinition) -> None:
        self.fields.append(field)

    def remove_field(self, name: str) -> None:
        self.fields[:] = [f for f in self.fields if f.name != name]

    def get_field(self, name: str) -> FieldDefinition | None:
        for f in self.fields:
            if f.name == name:
                return f
        return None
