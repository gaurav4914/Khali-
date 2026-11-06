export type CaptureStep = "front" | "composition" | "back";

export type QualityStatus =
  | "accepted"
  | "retry_recommended"
  | "retry_required"
  | "unsupported";

export type BrandCategory = "reference" | "other" | "unknown";

export interface CreateScanResponse {
  scan_id: string;
  status: string;
  expires_at: string;
}

export interface CaptureResponse {
  capture_id: string;
  step: CaptureStep;
  filename: string;
  content_type: string;
  created_at: string;
  quality: {
    status: QualityStatus;
    issues: string[];
    recommended_action?: string | null;
    width: number;
    height: number;
    brightness_mean: number;
    edge_detail_score: number;
  };
}

export interface ExtractedField {
  value: string | null;
  confidence: number | null;
  source_capture_ids: string[];
  source_text: string | null;
}

export interface CompositionComponent {
  ingredient_key?: string | null;
  ingredient_name: string;
  ingredient_role: "active" | "inactive" | "unknown";
  strength_value: string;
  strength_unit: string;
  confidence?: number | null;
  source_capture_ids?: string[];
  source_text?: string | null;
}

export interface ScanExtraction {
  printed_product_name: ExtractedField;
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
  product_status?: string | null;
  product_url?: string | null;
  updated_at?: string | null;
}

export interface CatalogueResolveResponse {
  scan_id: string;
  status: string;
  result?: {
    product?: CatalogueProduct | null;
    status: string;
    evidence: {
      matched_fields: string[];
      missing_fields: string[];
      different_fields: string[];
      explanation: string;
    };
    review_required: boolean;
  } | null;
  candidates: unknown[];
  message: string;
}

export interface CompositionMatchCandidate {
  product: CatalogueProduct;
  status: "exact_recorded_composition_match" | "composition_match_formulation_details_differ";
  matched_components: string[];
  different_fields: string[];
  missing_fields: string[];
  explanation: string;
  review_required: boolean;
}

export interface CompositionMatchResponse {
  scan_id: string;
  status: "matches_found" | "no_matches" | "unable_to_compare";
  composition_signature?: string | null;
  matches_in_page: number;
  page: number;
  page_size: number;
  matches: CompositionMatchCandidate[];
  message: string;
}
