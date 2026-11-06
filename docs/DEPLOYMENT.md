# Self-hosted Deployment

Each buyer runs an independent installation. The original developer does not operate a shared API or central medicine catalogue.

## Docker deployment

1. Copy .env.example to .env.
2. For local development, keep ENVIRONMENT=development. Authentication is open only in local development/test mode when no key is configured.
3. For production, set ENVIRONMENT=production and a strong, unique buyer-owned API_KEY.
4. Select OCR provider. Use tesseract for local OCR or mock for an empty development provider.
5. Configure the buyer's catalogue adapter only after its owner grants read-only access.
6. Run docker compose up --build -d.
7. Confirm /v1/health and /v1/ready.
8. Restrict the port behind the buyer's HTTPS reverse proxy or private network.

## Buyer catalogue contract

The buyer provides these read-only endpoints:

- GET /products?query=<printed-name>&barcode=<barcode> for exact pack identity lookup.
- POST /products/search-by-composition for exact structured active-composition results. The endpoint receives the full active component set and each per-ingredient strength, and returns all matching records for the requested page.
- GET /products/{product_id} for a single catalogue record.

Every returned composition record must include structured component entries. A plain free-text composition string is not sufficient for exact group matching. See docs/CATALOGUE_ADAPTER.md.

## Deployment notes

- The first ScanStore is in-memory and intended for one API process/replica.
- Temporary captures live under UPLOAD_DIR. The deployment clears orphaned files at startup and expires scan sessions after SCAN_TTL_SECONDS.
- Do not scale to multiple API replicas until a buyer-managed shared session store and object-storage adapter are implemented.
- Keep secrets out of source control. Use the buyer's secret manager in production.
- Back up only what the buyer deliberately chooses to retain. The engine does not require a medicine catalogue database of its own.
- Keep API_KEY and catalogue credentials on trusted server infrastructure. Never embed a permanent server credential in a distributed mobile app.
- If external AI/OCR providers are later enabled, each buyer must supply their own provider credentials and configure applicable data-retention terms.

## Native and cloud integrations

The API is platform-neutral. An Android/iOS React Native app can use the TypeScript client in sdk/react-native. For mobile use, the host app's backend should act as a gateway or issue short-lived scoped credentials; do not embed permanent backend or catalogue secrets in the app.

## Deployment limitations

The current scanner SDK package is an API client, not yet the full camera UI. The current ScanStore is in-memory. These limitations must be addressed before production sale or multi-replica deployment.
