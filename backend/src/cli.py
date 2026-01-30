"""
CLI для BPM: инициализация БД, пользователи и роли.
Запуск: bpm <команда> или python -m src.cli <команда>
"""
import asyncio
import getpass

import typer

from src.database import async_session_factory, ensure_admin_role, init_db
from src.identity.application.auth_service import hash_password
from src.identity.infrastructure.deps import ADMIN_ROLE_NAME
from src.identity.infrastructure.repository import IdentityRepository

app = typer.Typer(help="BPM: управление БД, пользователями и ролями из командной строки.")


def _run(coro):
    return asyncio.run(coro)


@app.command()
def db_init():
    """Создать таблицы и роль admin (если её ещё нет)."""
    async def _init():
        await init_db()
        await ensure_admin_role()
        typer.echo("БД инициализирована, роль admin создана или уже есть.")

    _run(_init())


user_app = typer.Typer(help="Пользователи")
app.add_typer(user_app, name="user")


@user_app.command("create")
def user_create(
    email: str = typer.Option(..., "--email", "-e", help="Email пользователя"),
    password: str = typer.Option(None, "--password", "-p", help="Пароль (если не указан — запрос ввода)"),
    admin: bool = typer.Option(False, "--admin", "-a", help="Выдать роль admin"),
):
    """Создать пользователя."""
    if not password:
        password = getpass.getpass("Пароль: ")
    if not password:
        typer.echo("Пароль не задан.", err=True)
        raise typer.Exit(1)

    async def _create():
        await ensure_admin_role()
        async with async_session_factory() as session:
            repo = IdentityRepository(session)
            existing = await repo.get_user_by_email(email)
            if existing:
                typer.echo(f"Пользователь с email {email} уже существует.", err=True)
                raise typer.Exit(2)
            role_ids = None
            if admin:
                roles = await repo.list_roles()
                admin_role = next((r for r in roles if r.name == ADMIN_ROLE_NAME), None)
                if not admin_role:
                    typer.echo("Роль admin не найдена. Сначала выполните: bpm db-init", err=True)
                    raise typer.Exit(3)
                role_ids = [admin_role.id]
            user = await repo.create_user(
                email=email,
                hashed_password=hash_password(password),
                role_ids=role_ids,
            )
            await session.commit()
            typer.echo(f"Пользователь создан: {user.email} (id={user.id})")
            if admin:
                typer.echo("Роль admin назначена.")

    _run(_create())


@user_app.command("list")
def user_list():
    """Список пользователей."""
    async def _list():
        async with async_session_factory() as session:
            repo = IdentityRepository(session)
            users = await repo.list_users()
            for u in users:
                roles = await repo.get_roles_for_user(u.id)
                role_names = ",".join(r.name for r in roles) or "-"
                typer.echo(f"  {u.email}  id={u.id}  роли=[{role_names}]")

    _run(_list())


role_app = typer.Typer(help="Роли")
app.add_typer(role_app, name="role")


@role_app.command("create")
def role_create(
    name: str = typer.Argument(..., help="Название роли"),
):
    """Создать роль."""
    async def _create():
        async with async_session_factory() as session:
            repo = IdentityRepository(session)
            roles = await repo.list_roles()
            if any(r.name == name for r in roles):
                typer.echo(f"Роль «{name}» уже существует.", err=True)
                raise typer.Exit(2)
            role = await repo.create_role(name)
            await session.commit()
            typer.echo(f"Роль создана: {role.name} (id={role.id})")

    _run(_create())


@role_app.command("list")
def role_list():
    """Список ролей."""
    async def _list():
        async with async_session_factory() as session:
            repo = IdentityRepository(session)
            roles = await repo.list_roles()
            for r in roles:
                typer.echo(f"  {r.name}  id={r.id}")

    _run(_list())


if __name__ == "__main__":
    app()
