from sqlalchemy import Column, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.identity.infrastructure.models import Base, gen_uuid


class FormDefinitionModel(Base):
    __tablename__ = "form_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # fields + access rules stored as JSON for flexibility
    fields_schema: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
