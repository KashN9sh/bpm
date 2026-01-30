from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.database import get_session
from src.catalogs.infrastructure.repository import CatalogRepository

router = APIRouter(prefix="/api/catalogs", tags=["catalogs"])


class CatalogItemSchema(BaseModel):
    value: str
    label: str


class CatalogCreate(BaseModel):
    name: str
    description: str = ""
    items: list[CatalogItemSchema] | None = None


class CatalogUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    items: list[CatalogItemSchema] | None = None


class CatalogResponse(BaseModel):
    id: str
    name: str
    description: str
    items: list[dict]


def get_catalog_repo(session=Depends(get_session)) -> CatalogRepository:
    return CatalogRepository(session)


def _catalog_to_response(c) -> CatalogResponse:
    return CatalogResponse(
        id=str(c.id),
        name=c.name,
        description=c.description,
        items=[{"value": i.value, "label": i.label} for i in c.items],
    )


@router.post("", response_model=CatalogResponse)
async def create_catalog(body: CatalogCreate, repo: CatalogRepository = Depends(get_catalog_repo)):
    items = [x.model_dump() for x in (body.items or [])]
    catalog = await repo.create(name=body.name, description=body.description, items=items)
    return _catalog_to_response(catalog)


@router.get("", response_model=list[CatalogResponse])
async def list_catalogs(repo: CatalogRepository = Depends(get_catalog_repo)):
    catalogs = await repo.list_all()
    return [_catalog_to_response(c) for c in catalogs]


@router.get("/{catalog_id}", response_model=CatalogResponse)
async def get_catalog(catalog_id: UUID, repo: CatalogRepository = Depends(get_catalog_repo)):
    catalog = await repo.get_by_id(catalog_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return _catalog_to_response(catalog)


@router.patch("/{catalog_id}", response_model=CatalogResponse)
async def update_catalog(
    catalog_id: UUID,
    body: CatalogUpdate,
    repo: CatalogRepository = Depends(get_catalog_repo),
):
    items = [x.model_dump() for x in body.items] if body.items is not None else None
    catalog = await repo.update(catalog_id, name=body.name, description=body.description, items=items)
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    return _catalog_to_response(catalog)


@router.delete("/{catalog_id}", status_code=204)
async def delete_catalog(catalog_id: UUID, repo: CatalogRepository = Depends(get_catalog_repo)):
    ok = await repo.delete(catalog_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Catalog not found")
