from dataclasses import dataclass
from uuid import UUID


@dataclass
class CatalogItem:
    value: str
    label: str


@dataclass
class Catalog:
    id: UUID
    name: str
    description: str
    items: list[CatalogItem]
