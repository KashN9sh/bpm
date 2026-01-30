from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.identity.infrastructure.models import Base, gen_uuid


class ProcessInstanceModel(Base):
    __tablename__ = "process_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    process_definition_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    current_node_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    context: Mapped[str] = mapped_column(Text, nullable=False, default="{}")


class FormSubmissionModel(Base):
    __tablename__ = "form_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    process_instance_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    node_id: Mapped[str] = mapped_column(String(100), nullable=False)
    form_definition_id: Mapped[str] = mapped_column(String(36), nullable=False)
    data: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
