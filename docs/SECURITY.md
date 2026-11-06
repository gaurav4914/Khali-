# Security and Privacy Notes

This is an early implementation foundation, not a completed security certification.

## Current controls

- API-key authentication is open only in local development/test environments with no configured key.
- Production startup requires a buyer-owned `API_KEY`.
- Protected API routes validate `X-API-Key` using constant-time comparison.
- Configurable upload-size limit.
- JPEG, PNG and WEBP allow-list with image decoding and minimum-dimension validation.
- Buyer catalogue access is read-only by contract.
- Catalogue credentials are not returned by API responses.
- The default catalogue adapter is empty; no shared medicine database is included.
- Temporary scan sessions expire in memory and associated image files are deleted when expired.
- A rejected/retaken capture can be removed through the delete-capture endpoint.
- No image analytics or model-training endpoint exists.

## Required before production

- Put the API behind HTTPS and a trusted reverse proxy.
- Do not embed the buyer's server API key in a distributed mobile app; use the buyer backend as a proxy or add a reviewed short-lived token flow.
- Restrict network access and catalogue egress.
- Configure external OCR/AI provider retention and data-processing terms before sending images to that provider.
- Add persistent/shared session storage before running multiple replicas.
- Add automated dependency, container, penetration and upload-abuse testing.
- Document buyer retention, consent, data-subject request and incident-response procedures.
- Validate OCR and composition extraction on a representative, lawfully sourced test corpus.
- Obtain professional review of the intended purpose and applicable medical-device, privacy and pharmacy requirements.

Do not upload real patient records or confidential medicine catalogue data to development/test environments.
