# Medicine Photo Intelligence Engine

A self-hosted B2B engine for **medicine-pack image capture, printed-text extraction, exact product identification, and exact recorded-composition matching against a buyer-authorised catalogue**.

This repository is the engine/backend project. A buyer's existing Android, iOS, React Native, or web application can integrate through the REST API or the TypeScript client in `sdk/react-native`.

## Product model

- The buyer's catalogue is the source of truth. This project does not ship or operate a shared medicine database.
- Each buyer runs its own copy and supplies its own infrastructure, catalogue credentials, OCR/AI credentials, and storage policy.
- Exact product identity and composition-group discovery are separate operations.
- Composition-group discovery returns every buyer-catalogue record whose complete structured active-ingredient set and per-ingredient strengths match the scanned label.
- Reference-brand / other-brand group labels come only from buyer-supplied catalogue metadata.
- Dosage form, release type, route, missing fields, and uncertainty remain visible.
- A catalogue composition match is not a clinical interchangeability decision or an instruction to change treatment.
- Local Tesseract OCR is the initial OCR implementation. A production AI Vision adapter is not yet included.

## Quick start

Requirements: Python 3.11+, Tesseract OCR installed, and the language packs you intend to use.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
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

Set `OCR_PROVIDER=mock` in `.env` to run without a local Tesseract binary. The mock provider deliberately returns no recognised text.

## Docker

```bash
cp .env.example .env
# Set a long random API_KEY before exposing the service.
docker compose up --build
```

The container installs Tesseract English and Hindi language packs. For production, set `ENVIRONMENT=production` and a strong buyer-owned `API_KEY`; the app refuses production startup without it. Keep the service behind HTTPS or a private network.

## Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/v1/scans` | Create a temporary scan session |
| POST | `/v1/scans/{scan_id}/captures` | Upload front/composition/back image |
| DELETE | `/v1/scans/{scan_id}/captures/{capture_id}` | Remove a rejected capture before retake |
| POST | `/v1/scans/{scan_id}/quality-check` | Re-check a stored capture |
| POST | `/v1/scans/{scan_id}/recognise` | Run OCR and extract printed text/components |
| GET | `/v1/scans/{scan_id}` | Retrieve scan state |
| POST | `/v1/catalogue/resolve` | Resolve the exact photographed product |
| POST | `/v1/catalogue/composition-matches` | Find all exact recorded-composition records in the buyer catalogue |
| GET | `/v1/catalogue/products/{product_id}` | Retrieve a buyer catalogue record |
| GET | `/v1/health` | Liveness check |
| GET | `/v1/ready` | Dependency/configuration readiness |

## React Native integration

The TypeScript package in `sdk/react-native` provides typed API methods for session creation, image upload, recognition, exact identity resolution, composition-group lookup, and capture deletion. It is currently an API client, not yet a complete camera UI component. See `docs/SDK.md`.

## Testing

```bash
pytest
ruff check backend tests --select E4,E7,E9,F
```

The current scan store is in-memory and supports one API process only. Do not deploy multiple replicas until a buyer-managed shared session store and object-storage adapter are implemented.

## Status

This is an evolving implementation foundation, not a production-certified medical product. Production evaluation requires representative OCR validation, security/privacy review, buyer catalogue verification, and review of the final intended purpose and applicable requirements.
