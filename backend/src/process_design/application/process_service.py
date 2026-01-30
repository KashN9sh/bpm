from uuid import UUID

from src.process_design.domain import ProcessDefinition


class ProcessService:
    def __init__(self, process_repository):
        self._repo = process_repository

    async def create_process(self, name: str, description: str = "", nodes: list[dict] | None = None, edges: list[dict] | None = None) -> ProcessDefinition:
        return await self._repo.create(name=name, description=description, nodes=nodes or [], edges=edges or [])

    async def get_process(self, process_id: UUID) -> ProcessDefinition | None:
        return await self._repo.get_by_id(process_id)

    async def list_processes(self) -> list[ProcessDefinition]:
        return await self._repo.list_all()

    async def update_process(
        self,
        process_id: UUID,
        name: str | None = None,
        description: str | None = None,
        nodes: list[dict] | None = None,
        edges: list[dict] | None = None,
    ) -> ProcessDefinition | None:
        return await self._repo.update(process_id, name=name, description=description, nodes=nodes, edges=edges)

    async def delete_process(self, process_id: UUID) -> bool:
        return await self._repo.delete(process_id)
