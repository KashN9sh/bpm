from uuid import UUID

from src.form_builder.domain import FormDefinition, FieldDefinition


class FormService:
    def __init__(self, form_repository):
        self._repo = form_repository

    async def create_form(self, name: str, description: str = "", fields: list[dict] | None = None) -> FormDefinition:
        form = await self._repo.create(name=name, description=description, fields=fields or [])
        return form

    async def get_form(self, form_id: UUID) -> FormDefinition | None:
        return await self._repo.get_by_id(form_id)

    async def list_forms(self) -> list[FormDefinition]:
        return await self._repo.list_all()

    async def update_form(
        self, form_id: UUID, name: str | None = None, description: str | None = None, fields: list[dict] | None = None
    ) -> FormDefinition | None:
        return await self._repo.update(form_id, name=name, description=description, fields=fields)

    async def delete_form(self, form_id: UUID) -> bool:
        return await self._repo.delete(form_id)
