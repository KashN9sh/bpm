from uuid import UUID

from src.runtime.domain import ProcessInstance, FormSubmission, InstanceStatus
from src.rules.evaluator import evaluate_expression


class RuntimeService:
    def __init__(self, instance_repo, submission_repo, process_repo, form_repo):
        self._instance_repo = instance_repo
        self._submission_repo = submission_repo
        self._process_repo = process_repo
        self._form_repo = form_repo

    async def start_process(self, process_definition_id: UUID) -> ProcessInstance | None:
        process = await self._process_repo.get_by_id(process_definition_id)
        if not process:
            return None
        start_node = process.get_start_node()
        if not start_node:
            return None
        instance = await self._instance_repo.create(
            process_definition_id=process_definition_id,
            current_node_id=start_node.id,
            status=InstanceStatus.ACTIVE,
            context={},
        )
        return instance

    async def get_instance(self, instance_id: UUID) -> ProcessInstance | None:
        return await self._instance_repo.get_by_id(instance_id)

    async def list_documents(self, project_id: UUID | None = None) -> list[dict]:
        """Список документов (экземпляров процессов). Если задан project_id — только из этого подпроекта."""
        instances = await self._instance_repo.list_all()
        if project_id is not None:
            processes_in_project = await self._process_repo.list_all(project_id=project_id)
            pid_set = {p.id for p in processes_in_project}
            instances = [i for i in instances if i.process_definition_id in pid_set]
        out = []
        for inst in instances:
            process = await self._process_repo.get_by_id(inst.process_definition_id)
            out.append({
                "id": str(inst.id),
                "process_definition_id": str(inst.process_definition_id),
                "process_name": process.name if process else "",
                "process_project_id": str(process.project_id) if process and process.project_id else None,
                "status": inst.status.value,
                "current_node_id": inst.current_node_id,
            })
        return out

    async def get_current_form(self, instance_id: UUID, role_ids: list[str] | None = None):
        """Возвращает (form_definition, node_id, instance) для текущего шага или None если процесс завершён.
        Если текущий узел без формы (например start) — переходим по рёбрам к первому узлу с формой."""
        instance = await self._instance_repo.get_by_id(instance_id)
        if not instance or not instance.is_active or not instance.current_node_id:
            return None
        process = await self._process_repo.get_by_id(instance.process_definition_id)
        if not process:
            return None
        node_id = instance.current_node_id
        visited = set()
        while node_id and node_id not in visited:
            visited.add(node_id)
            node = process.get_node(node_id)
            if not node:
                return None
            if node.form_definition_id:
                form = await self._form_repo.get_by_id(UUID(node.form_definition_id))
                if form:
                    if node_id != instance.current_node_id:
                        await self._instance_repo.update(instance_id, current_node_id=node_id)
                        instance = await self._instance_repo.get_by_id(instance_id)
                    return {"form": form, "node_id": node.id, "instance": instance, "role_ids": role_ids or []}
            edges = process.get_edges_from(node_id)
            if not edges:
                return None
            node_id = edges[0].target_node_id
        return None

    async def get_submission_data(self, instance_id: UUID, node_id: str) -> dict | None:
        """Данные формы для узла (уже сохранённые)."""
        sub = await self._submission_repo.get_by_instance_and_node(instance_id, node_id)
        return sub.data if sub else None

    async def submit_form(
        self,
        instance_id: UUID,
        node_id: str,
        form_definition_id: UUID,
        data: dict,
    ) -> ProcessInstance | None:
        instance = await self._instance_repo.get_by_id(instance_id)
        if not instance or not instance.is_active or instance.current_node_id != node_id:
            return None
        process = await self._process_repo.get_by_id(instance.process_definition_id)
        if not process:
            return None
        node = process.get_node(node_id)
        if not node or str(node.form_definition_id) != str(form_definition_id):
            return None

        await self._submission_repo.create(
            process_instance_id=instance_id,
            node_id=node_id,
            form_definition_id=form_definition_id,
            data=data,
        )
        new_context = {**instance.context, node_id: data}
        edges = process.get_edges_from(node_id)
        next_node_id = None
        if len(edges) == 1:
            e = edges[0]
            if e.condition_expression and not evaluate_expression(e.condition_expression, new_context):
                next_node_id = None
            else:
                next_node_id = e.target_node_id
        elif len(edges) > 1:
            for e in edges:
                if e.condition_expression and not evaluate_expression(e.condition_expression, new_context):
                    continue
                next_node_id = e.target_node_id
                break
            if not next_node_id and edges:
                next_node_id = edges[0].target_node_id
        next_node = process.get_node(next_node_id) if next_node_id else None
        if not next_node:
            await self._instance_repo.update(
                instance_id,
                current_node_id=None,
                status=InstanceStatus.COMPLETED,
                context=new_context,
            )
        else:
            if next_node.node_type.value == "end":
                await self._instance_repo.update(
                    instance_id,
                    current_node_id=None,
                    status=InstanceStatus.COMPLETED,
                    context=new_context,
                )
            else:
                await self._instance_repo.update(
                    instance_id,
                    current_node_id=next_node.id,
                    context=new_context,
                )
        return await self._instance_repo.get_by_id(instance_id)
