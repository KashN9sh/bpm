"""add list_columns to projects

Revision ID: 002
Revises: 001
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002"
down_revision: Union[str, Sequence[str], None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("list_columns", sa.Text(), nullable=False, server_default='["process_name", "status"]'),
    )


def downgrade() -> None:
    op.drop_column("projects", "list_columns")
