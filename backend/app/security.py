import secrets

from fastapi import Header, HTTPException, status

from .config import Settings


def build_api_key_dependency(settings: Settings):
    async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
        if not settings.api_key:
            return
        if not x_api_key or not secrets.compare_digest(x_api_key, settings.api_key):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "invalid_api_key", "message": "A valid API key is required."},
            )
    return require_api_key
