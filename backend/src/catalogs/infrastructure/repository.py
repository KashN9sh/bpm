import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.catalogs.domain import Catalog, CatalogItem
from src.catalogs.infrastructure.models import CatalogModel


def _deserialize_catalog(row: CatalogModel) -> Catalog:
    items_data = json.loads(row.items_schema) if row.items_schema else []
    items = [
        CatalogItem(value=str(x.get("value", "")), label=str(x.get("label", x.get("value", ""))))
        for x in items_data
    ]
    return Catalog(
        id=UUID(row.id),
        name=row.name,
        description=row.description or "",
        items=items,
    )


class CatalogRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, name: str, description: str = "", items: list[dict] | None = None) -> Catalog:
        schema = json.dumps(items or [])
        model = CatalogModel(name=name, description=description, items_schema=schema)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return _deserialize_catalog(model)

    async def get_by_id(self, catalog_id: UUID) -> Catalog | None:
        result = await self._session.execute(
            select(CatalogModel).where(CatalogModel.id == str(catalog_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _deserialize_catalog(row)

    async def list_all(self) -> list[Catalog]:
        result = await self._session.execute(select(CatalogModel).order_by(CatalogModel.name))
        rows = result.scalars().all()
        return [_deserialize_catalog(r) for r in rows]

    async def update(
        self,
        catalog_id: UUID,
        name: str | None = None,
        description: str | None = None,
        items: list[dict] | None = None,
    ) -> Catalog | None:
        result = await self._session.execute(
            select(CatalogModel).where(CatalogModel.id == str(catalog_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        if name is not None:
            row.name = name
        if description is not None:
            row.description = description
        if items is not None:
            row.items_schema = json.dumps(items)
        await self._session.flush()
        await self._session.refresh(row)
        return _deserialize_catalog(row)

    async def delete(self, catalog_id: UUID) -> bool:
        result = await self._session.execute(
            select(CatalogModel).where(CatalogModel.id == str(catalog_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True
