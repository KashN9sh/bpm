import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.runtime.domain import ProcessInstance, FormSubmission, InstanceStatus
from src.runtime.infrastructure.models import ProcessInstanceModel, FormSubmissionModel


def _deserialize_instance(row: ProcessInstanceModel) -> ProcessInstance:
    context = json.loads(row.context) if row.context else {}
    return ProcessInstance(
        id=UUID(row.id),
        process_definition_id=UUID(row.process_definition_id),
        current_node_id=row.current_node_id,
        status=InstanceStatus(row.status) if row.status else InstanceStatus.ACTIVE,
        context=context,
    )


class ProcessInstanceRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        process_definition_id: UUID,
        current_node_id: str,
        status: InstanceStatus = InstanceStatus.ACTIVE,
        context: dict | None = None,
    ) -> ProcessInstance:
        model = ProcessInstanceModel(
            process_definition_id=str(process_definition_id),
            current_node_id=current_node_id,
            status=status.value,
            context=json.dumps(context or {}),
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return _deserialize_instance(model)

    async def get_by_id(self, instance_id: UUID) -> ProcessInstance | None:
        result = await self._session.execute(
            select(ProcessInstanceModel).where(ProcessInstanceModel.id == str(instance_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _deserialize_instance(row)

    async def update(
        self,
        instance_id: UUID,
        current_node_id: str | None = None,
        status: InstanceStatus | None = None,
        context: dict | None = None,
    ) -> ProcessInstance | None:
        result = await self._session.execute(
            select(ProcessInstanceModel).where(ProcessInstanceModel.id == str(instance_id))
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        if current_node_id is not None:
            row.current_node_id = current_node_id
        if status is not None:
            row.status = status.value
        if context is not None:
            row.context = json.dumps(context)
        await self._session.flush()
        await self._session.refresh(row)
        return _deserialize_instance(row)

    async def list_by_process(self, process_definition_id: UUID):
        result = await self._session.execute(
            select(ProcessInstanceModel).where(
                ProcessInstanceModel.process_definition_id == str(process_definition_id)
            )
        )
        rows = result.scalars().all()
        return [_deserialize_instance(r) for r in rows]

    async def list_all(self):
        result = await self._session.execute(
            select(ProcessInstanceModel).order_by(ProcessInstanceModel.id.desc())
        )
        rows = result.scalars().all()
        return [_deserialize_instance(r) for r in rows]


class FormSubmissionRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        process_instance_id: UUID,
        node_id: str,
        form_definition_id: UUID,
        data: dict,
    ) -> FormSubmission:
        model = FormSubmissionModel(
            process_instance_id=str(process_instance_id),
            node_id=node_id,
            form_definition_id=str(form_definition_id),
            data=json.dumps(data),
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return FormSubmission(
            id=UUID(model.id),
            process_instance_id=UUID(model.process_instance_id),
            node_id=model.node_id,
            form_definition_id=UUID(model.form_definition_id),
            data=json.loads(model.data),
        )

    async def get_by_instance_and_node(self, instance_id: UUID, node_id: str) -> FormSubmission | None:
        result = await self._session.execute(
            select(FormSubmissionModel).where(
                FormSubmissionModel.process_instance_id == str(instance_id),
                FormSubmissionModel.node_id == node_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return FormSubmission(
            id=UUID(row.id),
            process_instance_id=UUID(row.process_instance_id),
            node_id=row.node_id,
            form_definition_id=UUID(row.form_definition_id),
            data=json.loads(row.data) if row.data else {},
        )
