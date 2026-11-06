from typing import Protocol
from urllib.parse import quote, urlparse

import httpx

from .schemas import CatalogueProduct, CompositionComponent


class CatalogueAdapterError(RuntimeError):
    pass


class CatalogueAdapter(Protocol):
    async def search(
        self, *, query: str | None = None, barcode: str | None = None
    ) -> list[CatalogueProduct]: ...

    async def search_by_composition(
        self,
        components: list[CompositionComponent],
        *,
        page: int,
        page_size: int,
    ) -> list[CatalogueProduct]: ...

    async def get_product(self, product_id: str) -> CatalogueProduct | None: ...


class EmptyCatalogueAdapter:
    """Default adapter. No demo medicines and no shared catalogue are bundled."""

    async def search(self, *, query: str | None = None, barcode: str | None = None):
        return []

    async def search_by_composition(
        self,
        components: list[CompositionComponent],
        *,
        page: int,
        page_size: int,
    ):
        return []

    async def get_product(self, product_id: str):
        return None


class RestCatalogueAdapter:
    """Read-only adapter for the buyer's authorised catalogue API.

    Expected buyer endpoints:
      GET  {base_url}/products?query=<text>&barcode=<gtin>
      POST {base_url}/products/search-by-composition
      GET  {base_url}/products/{product_id}

    Search-by-composition is a read-only POST contract. It must return every matching
    record in the requested page, with structured composition_components.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        timeout_seconds: float = 8.0,
    ) -> None:
        parsed = urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("CATALOGUE_BASE_URL must be an absolute HTTP(S) URL.")
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    @property
    def _headers(self) -> dict[str, str]:
        if self.api_key:
            return {"Authorization": f"Bearer {self.api_key}"}
        return {}

    @staticmethod
    def _parse_products(payload) -> list[CatalogueProduct]:
        items = payload.get("items", []) if isinstance(payload, dict) else payload
        if not isinstance(items, list):
            raise CatalogueAdapterError("Buyer catalogue response must contain an items list.")
        try:
            return [CatalogueProduct.model_validate(item) for item in items]
        except (ValueError, TypeError) as exc:
            raise CatalogueAdapterError("Buyer catalogue returned an invalid product record.") from exc

    async def search(
        self, *, query: str | None = None, barcode: str | None = None
    ) -> list[CatalogueProduct]:
        params = {}
        if query:
            params["query"] = query
        if barcode:
            params["barcode"] = barcode
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    f"{self.base_url}/products",
                    params=params,
                    headers=self._headers,
                )
                response.raise_for_status()
                return self._parse_products(response.json())
        except CatalogueAdapterError:
            raise
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise CatalogueAdapterError(
                f"Buyer catalogue search failed: {type(exc).__name__}"
            ) from exc

    async def search_by_composition(
        self,
        components: list[CompositionComponent],
        *,
        page: int,
        page_size: int,
    ) -> list[CatalogueProduct]:
        payload = {
            "components": [
                {
                    "ingredient_key": item.ingredient_key,
                    "ingredient_name": item.ingredient_name,
                    "ingredient_role": item.ingredient_role.value,
                    "strength_value": item.strength_value,
                    "strength_unit": item.strength_unit,
                }
                for item in components
                if item.ingredient_role.value == "active"
            ],
            "page": page,
            "page_size": page_size,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/products/search-by-composition",
                    headers={**self._headers, "Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
                return self._parse_products(response.json())
        except CatalogueAdapterError:
            raise
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise CatalogueAdapterError(
                f"Buyer catalogue composition search failed: {type(exc).__name__}"
            ) from exc

    async def get_product(self, product_id: str) -> CatalogueProduct | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    f"{self.base_url}/products/{quote(product_id, safe='')}",
                    headers=self._headers,
                )
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                return CatalogueProduct.model_validate(response.json())
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise CatalogueAdapterError(
                f"Buyer catalogue lookup failed: {type(exc).__name__}"
            ) from exc
