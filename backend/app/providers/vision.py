from pathlib import Path
from typing import Protocol, Any


class VisionProvider(Protocol):
    """Buyer-configured vision provider contract.

    Implementations may interpret label layout and return candidate printed fields.
    They must preserve literal evidence and must never fill unreadable fields by guessing.
    """

    async def inspect_packaging(self, image_paths: list[Path]) -> dict[str, Any]: ...


class VisionProviderDisabled:
    """Default placeholder. No cloud provider or developer-owned API key is included."""

    async def inspect_packaging(self, image_paths: list[Path]) -> dict[str, Any]:
        raise RuntimeError(
            "AI Vision is not configured. Add a buyer-owned provider adapter before enabling it."
        )
