"""add fields_schema to projects

Revision ID: 003
Revises: 002
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "003"
down_revision: Union[str, Sequence[str], None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("projects")]
    if "fields_schema" not in cols:
        op.add_column(
            "projects",
            sa.Column("fields_schema", sa.Text(), nullable=False, server_default="[]"),
        )


def downgrade() -> None:
    op.drop_column("projects", "fields_schema")
