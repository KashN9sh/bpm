from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from src.config import settings
from src.identity.infrastructure.models import Base
from src.form_builder.infrastructure.models import FormDefinitionModel  # noqa: F401 - register table
from src.process_design.infrastructure.models import ProcessDefinitionModel  # noqa: F401 - register table
from src.runtime.infrastructure.models import ProcessInstanceModel, FormSubmissionModel  # noqa: F401 - register tables
from src.catalogs.infrastructure.models import CatalogModel  # noqa: F401 - register table

engine = create_async_engine(
    settings.database_url,
    echo=False,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def ensure_admin_role():
    """Создаёт роль admin, если её ещё нет."""
    from src.identity.infrastructure.repository import IdentityRepository

    async with async_session_factory() as session:
        repo = IdentityRepository(session)
        roles = await repo.list_roles()
        if not any(r.name == "admin" for r in roles):
            await repo.create_role("admin")
        await session.commit()
