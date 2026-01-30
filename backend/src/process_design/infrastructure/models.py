from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.identity.infrastructure.models import Base, gen_uuid


class ProcessDefinitionModel(Base):
    __tablename__ = "process_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    nodes_schema: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    edges_schema: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
