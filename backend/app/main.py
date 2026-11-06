from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from .catalogue import (
    CatalogueAdapter,
    CatalogueAdapterError,
    EmptyCatalogueAdapter,
    RestCatalogueAdapter,
)
from .config import Settings, get_settings
from .extraction import extract_printed_fields
from .identity import ExactProductIdentityResolver
from .ocr import EmptyMockOCRProvider, OCRProvider, TesseractOCRProvider
from .quality import InvalidImageError, inspect_image
from .schemas import (
    CaptureRecord,
    CaptureStep,
    CatalogueResolveRequest,
    CatalogueResolveResponse,
    CreateScanResponse,
    HealthResponse,
    IdentityStatus,
    QualityReport,
    ReadinessResponse,
    ScanExtraction,
    ScanSession,
)
from .security import build_api_key_dependency
from .store import InMemoryScanStore, ScanNotFoundError


def create_app(
    settings: Settings | None = None,
    *,
    catalogue_adapter: CatalogueAdapter | None = None,
    ocr_provider: OCRProvider | None = None,
) -> FastAPI:
    cfg = settings or get_settings()

    if catalogue_adapter is None:
        if cfg.catalogue_mode.lower() == "rest":
            if not cfg.catalogue_base_url:
                raise ValueError("CATALOGUE_BASE_URL is required when CATALOGUE_MODE=rest.")
            catalogue_adapter = RestCatalogueAdapter(
                cfg.catalogue_base_url,
                cfg.catalogue_api_key,
                cfg.catalogue_timeout_seconds,
            )
        else:
            catalogue_adapter = EmptyCatalogueAdapter()

    if ocr_provider is None:
        ocr_provider = (
            EmptyMockOCRProvider()
            if cfg.ocr_provider.lower() == "mock"
            else TesseractOCRProvider(cfg.ocr_languages)
        )

    store = InMemoryScanStore(cfg.upload_dir, cfg.scan_ttl_seconds)
    resolver = ExactProductIdentityResolver()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store.clear_upload_directory_on_startup()
        yield

    app = FastAPI(
        title=cfg.app_name,
        version="0.1.0",
        description=(
            "Self-hosted medicine-pack text extraction and exact product identity API. "
            "It does not recommend medicine substitutions or provide clinical advice."
        ),
        lifespan=lifespan,
    )
    app.state.settings = cfg
    app.state.store = store
    app.state.catalogue = catalogue_adapter
    app.state.ocr = ocr_provider

    if cfg.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cfg.allowed_origins,
            allow_credentials=cfg.allowed_origins != ["*"],
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "X-API-Key"],
        )

    require_api_key = build_api_key_dependency(cfg)

    @app.exception_handler(ScanNotFoundError)
    async def scan_not_found_handler(request, exc):
        return JSONResponse(
            status_code=404,
            content={"code": "scan_not_found", "message": "Scan session not found or expired."},
        )

    @app.get("/v1/health", response_model=HealthResponse, tags=["Operations"])
    async def health():
        return HealthResponse(
            status="ok",
            app_name=cfg.app_name,
            environment=cfg.environment,
        )

    @app.get("/v1/ready", response_model=ReadinessResponse, tags=["Operations"])
    async def ready():
        checks = {
            "scan_store": "ready",
            "ocr_provider": "configured",
            "catalogue_adapter": "configured",
        }
        ok = all(value in {"ready", "configured"} for value in checks.values())
        return ReadinessResponse(status="ready" if ok else "degraded", checks=checks)

    @app.post(
        "/v1/scans",
        response_model=CreateScanResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Scans"],
        dependencies=[Depends(require_api_key)],
    )
    async def create_scan():
        session = store.create()
        return CreateScanResponse(
            scan_id=session.scan_id,
            status=session.status,
            expires_at=session.expires_at,
        )

    @app.get(
        "/v1/scans/{scan_id}",
        response_model=ScanSession,
        tags=["Scans"],
        dependencies=[Depends(require_api_key)],
    )
    async def get_scan(scan_id: str):
        return store.get(scan_id)

    @app.post(
        "/v1/scans/{scan_id}/captures",
        response_model=CaptureRecord,
        status_code=status.HTTP_201_CREATED,
        tags=["Captures"],
        dependencies=[Depends(require_api_key)],
    )
    async def upload_capture(
        scan_id: str,
        step: CaptureStep = Form(...),
        image: UploadFile = File(...),
    ):
        store.get(scan_id)
        if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(415, detail={
                "code": "unsupported_media_type",
                "message": "Upload a JPEG, PNG, or WEBP image.",
            })
        data = await image.read(cfg.max_upload_bytes + 1)
        if len(data) > cfg.max_upload_bytes:
            raise HTTPException(413, detail={
                "code": "image_too_large",
                "message": f"Image exceeds the {cfg.max_upload_bytes} byte upload limit.",
            })
        try:
            quality = inspect_image(data)
        except InvalidImageError as exc:
            raise HTTPException(422, detail={
                "code": "invalid_image",
                "message": str(exc),
            }) from exc

        capture_id = str(uuid4())
        suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[image.content_type]
        filename = f"{capture_id}{suffix}"
        target = cfg.upload_dir / filename
        cfg.upload_dir.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

        capture = CaptureRecord(
            capture_id=capture_id,
            step=step,
            filename=filename,
            content_type=image.content_type,
            quality=quality,
        )
        try:
            store.add_capture(scan_id, capture)
        except ScanNotFoundError:
            target.unlink(missing_ok=True)
            raise
        return capture

    @app.post(
        "/v1/scans/{scan_id}/quality-check",
        response_model=QualityReport,
        tags=["Captures"],
        dependencies=[Depends(require_api_key)],
    )
    async def quality_check(scan_id: str, capture_id: str):
        path = store.capture_path(scan_id, capture_id)
        if path is None:
            raise HTTPException(404, detail={
                "code": "capture_not_found",
                "message": "Capture not found or expired.",
            })
        try:
            data = await run_in_threadpool(path.read_bytes)
            return inspect_image(data)
        except InvalidImageError as exc:
            raise HTTPException(422, detail={"code": "invalid_image", "message": str(exc)}) from exc

    @app.post(
        "/v1/scans/{scan_id}/recognise",
        response_model=ScanExtraction,
        tags=["Recognition"],
        dependencies=[Depends(require_api_key)],
    )
    async def recognise(scan_id: str):
        session = store.get(scan_id)
        if not session.captures:
            raise HTTPException(409, detail={
                "code": "no_captures",
                "message": "Upload at least one packaging photo before recognition.",
            })
        documents = []
        for capture in session.captures:
            path = store.capture_path(scan_id, capture.capture_id)
            if path is None:
                continue
            try:
                document = await run_in_threadpool(app.state.ocr.read_text, path)
            except RuntimeError as exc:
                raise HTTPException(503, detail={
                    "code": "ocr_provider_unavailable",
                    "message": str(exc),
                }) from exc
            documents.append((capture.capture_id, document))
        extraction = extract_printed_fields(documents)
        store.set_extraction(scan_id, extraction)
        return extraction

    @app.post(
        "/v1/catalogue/resolve",
        response_model=CatalogueResolveResponse,
        tags=["Buyer Catalogue"],
        dependencies=[Depends(require_api_key)],
    )
    async def resolve_catalogue(request: CatalogueResolveRequest):
        session = store.get(request.scan_id)
        if session.extraction is None:
            raise HTTPException(409, detail={
                "code": "recognition_required",
                "message": "Run recognition before resolving a catalogue identity.",
            })
        name = session.extraction.printed_product_name.value
        if not name and not request.barcode:
            return CatalogueResolveResponse(
                scan_id=request.scan_id,
                status=IdentityStatus.UNABLE,
                message="No readable product name or barcode was extracted. Capture a clearer label photo.",
            )
        try:
            products = await app.state.catalogue.search(query=name, barcode=request.barcode)
        except CatalogueAdapterError as exc:
            raise HTTPException(502, detail={
                "code": "catalogue_unavailable",
                "message": str(exc),
            }) from exc

        if not products:
            return CatalogueResolveResponse(
                scan_id=request.scan_id,
                status=IdentityStatus.NOT_FOUND,
                message="No matching record was returned by the buyer's authorised catalogue.",
            )

        results = resolver.resolve(session.extraction, products, request.barcode)
        if not results:
            return CatalogueResolveResponse(
                scan_id=request.scan_id,
                status=IdentityStatus.INSUFFICIENT,
                message="Catalogue records were returned, but the available label evidence is insufficient for exact product identification.",
            )
        if len(results) == 1:
            return CatalogueResolveResponse(
                scan_id=request.scan_id,
                status=results[0].status,
                result=results[0],
                message=results[0].evidence.explanation,
            )
        return CatalogueResolveResponse(
            scan_id=request.scan_id,
            status=IdentityStatus.MULTIPLE,
            candidates=results,
            message="More than one catalogue record may match. Verify the printed pack identity before relying on the result.",
        )

    @app.get(
        "/v1/catalogue/products/{product_id}",
        tags=["Buyer Catalogue"],
        dependencies=[Depends(require_api_key)],
    )
    async def get_catalogue_product(product_id: str):
        try:
            product = await app.state.catalogue.get_product(product_id)
        except CatalogueAdapterError as exc:
            raise HTTPException(502, detail={
                "code": "catalogue_unavailable",
                "message": str(exc),
            }) from exc
        if product is None:
            raise HTTPException(404, detail={
                "code": "catalogue_product_not_found",
                "message": "The buyer catalogue did not return this product.",
            })
        return product

    return app


app = create_app()
