from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os
from pathlib import Path

# Locate .env file either in backend directory or project root
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
ENV_FILE = CURRENT_DIR.parent / ".env" if (CURRENT_DIR.parent / ".env").exists() else PROJECT_ROOT / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres@127.0.0.1:5433/exam_db"

    # Security & JWT
    JWT_SECRET: str = "supersecretjwtkey_change_in_production_min32chars_required!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # AI & Subjective Evaluation
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"

    # OCR
    OCR_PROVIDER: str = "tesseract"
    GOOGLE_VISION_API_KEY: Optional[str] = None

    # Proctoring Suspicion Score Parameters (Capped at 100)
    FACE_ABSENT_SCORE: int = 10
    MULTIPLE_FACES_SCORE: int = 25
    GAZE_AWAY_SCORE: int = 5
    TAB_SWITCH_SCORE: int = 10
    WINDOW_BLUR_SCORE: int = 5
    MAX_SUSPICION_SCORE: int = 100

    # Server settings
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8001
    PROJECT_NAME: str = "AI-Based Intelligent Examination Platform"
    API_V1_STR: str = "/api"

    # File uploads
    UPLOAD_DIR: str = str(CURRENT_DIR.parent / "uploads")

settings = Settings()
