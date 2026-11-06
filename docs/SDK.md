# React Native / Expo API Client

The package in `sdk/react-native` is a typed HTTP client. It is not yet a camera UI component. The host Aushadhi app owns camera permission, guided capture screens, image preview and retake controls.

## Example

```ts
import { MedicineEngineClient } from "./sdk/react-native/src";

const engine = new MedicineEngineClient({
  baseUrl: "https://buyer-owned-engine.example",
  apiKey: "short-lived-or-app-scoped-token",
});

const session = await engine.createScanSession();
// Capture with Expo Camera / ImagePicker in the host app.
const capture = await engine.uploadMedicineImage(
  session.scan_id,
  "front",
  selectedImageUri,
);
const extraction = await engine.recogniseMedicine(session.scan_id);
const identity = await engine.resolveProductIdentity(session.scan_id);
```

## React Native upload note

React Native's `FormData` supports a URI-backed file descriptor. The client uses this approach so the app does not need to read a local `file://` URI through browser fetch.

Never put a buyer's permanent catalogue credential or server-to-server AI key in a mobile application. Use the buyer app's backend to issue appropriately scoped credentials or proxy requests.
