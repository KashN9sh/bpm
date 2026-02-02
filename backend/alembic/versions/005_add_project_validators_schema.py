"""add validators_schema to projects

Revision ID: 005
Revises: 004
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "005"
down_revision: Union[str, Sequence[str], None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("projects")]
    if "validators_schema" not in cols:
        op.add_column(
            "projects",
            sa.Column("validators_schema", sa.Text(), nullable=False, server_default="[]"),
        )


def downgrade() -> None:
    op.drop_column("projects", "validators_schema")
