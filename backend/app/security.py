import secrets

from fastapi import Header, HTTPException, status

from .config import Settings


def build_api_key_dependency(settings: Settings):
    """Require an API key outside local development and test environments."""
    async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
        if settings.api_key and x_api_key and secrets.compare_digest(x_api_key, settings.api_key):
            return

        if (
            not settings.api_key
            and settings.environment.lower() in {"development", "dev", "test", "local"}
        ):
            return

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "invalid_api_key",
                "message": "A valid buyer-issued X-API-Key is required.",
            },
        )

    return require_api_key
