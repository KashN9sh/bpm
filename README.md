# BPM

BPM-система с DDD: пользователь конструирует бизнес-логику (процессы, формы, доступ к полям) через конструкторы.

## Стек

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy (async), PostgreSQL / SQLite
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

### Локально

**Backend**

```bash
cd backend
pip install -r requirements.txt
# Опционально: .env с DATABASE_URL, SECRET_KEY
export PYTHONPATH=src
uvicorn main:app --reload --app-dir src
```

По умолчанию БД: `sqlite+aiosqlite:///./bpm.db`.

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
```

Каждый контекст: `domain/`, `application/`, `infrastructure/` (API, репозитории, модели).
