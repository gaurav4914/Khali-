# Self-hosted Deployment

Each buyer runs an independent installation. The original developer does not operate a shared API or central medicine catalogue.

## Docker deployment

1. Copy `.env.example` to `.env`.
2. Set a long random `API_KEY`.
3. Select OCR provider. Use `tesseract` for local OCR or `mock` for an empty development provider.
4. Configure the buyer's catalogue adapter only after its owner grants read-only access.
5. Run `docker compose up --build -d`.
6. Confirm `/v1/health` and `/v1/ready`.
7. Restrict the port behind the buyer's HTTPS reverse proxy or private network.

## Deployment notes

- The first ScanStore is in-memory and intended for one API process/replica.
- Temporary captures live under `UPLOAD_DIR`. The deployment clears orphaned files at startup and expires scan sessions after `SCAN_TTL_SECONDS`.
- Do not scale to multiple API replicas until a buyer-managed shared session store and object-storage adapter are implemented.
- Keep secrets out of source control. Use the buyer's secret manager in production.
- Back up only what the buyer deliberately chooses to retain. The engine does not require a medicine catalogue database of its own.

## Native and cloud integrations

The API is platform-neutral. An Android/iOS React Native app can use the TypeScript client in `sdk/react-native`. The app must send the buyer's API endpoint and short-lived/appropriately scoped credential. Never embed a permanent server-to-server catalogue credential in a mobile app.
