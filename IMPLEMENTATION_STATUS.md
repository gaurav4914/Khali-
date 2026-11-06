# Implementation Status

Updated: 2026-11-07

## Repository direction

The canonical specification is [PROJECT_PLAN.md](PROJECT_PLAN.md) v1.2. The Hindi implementation handoff for the next AI coding session is [GEMINI_IMPLEMENTATION_PROMPT_HI.md](GEMINI_IMPLEMENTATION_PROMPT_HI.md).

## Implemented foundation

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
- Composition-group matcher that compares the complete active-component set and per-component strength, independent of component order.
- Deterministic mass-unit normalisation for implemented mass units; IU and percentage remain separate.
- Reference-brand / other-brand labels are accepted only from buyer catalogue metadata.
- Formulation differences and missing fields remain visible.
- REST endpoint for buyer-catalogue composition-group discovery.
- React Native TypeScript API client for scan, upload, extraction, identity, composition lookup and capture deletion.
- API key required outside local development/test environments.
- Docker packaging, environment template, initial documentation and tests.
- CI workflow for lint and automated tests.

## Important limitations and next implementation work

- The composition parser is still conservative and does not yet cover every medicine label layout, multi-line arrangement, regional language, strength basis or salt/canonical ingredient mapping.
- The current component schema needs full strength-basis support (for example, per tablet vs per 5 mL) before robust production comparisons.
- The full React Native/Expo guided camera interface is not complete; the current SDK is an API client, not a finished scanner UI.
- Adaptive blur/glare/text-region detection and guided retry logic need expansion and device testing.
- A production AI Vision adapter (Gemini or another buyer-selected provider) is not yet complete.
- The current buyer integration is a read-only REST contract. A configurable SQL connector is optional future work.
- The current ScanStore is in-memory and supports one API process only. Multi-replica production use requires a buyer-managed shared session store and object-storage adapter.
- The admin/configuration dashboard and buyer field-mapping UI are not complete.
- Authentication for mobile integrations needs a secure buyer-backend proxy or short-lived scoped-token design; never embed a permanent server API key in a mobile app.
- Security, privacy, performance, representative OCR and regulatory review are still required before a commercial production release.

## CI and test status

Earlier CI history included a response-schema/test mismatch where one test expected `total_matches` after the response field had changed to `matches_in_page`. The test and SDK assertions were subsequently updated. Verify the latest GitHub Actions run on the current main commit before treating the branch as green. Do not assume a green run from an older commit validates later changes.

## Deployment limitation

The current ScanStore is in-memory and intended for one API process/replica. Do not deploy multiple replicas until a buyer-managed shared session store and object-storage adapter are added. The engine does not require a shared medicine catalogue database.
