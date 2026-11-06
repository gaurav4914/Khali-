export type CaptureStep = "front" | "composition" | "back";

export type QualityStatus =
  | "accepted"
  | "retry_recommended"
  | "retry_required"
  | "unsupported";

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

export interface ScanExtraction {
  printed_product_name: ExtractedField;
  printed_composition_text: ExtractedField;
  manufacturer_text: ExtractedField;
  raw_text: string;
  unreadable_fields: string[];
  review_required: boolean;
}

export interface CatalogueResolveResponse {
  scan_id: string;
  status: string;
  result?: {
    product?: {
      product_id: string;
      display_name: string;
      brand_name?: string | null;
      barcode?: string | null;
      composition_text?: string | null;
      strength_text?: string | null;
      dosage_form_text?: string | null;
      manufacturer?: string | null;
    } | null;
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
