from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str  # обязательна, в Docker задаётся через DATABASE_URL (PostgreSQL)
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
