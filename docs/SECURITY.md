# Security and Privacy Notes

This is an early implementation foundation, not a completed security certification.

## Current controls

- Optional API-key authentication through `X-API-Key`.
- Configurable upload-size limit.
- JPEG, PNG and WEBP allow-list.
- Image decode and minimum-dimension validation.
- Buyer catalogue access is read-only by contract.
- Secrets are not returned by API responses.
- The default catalogue adapter is empty; no shared medicine database is included.
- Temporary scan sessions expire in memory and associated image files are deleted when expired.
- No image analytics or model training endpoint exists.

## Required before production

- Put the API behind HTTPS and a trusted reverse proxy.
- Replace a static API key with the buyer's identity provider or scoped service tokens where appropriate.
- Restrict network access and catalogue egress.
- Configure external OCR/AI provider retention and data-processing terms before sending images to that provider.
- Add persistent/shared session storage before running multiple replicas.
- Add automated dependency, container, penetration and upload-abuse testing.
- Document buyer retention, consent, data-subject request and incident-response procedures.
- Obtain professional review of the intended purpose and applicable medical-device, privacy and pharmacy requirements.

Do not upload real patient records or confidential medicine catalogue data to development/test environments.
