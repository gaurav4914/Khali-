# Medicine Photo Intelligence Engine

A self-hosted B2B engine for **medicine-pack image capture, printed-text extraction, and exact product identification against a buyer-authorised catalogue**.

This repository is the engine/backend project. The separate Aushadhi React Native app can integrate it through the REST API or the TypeScript client in `sdk/react-native`.

## Product boundary

- The buyer's catalogue is the source of truth. This project does not ship or operate a shared medicine database.
- The buyer operates its own deployment, catalogue connection, OCR/AI credentials, storage and infrastructure.
- The first release identifies the product shown in a photo. It does not search for or recommend other medicines, determine clinical equivalence, or provide treatment advice.
- Local Tesseract OCR is the initial OCR implementation. It reads text; it does not verify medical correctness.
- The AI Vision provider contract is intentionally pluggable. A live cloud provider is not enabled by default.

## Quick start

Requirements: Python 3.11+, Tesseract OCR installed, and the language packs you intend to use.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --app-dir backend --reload
```

Open:
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/v1/health
- Readiness: http://localhost:8000/v1/ready

Set `OCR_PROVIDER=mock` in `.env` to run without a local Tesseract binary. The mock provider deliberately returns no recognised text; it does not invent a medicine.

## Docker

```bash
docker compose up --build
```

The container installs Tesseract English and Hindi language packs. Copy `.env.example` to `.env` and configure the buyer's catalogue and API key before exposing the service beyond a trusted development environment.

## Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/v1/scans` | Create a temporary scan session |
| POST | `/v1/scans/{scan_id}/captures` | Upload front/composition/back image |
| POST | `/v1/scans/{scan_id}/quality-check` | Re-check a stored capture |
| POST | `/v1/scans/{scan_id}/recognise` | Run configured OCR and extract printed text |
| GET | `/v1/scans/{scan_id}` | Retrieve session status |
| POST | `/v1/catalogue/resolve` | Resolve the photographed product in the buyer catalogue |
| GET | `/v1/catalogue/products/{product_id}` | Retrieve a buyer catalogue record |
| GET | `/v1/health` | Liveness check |
| GET | `/v1/ready` | Dependency/configuration readiness |

All product-resolution operations are limited to identifying the product visible in the image. A shared ingredient string alone is never treated as proof that two different products are the same product.

## React Native integration

A small TypeScript API client is in `sdk/react-native`. It can be used by an Expo/React Native app. The host app owns camera permissions and capture UI; it sends the captured image URI to this SDK.

## Tests

```bash
pytest
```

## Status

This is the first implementation foundation. The initial code provides the API, local OCR adapter, image checks, read-only REST catalogue adapter, deterministic identity resolver, test suite, Docker packaging and TypeScript client. It is not yet a clinically validated medical product, and production deployment requires security, performance, privacy and intended-purpose/regulatory review.
