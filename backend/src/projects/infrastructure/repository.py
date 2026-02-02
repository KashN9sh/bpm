import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.projects.domain import Project, ProjectField, Validator
from src.projects.infrastructure.models import ProjectModel


def _parse_list_columns(raw: str | None) -> list[str]:
    if not raw:
        return ["process_name", "status"]
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else ["process_name", "status"]
    except (json.JSONDecodeError, TypeError):
        return ["process_name", "status"]


def _parse_fields_schema(raw: str | None) -> list[ProjectField]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        out = []
        for item in parsed:
            if isinstance(item, dict) and "key" in item and "label" in item:
                out.append(ProjectField(
                    key=str(item["key"]),
                    label=str(item.get("label", item["key"])),
                    field_type=str(item.get("field_type", "text")),
                    catalog_id=item.get("catalog_id") or None,
                    options=item.get("options") if isinstance(item.get("options"), list) else None,
                ))
        return out
    except (json.JSONDecodeError, TypeError):
        return []


def _serialize_fields(fields: list[ProjectField]) -> str:
    arr = [
        {
            "key": f.key,
            "label": f.label,
            "field_type": f.field_type,
            "catalog_id": f.catalog_id,
            "options": f.options,
        }
        for f in fields
    ]
    return json.dumps(arr)


def _validator_key_from_item(item: dict, index: int) -> str:
    """Системное имя: из key или из name (slug) или индекс."""
    if isinstance(item.get("key"), str) and item["key"].strip():
        return item["key"].strip()
    name = (item.get("name") or "validator").strip() or "validator"
    slug = "".join(c if c.isalnum() or c in "_-" else "_" for c in name).strip("_") or "validator"
    return slug.lower() if slug else f"validator_{index}"


def _parse_validators_schema(raw: str | None) -> list[Validator]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        out = []
        for i, item in enumerate(parsed):
            if isinstance(item, dict) and "name" in item and "type" in item and "code" in item:
                key = _validator_key_from_item(item, i)
                out.append(Validator(
                    key=key,
                    name=str(item["name"]),
                    type=str(item["type"]),
                    code=str(item["code"]),
                ))
        return out
    except (json.JSONDecodeError, TypeError):
        return []


def _serialize_validators(validators: list[Validator]) -> str:
    arr = [{"key": v.key, "name": v.name, "type": v.type, "code": v.code} for v in validators]
    return json.dumps(arr)


class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        name: str,
        description: str = "",
        sort_order: int = 0,
        list_columns: list[str] | None = None,
        fields: list[ProjectField] | None = None,
        validators: list[Validator] | None = None,
    ) -> Project:
        cols = list_columns if list_columns is not None else ["process_name", "status"]
        model = ProjectModel(
            name=name,
            description=description,
            sort_order=sort_order,
            list_columns=json.dumps(cols),
            fields_schema=_serialize_fields(fields or []),
            validators_schema=_serialize_validators(validators or []),
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return Project(
            id=UUID(model.id),
            name=model.name,
            description=model.description or "",
            sort_order=model.sort_order or 0,
            list_columns=_parse_list_columns(model.list_columns),
            fields=_parse_fields_schema(getattr(model, "fields_schema", None)),
            validators=_parse_validators_schema(getattr(model, "validators_schema", None)),
        )

    async def get_by_id(self, project_id: UUID) -> Project | None:
        result = await self._session.execute(
            select(ProjectModel).where(ProjectModel.id == str(project_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return Project(
            id=UUID(row.id),
            name=row.name,
            description=row.description or "",
            sort_order=row.sort_order or 0,
            list_columns=_parse_list_columns(getattr(row, "list_columns", None)),
            fields=_parse_fields_schema(getattr(row, "fields_schema", None)),
            validators=_parse_validators_schema(getattr(row, "validators_schema", None)),
        )

    async def list_all(self) -> list[Project]:
        result = await self._session.execute(
            select(ProjectModel).order_by(ProjectModel.sort_order, ProjectModel.name)
        )
        rows = result.scalars().all()
        return [
            Project(
                id=UUID(r.id),
                name=r.name,
                description=r.description or "",
                sort_order=r.sort_order or 0,
                list_columns=_parse_list_columns(getattr(r, "list_columns", None)),
                fields=_parse_fields_schema(getattr(r, "fields_schema", None)),
                validators=_parse_validators_schema(getattr(r, "validators_schema", None)),
            )
            for r in rows
        ]

    async def update(
        self,
        project_id: UUID,
        name: str | None = None,
        description: str | None = None,
        sort_order: int | None = None,
        list_columns: list[str] | None = None,
        fields: list[ProjectField] | None = None,
        validators: list[Validator] | None = None,
    ) -> Project | None:
        result = await self._session.execute(
            select(ProjectModel).where(ProjectModel.id == str(project_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        if name is not None:
            row.name = name
        if description is not None:
            row.description = description
        if sort_order is not None:
            row.sort_order = sort_order
        if list_columns is not None:
            row.list_columns = json.dumps(list_columns)
        if fields is not None:
            row.fields_schema = _serialize_fields(fields)
        if validators is not None:
            row.validators_schema = _serialize_validators(validators)
        await self._session.flush()
        await self._session.refresh(row)
        return Project(
            id=UUID(row.id),
            name=row.name,
            description=row.description or "",
            sort_order=row.sort_order or 0,
            list_columns=_parse_list_columns(getattr(row, "list_columns", None)),
            fields=_parse_fields_schema(getattr(row, "fields_schema", None)),
            validators=_parse_validators_schema(getattr(row, "validators_schema", None)),
        )

    async def delete(self, project_id: UUID) -> bool:
        result = await self._session.execute(
            select(ProjectModel).where(ProjectModel.id == str(project_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True
