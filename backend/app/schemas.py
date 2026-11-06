from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    CATALOGUE_UNAVAILABLE = "catalogue_unavailable"


class CompositionMatchStatus(str, Enum):
    EXACT = "exact_recorded_composition_match"
    FORMULATION_DIFFERENCE = "composition_match_formulation_details_differ"


class FormulationComparisonLabel(str, Enum):
    EXACT_FORMULATION = "same active composition; formulation details match"
    DOSAGE_FORM_DIFFERS = "same active composition; dosage form differs"
    RELEASE_TYPE_DIFFERS = "same active composition; release type differs"
    ROUTE_DIFFERS = "same active composition; route differs"
    MULTIPLE_FORMULATION_DIFFERENCES = "same active composition; multiple formulation details differ"
    UNABLE_TO_COMPARE = "unable to compare"


class QualityReport(BaseModel):
    capture_id: str | None = None
    status: QualityStatus
    issues: list[str] = Field(default_factory=list)
    recommended_action: str | None = None
    target_region: str | None = None
    width: int
    height: int
    brightness_mean: float
    edge_detail_score: float
    glare_ratio: float = 0.0


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
    source_capture_id: str | None = None
    source_capture_ids: list[str] = Field(default_factory=list)
    source_text: str | None = None
    provenance: str = "ocr"

    @model_validator(mode="after")
    def sync_capture_ids(self):
        if self.source_capture_id and not self.source_capture_ids:
            self.source_capture_ids = [self.source_capture_id]
        elif self.source_capture_ids and not self.source_capture_id:
            self.source_capture_id = self.source_capture_ids[0]
        return self


class CompositionComponent(BaseModel):
    """One structured ingredient entry from the scan or buyer catalogue.

    Preserves literal printed text, conservative normalised name, optional buyer
    canonical key, active/inactive/unknown role, decimal strength amount, unit,
    and optional strength basis (e.g., per tablet, per 5 mL, per mL, % w/w).
    """

    ingredient_key: str | None = None
    ingredient_name: str = ""
    ingredient_name_printed: str | None = None
    ingredient_name_normalised: str | None = None
    ingredient_role: IngredientRole = IngredientRole.UNKNOWN
    strength_value: str = ""
    strength_amount: str | None = None
    strength_unit: str
    strength_basis_amount: str | None = None
    strength_basis_unit: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    source_capture_id: str | None = None
    source_capture_ids: list[str] = Field(default_factory=list)
    source_text: str | None = None
    provenance: str = "ocr"

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        if not payload.get("ingredient_name") and payload.get("ingredient_name_printed"):
            payload["ingredient_name"] = payload["ingredient_name_printed"]
        if not payload.get("ingredient_name_printed") and payload.get("ingredient_name"):
            payload["ingredient_name_printed"] = payload["ingredient_name"]
        if not payload.get("strength_value") and payload.get("strength_amount"):
            payload["strength_value"] = payload["strength_amount"]
        if not payload.get("strength_amount") and payload.get("strength_value"):
            payload["strength_amount"] = payload["strength_value"]
        return payload

    @field_validator("ingredient_name", "strength_value", "strength_unit")
    @classmethod
    def non_empty_component_fields(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Composition component fields cannot be blank.")
        return value

    @model_validator(mode="after")
    def sync_fields(self):
        if not self.ingredient_name_printed:
            self.ingredient_name_printed = self.ingredient_name
        if not self.strength_amount:
            self.strength_amount = self.strength_value
        if self.source_capture_id and not self.source_capture_ids:
            self.source_capture_ids = [self.source_capture_id]
        elif self.source_capture_ids and not self.source_capture_id:
            self.source_capture_id = self.source_capture_ids[0]
        return self


class ScanExtraction(BaseModel):
    printed_product_name: ExtractedField = Field(default_factory=ExtractedField)
    brand_name: ExtractedField = Field(default_factory=ExtractedField)
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
    ocr_provenance: str = "tesseract"
    vision_provenance: str | None = None
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
    pack_size_text: str | None = None
    product_status: str | None = None
    product_url: str | None = None
    updated_at: datetime | None = None


class CatalogueSearchPage(BaseModel):
    items: list[CatalogueProduct] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_more: bool = False
    next_cursor: str | None = None


class CatalogueResolveRequest(BaseModel):
    scan_id: str
    barcode: str | None = None
    catalogue_scope: str = "current_buyer_catalogue"
    include_unresolved_candidates: bool = True


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
    resolution_id: str = Field(default_factory=lambda: f"res_{uuid4().hex[:12]}")
    scan_id: str
    status: IdentityStatus
    result: CatalogueIdentityResult | None = None
    candidates: list[CatalogueIdentityResult] = Field(default_factory=list)
    message: str


class CompositionMatchCandidate(BaseModel):
    product: CatalogueProduct
    status: CompositionMatchStatus
    comparison_label: str = FormulationComparisonLabel.EXACT_FORMULATION.value
    matched_components: list[str] = Field(default_factory=list)
    different_fields: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    explanation: str
    review_required: bool = True


INFORMATIONAL_NOTICE = (
    "Catalogue composition matches are informational. They do not determine whether a "
    "medicine is suitable for an individual. Ask a qualified pharmacist or prescriber "
    "before making any treatment change."
)


class CompositionMatchResponse(BaseModel):
    request_id: str = Field(default_factory=lambda: f"req_{uuid4().hex[:12]}")
    scan_id: str
    composition_parse_status: str = "parsed"
    status: CompositionSearchStatus
    composition_signature: str | None = None
    matches_in_page: int = 0
    page: int = 1
    page_size: int = 50
    has_more: bool = False
    next_cursor: str | None = None
    mapping_version: str = "2026.11-strict-literal-v1"
    exact_matches: list[CompositionMatchCandidate] = Field(default_factory=list)
    formulation_difference_matches: list[CompositionMatchCandidate] = Field(default_factory=list)
    matches: list[CompositionMatchCandidate] = Field(default_factory=list)
    informational_notice: str = INFORMATIONAL_NOTICE
    message: str


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, str]
    details: dict[str, Any] = Field(default_factory=dict)
