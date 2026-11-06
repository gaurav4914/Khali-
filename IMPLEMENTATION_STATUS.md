# Implementation Status

Updated: 2026-11-06

## Implemented in the initial engine foundation

- FastAPI application and versioned REST endpoints.
- Temporary scan-session lifecycle with expiry.
- JPEG/PNG/WEBP validation and upload-size checks.
- Basic image quality indicators (brightness, edge detail, dimensions).
- OCR provider protocol with local Tesseract implementation and empty mock provider.
- OCR pre-processing derivative that preserves the original uploaded file.
- Conservative extraction of visible product-name/composition/manufacturer text candidates.
- Read-only REST catalogue adapter contract.
- Deterministic exact product-identity resolver with ambiguous and review-required states.
- Composition-only matching is explicitly prohibited as proof of product identity.
- Optional API-key authentication.
- React Native-compatible TypeScript API client.
- Docker packaging, configuration template, documentation, and initial tests.
- CI workflow for lint and automated tests.

## Not implemented yet

- A production-grade AI Vision adapter (Gemini/OpenAI/other buyer-selected provider).
- Advanced blur/glare/text-region detection and adaptive camera guidance.
- Persistent/shared scan-session storage for multiple API replicas.
- Buyer-specific catalogue connector beyond the documented REST adapter.
- Admin configuration dashboard.
- Full React Native camera SDK UI; the current SDK is a typed API client.
- Production security assessment, privacy review, performance benchmarks, and regulatory review.

## Important deployment limitation

The current scan-session store is in-memory and is intended for one API process. Do not deploy multiple replicas until a buyer-managed shared session store and object-storage adapter are added. The system does not require a shared medicine database.
