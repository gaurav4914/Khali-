from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.config import Settings
from app.main import create_app
from app.ocr import EmptyMockOCRProvider, OCRDocument
from app.schemas import CatalogueProduct


class FakeOCR:
    def read_text(self, image_path: Path):
        return OCRDocument(
            text="Example Product\nExample Ingredient 500 mg",
            mean_confidence=0.91,
            provider="test",
        )


class FakeCatalogue:
    async def search(self, *, query=None, barcode=None):
        if query and query.casefold() == "example product":
            return [CatalogueProduct(product_id="demo-1", display_name="Example Product")]
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

        resolved = client.post("/v1/catalogue/resolve", json={"scan_id": scan_id})
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "exact_catalogue_identity"

        fetched = client.get(f"/v1/scans/{scan_id}")
        assert fetched.status_code == 200
        assert len(fetched.json()["captures"]) == 1


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
