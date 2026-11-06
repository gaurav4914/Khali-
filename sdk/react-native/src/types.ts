export type CaptureStep = "front" | "composition" | "back";

export type QualityStatus =
  | "accepted"
  | "retry_recommended"
  | "retry_required"
  | "unsupported";

export type BrandCategory = "reference" | "other" | "unknown";

export type FormulationComparisonLabel =
  | "same active composition; formulation details match"
  | "same active composition; dosage form differs"
  | "same active composition; release type differs"
  | "same active composition; route differs"
  | "same active composition; multiple formulation details differ"
  | "unable to compare";

export interface CreateScanResponse {
  scan_id: string;
  status: string;
  expires_at: string;
}

export interface QualityReport {
  capture_id?: string | null;
  status: QualityStatus;
  issues: string[];
  recommended_action?: string | null;
  target_region?: string | null;
  width: number;
  height: number;
  brightness_mean: number;
  edge_detail_score: number;
  glare_ratio?: number;
}

export interface CaptureResponse {
  capture_id: string;
  step: CaptureStep;
  filename: string;
  content_type: string;
  created_at: string;
  quality: QualityReport;
}

export interface ExtractedField {
  value: string | null;
  confidence: number | null;
  source_capture_id?: string | null;
  source_capture_ids: string[];
  source_text: string | null;
  provenance?: string;
}

export interface CompositionComponent {
  ingredient_key?: string | null;
  ingredient_name: string;
  ingredient_name_printed?: string | null;
  ingredient_name_normalised?: string | null;
  ingredient_role: "active" | "inactive" | "unknown";
  strength_value: string;
  strength_amount?: string | null;
  strength_unit: string;
  strength_basis_amount?: string | null;
  strength_basis_unit?: string | null;
  confidence?: number | null;
  source_capture_id?: string | null;
  source_capture_ids?: string[];
  source_text?: string | null;
  provenance?: string;
}

export interface ScanExtraction {
  printed_product_name: ExtractedField;
  brand_name?: ExtractedField;
  printed_composition_text: ExtractedField;
  manufacturer_text: ExtractedField;
  dosage_form_text: ExtractedField;
  release_type_text: ExtractedField;
  route_text: ExtractedField;
  composition_components: CompositionComponent[];
  raw_text: string;
  unreadable_fields: string[];
  field_conflicts: string[];
  composition_parse_status: string;
  ocr_provenance?: string;
  vision_provenance?: string | null;
  review_required: boolean;
}

export interface CatalogueProduct {
  product_id: string;
  display_name: string;
  brand_name?: string | null;
  brand_category: BrandCategory;
  barcode?: string | null;
  composition_text?: string | null;
  composition_components: CompositionComponent[];
  strength_text?: string | null;
  dosage_form_text?: string | null;
  release_type_text?: string | null;
  route_text?: string | null;
  manufacturer?: string | null;
  pack_size_text?: string | null;
  product_status?: string | null;
  product_url?: string | null;
  updated_at?: string | null;
}

export interface CatalogueIdentityResult {
  product?: CatalogueProduct | null;
  status: string;
  evidence: {
    matched_fields: string[];
    missing_fields: string[];
    different_fields: string[];
    explanation: string;
  };
  review_required: boolean;
}

export interface CatalogueResolveResponse {
  resolution_id?: string;
  scan_id: string;
  status: string;
  result?: CatalogueIdentityResult | null;
  candidates: CatalogueIdentityResult[];
  message: string;
}

export interface CompositionMatchCandidate {
  product: CatalogueProduct;
  status:
    | "exact_recorded_composition_match"
    | "composition_match_formulation_details_differ";
  comparison_label?: FormulationComparisonLabel | string;
  matched_components: string[];
  different_fields: string[];
  missing_fields: string[];
  explanation: string;
  review_required: boolean;
}

export interface CompositionMatchResponse {
  request_id?: string;
  scan_id: string;
  composition_parse_status?: string;
  status:
    | "matches_found"
    | "no_matches"
    | "unable_to_compare"
    | "catalogue_unavailable";
  composition_signature?: string | null;
  matches_in_page: number;
  page: number;
  page_size: number;
  has_more?: boolean;
  next_cursor?: string | null;
  mapping_version?: string;
  exact_matches?: CompositionMatchCandidate[];
  formulation_difference_matches?: CompositionMatchCandidate[];
  matches: CompositionMatchCandidate[];
  informational_notice?: string;
  message: string;
}

export interface BuyerScannerConfig {
  allowGalleryImport: boolean;
  maxUploadBytes: number;
  privacyNotice: string;
  externalAiEnabled: boolean;
  requireBackCaptureForMissingManufacturer: boolean;
}
