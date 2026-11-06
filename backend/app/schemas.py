from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CaptureStep(str, Enum):
    FRONT = "front"
    COMPOSITION = "composition"
    BACK = "back"


class QualityStatus(str, Enum):
    ACCEPTED = "accepted"
    RETRY_RECOMMENDED = "retry_recommended"
    RETRY_REQUIRED = "retry_required"
    UNSUPPORTED = "unsupported"


class ScanStatus(str, Enum):
    CREATED = "created"
    CAPTURING = "capturing"
    RECOGNISED = "recognised"
    FAILED = "failed"


class IdentityStatus(str, Enum):
    EXACT_IDENTITY = "exact_catalogue_identity"
    LIKELY_REVIEW = "likely_identity_review_required"
    MULTIPLE = "multiple_possible_records"
    INSUFFICIENT = "insufficient_catalogue_information"
    UNABLE = "unable_to_identify"
    NOT_FOUND = "no_catalogue_record_found"


class QualityReport(BaseModel):
    status: QualityStatus
    issues: list[str] = Field(default_factory=list)
    recommended_action: str | None = None
    width: int
    height: int
    brightness_mean: float
    edge_detail_score: float


class CaptureRecord(BaseModel):
    capture_id: str
    step: CaptureStep
    filename: str
    content_type: str
    created_at: datetime = Field(default_factory=utc_now)
    quality: QualityReport


class ExtractedField(BaseModel):
    value: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    source_capture_ids: list[str] = Field(default_factory=list)
    source_text: str | None = None


class ScanExtraction(BaseModel):
    printed_product_name: ExtractedField = Field(default_factory=ExtractedField)
    printed_composition_text: ExtractedField = Field(default_factory=ExtractedField)
    manufacturer_text: ExtractedField = Field(default_factory=ExtractedField)
    raw_text: str = ""
    unreadable_fields: list[str] = Field(default_factory=list)
    review_required: bool = True


class ScanSession(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    scan_id: str
    status: ScanStatus = ScanStatus.CREATED
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    captures: list[CaptureRecord] = Field(default_factory=list)
    extraction: ScanExtraction | None = None


class CreateScanResponse(BaseModel):
    scan_id: str
    status: ScanStatus
    expires_at: datetime


class CatalogueProduct(BaseModel):
    product_id: str
    display_name: str
    brand_name: str | None = None
    barcode: str | None = None
    composition_text: str | None = None
    strength_text: str | None = None
    dosage_form_text: str | None = None
    manufacturer: str | None = None
    updated_at: datetime | None = None


class CatalogueResolveRequest(BaseModel):
    scan_id: str
    barcode: str | None = None


class IdentityEvidence(BaseModel):
    matched_fields: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    different_fields: list[str] = Field(default_factory=list)
    explanation: str


class CatalogueIdentityResult(BaseModel):
    product: CatalogueProduct | None = None
    status: IdentityStatus
    evidence: IdentityEvidence
    review_required: bool = True


class CatalogueResolveResponse(BaseModel):
    scan_id: str
    status: IdentityStatus
    result: CatalogueIdentityResult | None = None
    candidates: list[CatalogueIdentityResult] = Field(default_factory=list)
    message: str


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, str]
    details: dict[str, Any] = Field(default_factory=dict)
