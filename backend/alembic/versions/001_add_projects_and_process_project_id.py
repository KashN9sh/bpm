"""add projects table and project_id to process_definitions

Revision ID: 001
Revises:
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    if "projects" not in tables:
        op.create_table(
            "projects",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False, index=True),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
    if "process_definitions" in tables:
        cols = [c["name"] for c in inspector.get_columns("process_definitions")]
        if "project_id" not in cols:
            op.add_column(
                "process_definitions",
                sa.Column("project_id", sa.String(36), nullable=True, index=True),
            )


def downgrade() -> None:
    op.drop_column("process_definitions", "project_id")
    op.drop_table("projects")
