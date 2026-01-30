# BPM

BPM-система с DDD: пользователь конструирует бизнес-логику (процессы, формы, доступ к полям) через конструкторы.

## Стек

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy (async), PostgreSQL
- **Frontend:** React 18+, TypeScript, Vite, React Flow, React Router
- **Архитектура:** DDD (bounded contexts: Identity, Form Builder, Process Design, Runtime, Rules)

## Запуск

### Docker

**Продакшен** (образы собираются, перезапуск — вручную):

```bash
docker compose up --build
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:8000  

**Разработка** (код монтируется, изменения подхватываются сами):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- **Frontend:** http://localhost:5173 (Vite dev server, hot reload)  
- **Backend:** http://localhost:8000 (uvicorn с `--reload`)  
- Код backend и frontend примонтирован из хоста — правки в файлах сразу отражаются.

PostgreSQL: localhost:5432 (логин/пароль/БД: `bpm`/`bpm`/`bpm`). Таблицы создаются при первом запросе к API.

**Первый админ в Docker** — когда контейнеры уже запущены, в другом терминале из корня проекта:

```bash
# с dev-конфигом:
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python -m src.cli db-init
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python -m src.cli user create --email admin@bpm.local --password changeme --admin

# или без dev (обычный compose):
docker compose exec backend python -m src.cli db-init
docker compose exec backend python -m src.cli user create --email admin@bpm.local --password changeme --admin
```

После этого войти: `admin@bpm.local` / `changeme`.

### Локально

**Backend**

```bash
cd backend
pip install -r requirements.txt
# В .env обязательно DATABASE_URL (postgresql+asyncpg://...), SECRET_KEY
export PYTHONPATH=src
uvicorn main:app --reload --app-dir src
```

**CLI** (из каталога `backend`, после `pip install -e .` или `pip install -r requirements.txt`):

```bash
# Инициализация БД и создание роли admin
python -m src.cli db-init

# Первый админ (пароль можно ввести по запросу)
python -m src.cli user create --email admin@example.com --admin
# или с паролем в аргументе:
python -m src.cli user create --email admin@example.com --password secret --admin

# Список пользователей и ролей
python -m src.cli user list
python -m src.cli role list

# Создать роль
python -m src.cli role create manager
```

Через entry point (после `pip install -e .`): `bpm db-init`, `bpm user create -e admin@test.local -a`, `bpm user list`, `bpm role list`, `bpm role create manager`.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173. API по умолчанию: http://localhost:8000 (задайте `VITE_API_URL` при необходимости).

## Возможности

1. **Identity** — пользователи, роли, JWT-авторизация (`/api/identity`).
2. **Конструктор форм** — создание форм, поля (тип, валидации), правила доступа к полям (роль / выражение → read / write / hidden).
3. **Редактор процессов** — диаграмма (React Flow): узлы Старт, Шаг, Условие, Конец; привязка формы к шагу; условия на рёбрах.
4. **Документы** — документ (экземпляр процесса) движется по шагам процесса; на каждом шаге — форма (по определению процесса). Список документов, создание документа (выбор процесса), заполнение форм по шагам.
5. **Условия и правила** — минимальный evaluator выражений для условий переходов и видимости/доступа к полям (без eval/exec).

## Структура (backend)

```
backend/src/
  identity/          # Пользователи, роли, JWT
  form_builder/       # FormDefinition, поля, доступ
  process_design/     # ProcessDefinition, узлы, рёбра
  runtime/            # ProcessInstance, FormSubmission
  rules/              # evaluator выражений
  config.py
  database.py
  main.py
  cli.py              # CLI: db-init, user create/list, role create/list
```

Каждый контекст: `domain/`, `application/`, `infrastructure/` (API, репозитории, модели).
