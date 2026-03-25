import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "DisciplineOS"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/disciplineos")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
    
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY or self.SECRET_KEY == "your-secret-key-here-minimum-32-chars":
            import warnings
            warnings.warn(
                "\n" + "!" * 80 + "\n"
                "  CRITICAL SECURITY WARNING: SECRET_KEY is not set or using default value.\n"
                "  Authentication tokens can be forged. SET 'SECRET_KEY' in your .env file!\n"
                "!" * 80 + "\n"
            )
            # Use a dummy key for dev only if not strictly required
            if not self.SECRET_KEY:
                self.SECRET_KEY = "dev-insecure-key-do-not-use-in-prod-replace-immediately"

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return self.CORS_ORIGINS.split(",")

settings = Settings()
