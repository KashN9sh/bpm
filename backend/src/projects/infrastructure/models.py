from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.identity.infrastructure.models import Base, gen_uuid

_DEFAULT_LIST_COLUMNS = '["process_name", "status"]'
_DEFAULT_FIELDS_SCHEMA = "[]"


class ProjectModel(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    list_columns: Mapped[str] = mapped_column(Text, nullable=False, default=_DEFAULT_LIST_COLUMNS)
    fields_schema: Mapped[str] = mapped_column(Text, nullable=False, default=_DEFAULT_FIELDS_SCHEMA)
