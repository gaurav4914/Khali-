# Implementation Status

Updated: 2026-11-06

## Implemented

- FastAPI application and versioned REST endpoints.
- Temporary in-memory scan-session lifecycle with expiry.
- JPEG/PNG/WEBP image validation and upload-size checks.
- Basic image-quality indicators (brightness, edge detail, dimensions).
- OCR provider protocol with local Tesseract implementation and empty mock provider.
- OCR preprocessing derivative that preserves the original uploaded file.
- Conservative extraction of printed product-name, composition, and manufacturer text.
- Initial multi-component composition parsing for explicitly headed composition / contains sections.
- Component-level provenance and OCR confidence.
- Buyer read-only REST catalogue adapter.
- Exact photographed-product identity resolver with ambiguity and review-required states.
- Composition-group matcher that compares the complete active-component set and each strength, independent of component order.
- Composition match results keep reference-brand/other-brand category only when buyer catalogue supplies it.
- Formulation differences remain visible; composition matches are not labelled as clinically interchangeable.
- REST endpoint for buyer-catalogue composition-group discovery.
- React Native TypeScript API client for scan, upload, extraction, identity, composition lookup, and capture deletion.
- API key required outside local development/test environments.
- Docker packaging, configuration template, documentation, and initial tests.
- CI workflow for lint and automated tests.

## Not implemented yet

- Production AI Vision provider adapter (Gemini/OpenAI/other buyer-selected provider).
- Full React Native/Expo guided camera UI; current SDK is still a typed API client.
- Advanced blur/glare/text-region detection and adaptive camera guidance.
- Persistent/shared scan-session storage for multiple API replicas.
- Buyer-specific SQL/database connectors beyond the read-only REST adapter.
- Admin configuration dashboard.
- Production security assessment, privacy review, performance benchmarks, and regulatory review.

## Deployment limitation

The current ScanStore is in-memory and intended for one API process/replica. Do not deploy multiple replicas until a buyer-managed shared session store and object-storage adapter are added. The system does not require a shared medicine database.
