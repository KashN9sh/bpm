from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.identity.infrastructure.models import Base, gen_uuid


class CatalogModel(Base):
    __tablename__ = "catalogs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    items_schema: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
