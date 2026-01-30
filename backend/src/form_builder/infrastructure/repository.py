import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.form_builder.domain import FormDefinition, FieldDefinition, FieldAccessRule, FieldType, AccessPermission
from src.form_builder.infrastructure.models import FormDefinitionModel


def _serialize_field(f: FieldDefinition) -> dict:
    return {
        "name": f.name,
        "label": f.label,
        "field_type": f.field_type.value,
        "required": f.required,
        "options": f.options,
        "catalog_id": f.catalog_id,
        "validations": f.validations,
        "access_rules": [
            {"role_id": r.role_id, "expression": r.expression, "permission": r.permission.value}
            for r in (f.access_rules or [])
        ],
    }


def _deserialize_field(d: dict) -> FieldDefinition:
    access_rules = [
        FieldAccessRule(
            role_id=x.get("role_id"),
            expression=x.get("expression"),
            permission=AccessPermission(x.get("permission", "read")),
        )
        for x in d.get("access_rules") or []
    ]
    return FieldDefinition(
        name=d["name"],
        label=d.get("label", d["name"]),
        field_type=FieldType(d.get("field_type", "text")),
        required=d.get("required", False),
        options=d.get("options"),
        catalog_id=d.get("catalog_id"),
        validations=d.get("validations"),
        access_rules=access_rules,
    )


def _deserialize_form(row: FormDefinitionModel) -> FormDefinition:
    fields_data = json.loads(row.fields_schema) if row.fields_schema else []
    fields = [_deserialize_field(f) for f in fields_data]
    return FormDefinition(
        id=UUID(row.id),
        name=row.name,
        description=row.description or "",
        fields=fields,
    )


class FormDefinitionRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, name: str, description: str = "", fields: list[dict] | None = None) -> FormDefinition:
        schema = json.dumps(fields or [])
        model = FormDefinitionModel(name=name, description=description, fields_schema=schema)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return _deserialize_form(model)

    async def get_by_id(self, form_id: UUID) -> FormDefinition | None:
        result = await self._session.execute(
            select(FormDefinitionModel).where(FormDefinitionModel.id == str(form_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _deserialize_form(row)

    async def list_all(self) -> list[FormDefinition]:
        result = await self._session.execute(select(FormDefinitionModel).order_by(FormDefinitionModel.name))
        rows = result.scalars().all()
        return [_deserialize_form(r) for r in rows]

    async def update(
        self,
        form_id: UUID,
        name: str | None = None,
        description: str | None = None,
        fields: list[dict] | None = None,
    ) -> FormDefinition | None:
        result = await self._session.execute(
            select(FormDefinitionModel).where(FormDefinitionModel.id == str(form_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        if name is not None:
            row.name = name
        if description is not None:
            row.description = description
        if fields is not None:
            row.fields_schema = json.dumps(fields)
        await self._session.flush()
        await self._session.refresh(row)
        return _deserialize_form(row)

    async def delete(self, form_id: UUID) -> bool:
        result = await self._session.execute(
            select(FormDefinitionModel).where(FormDefinitionModel.id == str(form_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True
