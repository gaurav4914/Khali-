import base64
import json
from pathlib import Path
from typing import Any, Protocol

import httpx


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


class GeminiVisionProvider:
    """Buyer-configured Gemini Vision adapter using buyer-supplied API credentials."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3.8-flash",
        timeout_seconds: float = 15.0,
    ) -> None:
        if not api_key:
            raise ValueError("A buyer-supplied GEMINI_API_KEY is required for GeminiVisionProvider.")
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def inspect_packaging(self, image_paths: list[Path]) -> dict[str, Any]:
        if not image_paths:
            return {"raw_text": "", "components": []}

        parts: list[dict[str, Any]] = []
        for path in image_paths:
            mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            parts.append({"inline_data": {"mime_type": mime, "data": encoded}})

        parts.append(
            {
                "text": (
                    "Read only the literal visible text printed on this medicine packaging. "
                    "Never guess or invent missing ingredients, strengths, or dosage forms. "
                    "Return JSON with keys: printed_product_name, printed_composition_text, "
                    "manufacturer_text, dosage_form_text, release_type_text, route_text, "
                    "and raw_text."
                )
            }
        )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent"
        )
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                url,
                headers={
                    "x-goog-api-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "{}")
            )
            return json.loads(text)
