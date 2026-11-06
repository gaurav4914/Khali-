from datetime import datetime, timezone
from typing import Protocol
from urllib.parse import quote, urlparse

import httpx

from .schemas import BrandCategory, CatalogueProduct, CompositionComponent, IngredientRole


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


class SyntheticBuyerCatalogueAdapter:
    """Synthetic buyer catalogue service for local testing and integration demos.

    Simulates a buyer-authorised read-only catalogue without bundling real
    commercial pharmacy datasets.
    """

    def __init__(self) -> None:
        now = datetime(2026, 11, 1, 0, 0, tzinfo=timezone.utc)
        self._records: list[CatalogueProduct] = [
            CatalogueProduct(
                product_id="buyer-sku-1001",
                display_name="Calpol 500 Tablet",
                brand_name="Calpol",
                brand_category=BrandCategory.REFERENCE,
                barcode="8901148241015",
                composition_text="Each uncoated tablet contains: Paracetamol IP 500 mg",
                composition_components=[
                    CompositionComponent(
                        ingredient_key="ing-paracetamol",
                        ingredient_name="Paracetamol",
                        ingredient_role=IngredientRole.ACTIVE,
                        strength_value="500",
                        strength_unit="mg",
                        strength_basis_amount="1",
                        strength_basis_unit="tablet",
                        provenance="catalogue",
                    )
                ],
                strength_text="500 mg per tablet",
                dosage_form_text="Tablet",
                release_type_text="Immediate release",
                route_text="Oral",
                manufacturer="GlaxoSmithKline Pharmaceuticals Ltd",
                pack_size_text="Strip of 15 tablets",
                product_status="active",
                updated_at=now,
            ),
            CatalogueProduct(
                product_id="buyer-sku-1002",
                display_name="Pacimol 500 Tablet",
                brand_name="Pacimol",
                brand_category=BrandCategory.OTHER,
                barcode="8901072001129",
                composition_text="Each tablet contains: Paracetamol 500 mg",
                composition_components=[
                    CompositionComponent(
                        ingredient_key="ing-paracetamol",
                        ingredient_name="Paracetamol",
                        ingredient_role=IngredientRole.ACTIVE,
                        strength_value="500",
                        strength_unit="mg",
                        strength_basis_amount="1",
                        strength_basis_unit="tablet",
                        provenance="catalogue",
                    )
                ],
                strength_text="500 mg per tablet",
                dosage_form_text="Tablet",
                release_type_text="Immediate release",
                route_text="Oral",
                manufacturer="Ipca Laboratories Ltd",
                pack_size_text="Strip of 15 tablets",
                product_status="active",
                updated_at=now,
            ),
            CatalogueProduct(
                product_id="buyer-sku-1003",
                display_name="ParaFast 500 Softgel Capsule",
                brand_name="ParaFast",
                brand_category=BrandCategory.OTHER,
                barcode="8901072009996",
                composition_text="Each capsule contains: Paracetamol 0.5 g",
                composition_components=[
                    CompositionComponent(
                        ingredient_key="ing-paracetamol",
                        ingredient_name="Paracetamol",
                        ingredient_role=IngredientRole.ACTIVE,
                        strength_value="0.5",
                        strength_unit="g",
                        strength_basis_amount="1",
                        strength_basis_unit="tablet",
                        provenance="catalogue",
                    )
                ],
                strength_text="500 mg",
                dosage_form_text="Capsule",
                release_type_text="Immediate release",
                route_text="Oral",
                manufacturer="Synthetic Generics Pvt Ltd",
                pack_size_text="Strip of 10 capsules",
                product_status="active",
                updated_at=now,
            ),
        ]

    async def search(
        self, *, query: str | None = None, barcode: str | None = None
    ) -> list[CatalogueProduct]:
        if barcode:
            return [p for p in self._records if p.barcode == barcode]
        if not query:
            return []
        q = query.casefold().strip()
        return [
            p
            for p in self._records
            if q in p.display_name.casefold()
            or (p.brand_name and q in p.brand_name.casefold())
        ]

    async def search_by_composition(
        self,
        components: list[CompositionComponent],
        *,
        page: int,
        page_size: int,
    ) -> list[CatalogueProduct]:
        start = max(0, (page - 1) * page_size)
        end = start + page_size
        return self._records[start:end]

    async def get_product(self, product_id: str) -> CatalogueProduct | None:
        return next((p for p in self._records if p.product_id == product_id), None)


class RestCatalogueAdapter:
    """Read-only adapter for the buyer's authorised catalogue API.

    Expected buyer endpoints:
      GET  {base_url}/products?query=<text>&barcode=<gtin>
      POST {base_url}/products/search-by-composition
      GET  {base_url}/products/{product_id}
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
                    "ingredient_role": (
                        item.ingredient_role.value
                        if hasattr(item.ingredient_role, "value")
                        else str(item.ingredient_role)
                    ),
                    "strength_value": item.strength_value,
                    "strength_unit": item.strength_unit,
                    "strength_basis_amount": item.strength_basis_amount,
                    "strength_basis_unit": item.strength_basis_unit,
                }
                for item in components
                if (
                    item.ingredient_role.value
                    if hasattr(item.ingredient_role, "value")
                    else str(item.ingredient_role)
                )
                == "active"
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
