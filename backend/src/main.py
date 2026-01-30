from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.database import init_db
from src.identity.infrastructure.api import router as identity_router
from src.form_builder.infrastructure.api import router as forms_router
from src.process_design.infrastructure.api import router as processes_router
from src.runtime.infrastructure.api import router as runtime_router
from src.catalogs.infrastructure.api import router as catalogs_router


async def lifespan(app: FastAPI):
    from src.database import ensure_admin_role

    await init_db()
    await ensure_admin_role()
    yield
    # shutdown if needed


app = FastAPI(
    title="BPM API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(identity_router)
app.include_router(forms_router)
app.include_router(processes_router)
app.include_router(runtime_router)
app.include_router(catalogs_router)


@app.get("/health")
def health():
    return {"status": "ok"}
