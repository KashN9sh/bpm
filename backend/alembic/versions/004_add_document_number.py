"""add document_number (auto-increment) to process_instances

Revision ID: 004
Revises: 003
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "004"
down_revision: Union[str, Sequence[str], None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEQ_NAME = "process_instances_document_number_seq"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("process_instances")]
    if "document_number" in cols:
        return
    op.execute(f"CREATE SEQUENCE IF NOT EXISTS {SEQ_NAME}")
    op.add_column(
        "process_instances",
        sa.Column("document_number", sa.Integer(), nullable=True),
    )
    op.execute("""
        UPDATE process_instances p SET document_number = sub.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
            FROM process_instances
        ) sub
        WHERE p.id = sub.id
    """)
    op.execute(f"SELECT setval('{SEQ_NAME}', (SELECT COALESCE(MAX(document_number), 1) FROM process_instances))")
    op.alter_column(
        "process_instances",
        "document_number",
        nullable=False,
        server_default=sa.text(f"nextval('{SEQ_NAME}'::regclass)"),
    )


def downgrade() -> None:
    op.drop_column("process_instances", "document_number")
    op.execute(f"DROP SEQUENCE IF EXISTS {SEQ_NAME}")
