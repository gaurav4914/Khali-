# React Native / Expo API Client

The package in `sdk/react-native` is a typed HTTP client. It is **not yet a camera UI component**. The host application owns camera permission and capture UI until the guided scanner component is implemented.

## API client example

```ts
import { MedicineEngineClient } from "./sdk/react-native/src";

const engine = new MedicineEngineClient({
  baseUrl: "https://buyer-owned-engine.example",
  // Use this from a trusted buyer backend. Do not embed a permanent server key in a mobile app.
  apiKey: "buyer-issued-app-or-session-key",
});

const session = await engine.createScanSession();
// Capture front/composition/back photos with the host app's camera.
const capture = await engine.uploadMedicineImage(
  session.scan_id,
  "front",
  selectedImageUri,
);
const extraction = await engine.recogniseMedicine(session.scan_id);
const exactIdentity = await engine.resolveProductIdentity(session.scan_id);
const compositionGroup = await engine.findCompositionMatches(session.scan_id);
console.log(compositionGroup.matches);
await engine.removeCapture(session.scan_id, capture.capture_id);
```

## Current API methods

- `createScanSession()`
- `uploadMedicineImage(scanId, step, imageUri, contentType?)`
- `checkImageQuality(scanId, captureId)`
- `recogniseMedicine(scanId)`
- `resolveProductIdentity(scanId, barcode?)`
- `findCompositionMatches(scanId, page?, pageSize?)`
- `removeCapture(scanId, captureId)`
- `getScanResult(scanId)`

## React Native upload note

React Native's `FormData` supports a URI-backed file descriptor. The client uses this approach so the app does not need to read a local `file://` URI through browser fetch.

Never put a buyer's permanent catalogue credential or server-to-server AI key in a mobile application. Use the buyer app's backend to call the self-hosted engine and keep service credentials server-side.

Composition-group results are catalogue data only. The host app should retain the API's review notice and should not present a composition match as a patient-specific instruction to change treatment.
