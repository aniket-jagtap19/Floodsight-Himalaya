import json
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend/.env or root .env if present
backend_dir = Path(__file__).resolve().parent.parent
root_dir = backend_dir.parent

load_dotenv(backend_dir / ".env")
load_dotenv(root_dir / ".env")

DEFAULT_CORS_ORIGINS: list[str] = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
]


class Settings:
    def __init__(self) -> None:
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        self.debug: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
        self.host: str = os.getenv("FASTAPI_HOST", "0.0.0.0")
        self.port: int = int(os.getenv("FASTAPI_PORT", "8000"))
        self.pipeline_mode: str = os.getenv("PIPELINE_MODE", "mock").lower()
        self.llm_provider: str = os.getenv("LLM_PROVIDER", "").lower()
        self.llm_api_key: str = os.getenv("LLM_API_KEY", "")
        self.llm_model: str = os.getenv("LLM_MODEL", "claude-haiku-5-5")

        raw_cors = os.getenv("CORS_ORIGINS", "")
        if raw_cors:
            if raw_cors.strip().startswith("["):
                try:
                    self.cors_origins: list[str] = json.loads(raw_cors)
                except json.JSONDecodeError:
                    self.cors_origins = [o.strip() for o in raw_cors.split(",") if o.strip()]
            else:
                self.cors_origins = [o.strip() for o in raw_cors.split(",") if o.strip()]
        else:
            self.cors_origins = list(DEFAULT_CORS_ORIGINS)

        raw_data_dir = os.getenv("DATA_DIR", "")
        if raw_data_dir:
            candidate = Path(raw_data_dir)
            if not candidate.is_absolute():
                candidate = (backend_dir / candidate).resolve()
            self.data_dir: Path = candidate
        else:
            self.data_dir = backend_dir / "data"


settings = Settings()
