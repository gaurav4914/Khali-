from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Medicine Photo Intelligence Engine"
    environment: str = "development"
    api_key: str | None = None

    upload_dir: Path = Path("./runtime/uploads")
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1024, le=50 * 1024 * 1024)
    scan_ttl_seconds: int = Field(default=1800, ge=60, le=86400)

    ocr_provider: str = "tesseract"
    ocr_languages: str = "eng+hin"

    catalogue_mode: str = "none"
    catalogue_base_url: str | None = None
    catalogue_api_key: str | None = None
    catalogue_timeout_seconds: float = Field(default=8.0, ge=1.0, le=30.0)

    cors_origins: str = "http://localhost:19006,http://localhost:8081"

    @property
    def allowed_origins(self) -> list[str]:
        value = self.cors_origins.strip()
        if value == "*":
            return ["*"]
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
