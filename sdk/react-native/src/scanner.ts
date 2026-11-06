import type {
  BuyerScannerConfig,
  CaptureResponse,
  CaptureStep,
  QualityReport,
  ScanExtraction,
} from "./types";

export type ScannerScreenId =
  | "S0_ENTRY"
  | "S1_FRONT_CAMERA"
  | "S2_CAPTURE_REVIEW"
  | "S3_COMPOSITION_CLOSEUP"
  | "S4_BACK_CAMERA"
  | "S5_PROCESSING"
  | "S6_RESULTS";

export type CameraPermissionState = "prompt" | "granted" | "denied";

export interface ReviewBanner {
  headline:
    | "Clear enough"
    | "Try again — image is blurred"
    | "Need a closer photo — text is too small"
    | "Move the pack into the frame"
    | "Reduce glare by slightly changing the angle";
  detail: string;
  canProceed: boolean;
  requiresCloseupNext: boolean;
}

export function evaluateCaptureReviewBanner(quality: QualityReport): ReviewBanner {
  const issues = quality.issues || [];
  if (issues.includes("glare_detected") || issues.includes("overexposed")) {
    return {
      headline: "Reduce glare by slightly changing the angle",
      detail:
        "Bright reflections are covering part of the printed pack text. Tilt the pack slightly and retake.",
      canProceed: quality.status !== "retry_required",
      requiresCloseupNext: false,
    };
  }
  if (
    issues.includes("severe_blur_or_blank") ||
    issues.includes("low_detail_or_possible_blur")
  ) {
    return {
      headline: "Try again — image is blurred",
      detail:
        "Hold the camera steady and tap to focus on the printed text before capturing.",
      canProceed: quality.status !== "retry_required",
      requiresCloseupNext: true,
    };
  }
  if (issues.includes("low_resolution") || issues.includes("text_too_small")) {
    return {
      headline: "Need a closer photo — text is too small",
      detail:
        "The composition lines are too small to read reliably. We will guide you through a close-up photo next.",
      canProceed: true,
      requiresCloseupNext: true,
    };
  }
  if (issues.includes("cropped_edges")) {
    return {
      headline: "Move the pack into the frame",
      detail: "Keep the full medicine pack inside the rounded alignment guide.",
      canProceed: quality.status !== "retry_required",
      requiresCloseupNext: false,
    };
  }
  return {
    headline: "Clear enough",
    detail: "The image passed quality checks and is ready for text recognition.",
    canProceed: true,
    requiresCloseupNext: false,
  };
}

export function determineNextGuidedStage(params: {
  completedSteps: CaptureStep[];
  latestCapture: CaptureResponse;
  extraction?: ScanExtraction | null;
  config: BuyerScannerConfig;
}): {
  nextScreen: ScannerScreenId;
  nextStep: CaptureStep | null;
  reason: string | null;
} {
  const { completedSteps, latestCapture, extraction, config } = params;
  const review = evaluateCaptureReviewBanner(latestCapture.quality);

  if (
    !completedSteps.includes("composition") &&
    (review.requiresCloseupNext ||
      (extraction &&
        (extraction.composition_components.length === 0 ||
          extraction.composition_parse_status !== "parsed")))
  ) {
    return {
      nextScreen: "S3_COMPOSITION_CLOSEUP",
      nextStep: "composition",
      reason:
        "Bring the printed composition details closer. Keep all lines inside the frame.",
    };
  }

  if (
    config.requireBackCaptureForMissingManufacturer &&
    !completedSteps.includes("back") &&
    extraction &&
    extraction.unreadable_fields.includes("manufacturer_text")
  ) {
    return {
      nextScreen: "S4_BACK_CAMERA",
      nextStep: "back",
      reason:
        "Turn the pack over and show the printed details to capture the manufacturer or back-label text.",
    };
  }

  return {
    nextScreen: "S5_PROCESSING",
    nextStep: null,
    reason: null,
  };
}
