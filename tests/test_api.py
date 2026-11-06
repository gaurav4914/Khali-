from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.config import Settings
from app.main import create_app
from app.ocr import EmptyMockOCRProvider, OCRDocument
from app.schemas import (
    BrandCategory,
    CatalogueProduct,
    CompositionComponent,
    IngredientRole,
)


class FakeOCR:
    def read_text(self, image_path: Path):
        return OCRDocument(
            text="Example Product\nEach tablet contains: Example Ingredient 500 mg",
            mean_confidence=0.91,
            provider="test",
        )


class FakeCatalogue:
    async def search(self, *, query=None, barcode=None):
        if query and query.casefold() == "example product":
            return [CatalogueProduct(product_id="demo-1", display_name="Example Product")]
        return []

    async def search_by_composition(self, components, *, page, page_size):
        if components and components[0].ingredient_name == "Example Ingredient":
            component = CompositionComponent(
                ingredient_name="Example Ingredient",
                ingredient_role=IngredientRole.ACTIVE,
                strength_value="500",
                strength_unit="mg",
            )
            return [
                CatalogueProduct(
                    product_id="brand-1",
                    display_name="Reference Example",
                    brand_category=BrandCategory.REFERENCE,
                    composition_components=[component],
                ),
                CatalogueProduct(
                    product_id="brand-2",
                    display_name="Other Example",
                    brand_category=BrandCategory.OTHER,
                    composition_components=[component],
                ),
            ]
        return []

    async def get_product(self, product_id):
        if product_id == "demo-1":
            return CatalogueProduct(product_id="demo-1", display_name="Example Product")
        return None


def png_bytes():
    image = Image.new("RGB", (900, 900), "white")
    draw = ImageDraw.Draw(image)
    draw.text((50, 50), "Example Product", fill="black")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_create_upload_recognise_and_resolve(tmp_path: Path):
    settings = Settings(
        upload_dir=tmp_path,
        ocr_provider="mock",
        catalogue_mode="none",
        cors_origins="*",
    )
    app = create_app(
        settings,
        catalogue_adapter=FakeCatalogue(),
        ocr_provider=FakeOCR(),
    )
    with TestClient(app) as client:
        created = client.post("/v1/scans")
        assert created.status_code == 201
        scan_id = created.json()["scan_id"]

        uploaded = client.post(
            f"/v1/scans/{scan_id}/captures",
            data={"step": "front"},
            files={"image": ("front.png", png_bytes(), "image/png")},
        )
        assert uploaded.status_code == 201
        assert uploaded.json()["step"] == "front"

        extraction = client.post(f"/v1/scans/{scan_id}/recognise")
        assert extraction.status_code == 200
        assert extraction.json()["printed_product_name"]["value"] == "Example Product"
        assert extraction.json()["composition_components"][0]["ingredient_name"] == "Example Ingredient"

        composition = client.post(
            "/v1/catalogue/composition-matches",
            json={"scan_id": scan_id},
        )
        assert composition.status_code == 200
        assert composition.json()["total_matches"] == 2
        assert composition.json()["matches"][0]["product"]["product_id"] == "brand-1"

        resolved = client.post("/v1/catalogue/resolve", json={"scan_id": scan_id})
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "exact_catalogue_identity"

        fetched = client.get(f"/v1/scans/{scan_id}")
        assert fetched.status_code == 200
        assert len(fetched.json()["captures"]) == 1

        capture_id = fetched.json()["captures"][0]["capture_id"]
        deleted = client.delete(f"/v1/scans/{scan_id}/captures/{capture_id}")
        assert deleted.status_code == 204
        assert len(client.get(f"/v1/scans/{scan_id}").json()["captures"]) == 0


def test_api_key_is_enforced_when_configured(tmp_path: Path):
    settings = Settings(
        upload_dir=tmp_path,
        api_key="test-secret",
        ocr_provider="mock",
        cors_origins="*",
    )
    app = create_app(
        settings,
        catalogue_adapter=FakeCatalogue(),
        ocr_provider=EmptyMockOCRProvider(),
    )
    with TestClient(app) as client:
        assert client.post("/v1/scans").status_code == 401
        assert client.post("/v1/scans", headers={"X-API-Key": "test-secret"}).status_code == 201
