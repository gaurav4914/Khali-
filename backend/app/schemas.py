from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class IngredientRole(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNKNOWN = "unknown"


class BrandCategory(str, Enum):
    REFERENCE = "reference"
    OTHER = "other"
    UNKNOWN = "unknown"


class IdentityStatus(str, Enum):
    EXACT_IDENTITY = "exact_catalogue_identity"
    LIKELY_REVIEW = "likely_identity_review_required"
    MULTIPLE = "multiple_possible_records"
    INSUFFICIENT = "insufficient_catalogue_information"
    UNABLE = "unable_to_identify"
    NOT_FOUND = "no_catalogue_record_found"


class CompositionSearchStatus(str, Enum):
    MATCHES_FOUND = "matches_found"
    NO_MATCHES = "no_matches"
    UNABLE_TO_COMPARE = "unable_to_compare"


class CompositionMatchStatus(str, Enum):
    EXACT = "exact_recorded_composition_match"
    FORMULATION_DIFFERENCE = "composition_match_formulation_details_differ"


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


class CompositionComponent(BaseModel):
    """One ingredient entry from the scan or buyer catalogue.

    Catalogue components should carry a stable buyer-owned ingredient_key whenever
    possible. OCR-derived components may leave it empty and use strict literal-name
    normalisation for candidate matching.
    """

    ingredient_key: str | None = None
    ingredient_name: str
    ingredient_role: IngredientRole = IngredientRole.UNKNOWN
    strength_value: str
    strength_unit: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    source_capture_ids: list[str] = Field(default_factory=list)
    source_text: str | None = None

    @field_validator("ingredient_name", "strength_value", "strength_unit")
    @classmethod
    def non_empty_component_fields(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Composition component fields cannot be blank.")
        return value


class ScanExtraction(BaseModel):
    printed_product_name: ExtractedField = Field(default_factory=ExtractedField)
    printed_composition_text: ExtractedField = Field(default_factory=ExtractedField)
    manufacturer_text: ExtractedField = Field(default_factory=ExtractedField)
    dosage_form_text: ExtractedField = Field(default_factory=ExtractedField)
    release_type_text: ExtractedField = Field(default_factory=ExtractedField)
    route_text: ExtractedField = Field(default_factory=ExtractedField)
    composition_components: list[CompositionComponent] = Field(default_factory=list)
    raw_text: str = ""
    unreadable_fields: list[str] = Field(default_factory=list)
    field_conflicts: list[str] = Field(default_factory=list)
    composition_parse_status: str = "not_attempted"
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
    brand_category: BrandCategory = BrandCategory.UNKNOWN
    barcode: str | None = None
    composition_text: str | None = None
    composition_components: list[CompositionComponent] = Field(default_factory=list)
    strength_text: str | None = None
    dosage_form_text: str | None = None
    release_type_text: str | None = None
    route_text: str | None = None
    manufacturer: str | None = None
    product_status: str | None = None
    product_url: str | None = None
    updated_at: datetime | None = None


class CatalogueResolveRequest(BaseModel):
    scan_id: str
    barcode: str | None = None


class CompositionMatchRequest(BaseModel):
    scan_id: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


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


class CompositionMatchCandidate(BaseModel):
    product: CatalogueProduct
    status: CompositionMatchStatus
    matched_components: list[str] = Field(default_factory=list)
    different_fields: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    explanation: str
    review_required: bool = True


class CompositionMatchResponse(BaseModel):
    scan_id: str
    status: CompositionSearchStatus
    composition_signature: str | None = None
    matches_in_page: int = 0
    page: int = 1
    page_size: int = 50
    matches: list[CompositionMatchCandidate] = Field(default_factory=list)
    message: str


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, str]
    details: dict[str, Any] = Field(default_factory=dict)
