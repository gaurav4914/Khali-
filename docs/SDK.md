# React Native / Expo SDK & Guided Scanner Module

The package in `sdk/react-native` provides both the typed HTTP client (`MedicineEngineClient`) and the adaptive guided capture state machine (`evaluateCaptureReviewBanner`, `determineNextGuidedStage`) used across the S0–S6 scanner workflow.

## API client & guided scanner example

```ts
import {
  MedicineEngineClient,
  evaluateCaptureReviewBanner,
  determineNextGuidedStage,
} from "./sdk/react-native/src";

const engine = new MedicineEngineClient({
  baseUrl: "https://buyer-owned-engine.example",
  // Use short-lived scoped tokens or a trusted buyer backend proxy.
  // Never embed a permanent server key in a distributed mobile binary.
  accessToken: "buyer-issued-short-lived-session-token",
});

const session = await engine.createScanSession();
const capture = await engine.uploadMedicineImage(
  session.scan_id,
  "front",
  selectedImageUri,
);

const banner = evaluateCaptureReviewBanner(capture.quality);
if (!banner.canProceed) {
  await engine.removeCapture(session.scan_id, capture.capture_id);
}

const extraction = await engine.recogniseMedicine(session.scan_id);
const exactIdentity = await engine.resolveProductIdentity(session.scan_id);
const compositionGroup = await engine.findCompositionMatches(session.scan_id, 1, 50);
```

## Exported SDK methods and helpers

- `createScanSession()`
- `uploadMedicineImage(scanId, step, imageUriOrBlob, contentType?, hintKey?)`
- `checkImageQuality(scanId, captureId)`
- `recogniseMedicine(scanId)`
- `resolveProductIdentity(scanId, barcode?)`
- `findCompositionMatches(scanId, page?, pageSize?)`
- `getCatalogueProduct(productId)`
- `removeCapture(scanId, captureId)`
- `getScanResult(scanId)`
- `evaluateCaptureReviewBanner(qualityReport)`
- `determineNextGuidedStage({ completedSteps, latestCapture, extraction, config })`

## Security & clinical boundary notes

- Never put a buyer's permanent catalogue credential or server-to-server AI key in a mobile binary.
- Composition-group results are catalogue data only. Always display `compositionGroup.informational_notice` and never present a composition match as a patient-specific instruction to switch treatment.
