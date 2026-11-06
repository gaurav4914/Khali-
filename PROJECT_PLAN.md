# Medicine Photo Intelligence Engine — Master Project Plan

> Document: Product requirements, scanner UX, technical architecture, API contracts, deployment model, safety boundaries, and implementation roadmap  
> Version: 1.0  
> Status: Planning baseline — implementation has not started  
> Repository: gaurav4914/Khali-  
> Product model: Self-hosted B2B software, licensed repeatedly to multiple buyers  
> Core principle: Build once. Package once. Each buyer installs and operates its own copy.

---

## 1. Executive summary

We will develop a reusable software product that pharmacy, medicine-commerce, and healthcare application companies can integrate into their existing mobile or web applications.

We are **not** building a consumer medicine app, online pharmacy, or shared medicine database. Our product is a self-hosted software engine made up of:

- A guided camera-scanning experience that can be embedded in another app.
- Image quality checks and targeted multi-photo capture.
- OCR and optional AI-assisted reading of printed medicine-pack information.
- Structured extraction of product name, printed composition text, strength text, form text, manufacturer text, and other visible label fields.
- A configurable connector that reads the buyer's own authorised product catalogue.
- An exact-product identity resolution engine that finds the scanned product record in the buyer's catalogue.
- REST APIs, a React Native/Expo integration package, a sample integration app, and deployment tools.
- Complete source code and documentation so the buyer can host the product in its own cloud or on-premises environment.

Each buyer runs an independent copy. The buyer supplies its own server, catalogue access, AI-provider credentials, storage policy, and any paid OCR/AI services. The product must not depend on our permanent cloud account, central API, shared medicine database, or recurring service operated by us.

### Safety boundary for the first product

This product identifies and resolves the exact product visible in a photograph. It may compare the photographed label with the corresponding catalogue record to explain why that identity was or was not resolved.

It will **not** search for, rank, recommend, or declare other medicines to be substitutes or clinically interchangeable. It will not tell a patient to start, stop, or change a medicine. If a buyer later wants a professional clinical workflow, that must be designed and reviewed separately by appropriately qualified professionals and regulatory experts; it is not part of this first product.

## 2. Product goals

### 2.1 Main goals

1. Make the scanner easy to embed in an existing Android/iOS app.
2. Read medicine-pack text reliably, including small, curved, reflective, folded, or wrinkled packaging.
3. Ask for another targeted photo when the first image is not readable enough.
4. Convert OCR/vision output into structured, traceable fields.
5. Resolve the scanned product against only the buyer's authorised catalogue.
6. Keep image reading and product identity resolution separate from any medical decision.
7. Support different buyer databases through adapters rather than assuming one database schema.
8. Deliver the complete system as a self-hosted package that can be sold to multiple buyers.
9. Minimise operational work for the original developer after delivery.

### 2.2 Non-goals

The first release will not:

- Sell, dispense, or order medicines.
- Operate a consumer-facing marketplace.
- Maintain a shared global medicine database.
- Scrape another application's private database.
- Give diagnosis, dosage, treatment, prescription, or medicine-switching advice.
- Search for or rank alternative medicines.
- Declare two different products clinically interchangeable.
- Require every buyer to use the same cloud, database vendor, AI provider, or app framework.
- Depend on a central licence server operated by us.

## 3. Product and commercial model

### 3.1 What is delivered

The complete software package contains:

1. Backend source code.
2. Scanner SDK source code and installable package.
3. REST API and OpenAPI documentation.
4. OCR and AI provider adapters.
5. Buyer catalogue adapter framework.
6. Exact-product identity resolution engine.
7. Admin configuration panel.
8. Demo/sample integration app.
9. Docker deployment files.
10. Environment-variable template.
11. Installation, upgrade, backup, and troubleshooting guides.
12. Automated test suite and synthetic sample catalogue.
13. A basic software licence template for professional review before commercial use.

### 3.2 Repeatable sales model

The codebase is developed once. Each buyer receives a separate copy and deploys it in its own environment.

The intended arrangement is a **non-exclusive, repeatable software licence**: each buyer receives permission to run the agreed software in its own product, while the developer retains the ability to license the same product to other buyers. This is different from an exclusive buyout or transfer of all intellectual-property rights.

The first release does not need a licence activation server. A written agreement and delivery record can document the transaction. The agreement should clearly state permitted use, number of installations, redistribution restrictions, ownership, warranty limits, support period, and upgrade responsibilities. Have the final document reviewed before a real commercial sale.

### 3.3 Buyer pays and operates

Each buyer is responsible for:

- Infrastructure and hosting.
- Database/API access and permissions.
- Its own AI-provider account and usage charges.
- Any paid OCR service it chooses.
- Backups, logs, monitoring, and retention settings.
- Its end-user notices and consent flow.
- Its catalogue accuracy and data-use permissions.
- Security updates and upgrades after any agreed support period.

We provide source code and installation documentation. We do not operate a shared production API for all buyers.

## 4. High-level architecture

The solution is a modular, self-hosted application. Keep the first build as a modular monolith with clear internal module boundaries; avoid unnecessary microservices until real load or buyer requirements justify them.

### 4.1 Main components

1. **Scanner SDK:** camera screens, capture guidance, preview, retry, and progress UI.
2. **API Gateway:** authentication, request validation, rate limits, upload limits, and request IDs.
3. **Image Quality Module:** checks blur, glare, exposure, orientation, framing, and text size.
4. **Image Pre-processing Module:** crop, rotate, perspective correction, denoise, and contrast enhancement for OCR.
5. **OCR Provider Layer:** local OCR and optional external OCR services.
6. **Vision Provider Layer:** optional AI image interpretation through buyer-configured provider credentials.
7. **Extraction and Normalisation Module:** converts OCR/vision results into a structured scan record.
8. **Catalogue Adapter:** retrieves records from the buyer's database/API through a read-only contract.
9. **Identity Resolution Engine:** determines whether the photographed product can be confidently identified as a particular record in the buyer's catalogue.
10. **Result Formatter:** returns evidence, confidence, missing fields, and the resolved catalogue record to the buyer's app.
11. **Configuration Panel:** lets the buyer configure providers, catalogue field mappings, retention, and scan limits.
12. **Audit/Operations Module:** customer-controlled technical logs and optional review events.

### 4.2 Deployment boundary

The following must run within the buyer's environment:

- API service.
- Configuration.
- Catalogue connector.
- Any temporary image storage.
- Logs and optional operational database.
- OCR worker if the buyer chooses local OCR.

External AI/OCR requests are made directly from the buyer's deployed copy using credentials the buyer supplies. The original developer's infrastructure must not be in the request path.

### 4.3 Suggested first implementation stack

Keep the stack practical for a small development effort:

- Backend: Python + FastAPI.
- Image processing: OpenCV and Pillow.
- OCR: provider interface supporting a local OCR engine and optional cloud OCR.
- AI vision: provider adapter interface; do not hard-code one provider.
- Scanner sample and React Native SDK: TypeScript + React Native + Expo-compatible camera modules.
- API contracts: OpenAPI.
- Packaging: Docker and Docker Compose.
- Configuration: environment variables plus a small customer-owned configuration store if required.
- Tests: pytest for backend, TypeScript tests for SDK, integration tests with a mock catalogue provider.

These are initial engineering choices, not a promise that every optional provider will be supported on day one.

## 5. Camera button: complete user experience

The most important part of the product is what happens after the user taps the host app's camera button. The scanner should feel guided and deliberate, not like a generic camera that expects the user to know what to photograph.

### 5.1 Entry screen

The host app opens the embedded scanner through the SDK. The scanner displays:

- Title: **Scan medicine pack**
- Instruction: **Keep the pack inside the frame. We will guide you if another photo is needed.**
- Camera permission state.
- A privacy note controlled by the buyer: where image processing happens and whether an external AI/OCR provider is used.
- Primary action: **Start scan**
- Secondary action: **Choose photo**, only if the buyer enables gallery import.

If camera permission is denied, show simple instructions for enabling it in device settings and provide a safe exit back to the host app.

### 5.2 Live scanner screen

Layout:

- Top bar: back/close, scan step indicator, help icon.
- Main area: live camera preview.
- Centre: rounded rectangular guide frame sized for medicine packaging.
- Above or below the frame: short, changing guidance.
- Bottom row: flash/torch, capture button, gallery option if enabled, and camera switch if available.
- Small status indicator: camera ready / focus adjusting / hold steady.

Do not fill the screen with technical terms such as OCR, embeddings, or confidence scores. Explain only the next action.

### 5.3 Guided capture stages

The sequence is adaptive. Do not force every user to take every possible photo.

**Stage A — Full front view**

Prompt: “Show the full front of the pack.”  
Goal: read visible product name, brand, and overall pack identity.

**Stage B — Composition close-up**

Prompt: “Bring the small printed details closer. Keep the letters inside the frame.”  
Goal: capture composition and strength text printed on the pack, as identification evidence.

**Stage C — Back or side label**

Prompt: “Turn the pack over and show the printed details.”  
Goal: capture details not visible on the front, such as manufacturer or additional label text.

**Stage D — Targeted retry**

Show this only when quality checks or extraction indicate that a particular area is unreadable. Examples:

- “The text is too small. Move the camera slightly closer.”
- “The image is blurred. Hold still and tap again.”
- “Light is reflecting on the text. Tilt the pack slightly.”
- “Part of the label is outside the frame. Move the pack into the guide.”
- “We could not read the printed details. Photograph that section only.”

**Optional barcode stage**

If a barcode is visible and the buyer has barcode lookup in its own catalogue, allow a barcode scan. Barcode data is an additional identity clue, not proof of clinical suitability.

### 5.4 Camera interaction details

- Keep the capture button large and reachable.
- Use autofocus and tap-to-focus where supported.
- Offer torch control when device hardware supports it.
- Use zoom in a controlled range; never silently apply extreme digital zoom.
- Show a simple alignment frame and text-region guide.
- Use haptic confirmation only if the device supports it and the buyer enables it.
- Avoid asking users to rotate the pack unnecessarily. Ask only for the photo that can resolve a missing field.
- Support camera rotation/orientation changes.
- Preserve the original captured image for the current scan until processing finishes, subject to the buyer's retention policy.
- Transformed copies are only for image processing.
- Let the user retake or remove an individual capture before submission.
- Display progress, for example “Front photo 1 of 2”; do not imply that the system is creating a true 3D model.

### 5.5 Capture review screen

After each photo, show:

- The captured image.
- A plain status: “Clear enough”, “Try again”, or “Need a closer photo”.
- Retake button.
- Use photo button.
- A short reason when retry is needed.

Do not show a success state when essential printed text remains unreadable.

### 5.6 Processing screen

After the required captures are submitted:

- Show a progress sequence: checking image quality → reading visible text → checking the buyer's catalogue.
- Allow cancellation.
- Do not expose raw provider errors or API keys.
- If network access fails, offer retry without losing captured images, subject to the buyer's retention policy.
- If the result remains uncertain, show “Could not identify confidently” and request a targeted photo.

### 5.7 Result hand-off screen

The reference UI should show:

1. Identified product text and fields.
2. Which fields were read clearly.
3. Which fields are uncertain or missing.
4. The exact product record, if resolved in the buyer's catalogue.
5. A neutral explanation of which printed fields supported the identity.
6. A clear message when identity could not be established.

The host app controls its own final layout. The scanner must not use labels such as “Take this instead”, “Safe substitute”, or “Best medicine”.

## 6. Image quality and guided retry engine

### 6.1 Quality checks

Each capture should be assessed for:

- Blur / focus.
- Glare and reflective hotspots.
- Underexposure and overexposure.
- Text size relative to image dimensions.
- Cropping or missing label edges.
- Skew/perspective.
- Orientation.
- Compression artifacts.
- Whether the requested text region is visible.

### 6.2 Quality result schema

Return a structured quality response:

~~~json
{
  "quality_status": "retry_required",
  "issues": ["blur", "text_too_small"],
  "recommended_action": "move_closer_and_hold_steady",
  "target_region": "composition_text",
  "capture_id": "capture_123"
}
~~~

Allowed statuses:

- accepted: adequate for the next processing step.
- retry_recommended: a better image could improve reading, but the current image can still be processed.
- retry_required: an essential region is unreadable.
- unsupported: the image is not a supported label image, or the file cannot be processed.

### 6.3 Important image-processing rule

Image enhancement may improve contrast, rotation, perspective, or noise. It must not invent letters or reconstruct missing text. Keep a link to the original image and record which transformations were applied. If OCR and AI disagree, mark the field uncertain and request a clearer capture or human review.

### 6.4 Multi-image consensus

When multiple captures are available:

1. OCR each image independently.
2. Keep each field's source capture and text region.
3. Compare repeated readings of the same printed field.
4. Prefer a clear, readable text span over a guessed model interpretation.
5. If readings conflict, do not silently choose one.
6. Ask for a targeted recapture or return uncertainty.

A multi-photo workflow is useful; genuine 3D reconstruction is not needed for the first version.

## 7. OCR, AI, and structured extraction

### 7.1 Division of responsibility

**OCR/local vision:** reads printed characters and identifies text regions.

**Optional AI vision provider:** helps interpret layout, identify likely field boundaries, and return structured candidates from the image.

**Our parser:** validates and normalises the returned content.

**Our identity resolver:** uses the extracted product identity to retrieve the corresponding record from the buyer's catalogue.

The AI provider must not make up missing strengths, ingredients, dosage forms, or product identities. It must not decide that a different medicine is a safe replacement.

### 7.2 Provider interface

Create a common provider contract so the buyer can configure a supported service without changing the identity-resolution logic. Each provider adapter must support:

- Provider name and model configuration.
- Buyer-owned API credential.
- Timeout and retry policy.
- Request size limits.
- Structured response validation.
- Provider error normalisation.
- Usage metadata where available.
- Optional disabling of external image transfer.

At minimum, include a mock provider for local development and tests. Add real provider adapters only after their current API documentation and terms have been reviewed.

### 7.3 Structured extraction schema

~~~json
{
  "scan_id": "scan_123",
  "identity": {
    "printed_product_name": {
      "value": "Example product",
      "confidence": 0.93,
      "source_capture_id": "capture_123",
      "source_text": "Example product"
    },
    "brand_name": {
      "value": null,
      "confidence": null,
      "source_capture_id": null,
      "source_text": null
    }
  },
  "printed_composition_text": {
    "value": "Ingredient A 500 mg",
    "confidence": 0.84,
    "source_capture_id": "capture_124",
    "source_text": "Ingredient A 500 mg"
  },
  "dosage_form_text": null,
  "release_type_text": null,
  "route_text": null,
  "manufacturer_text": null,
  "unreadable_fields": ["manufacturer"],
  "review_required": true
}
~~~

Important:

- Preserve literal printed text separately from normalised values.
- Do not label an ingredient as active or inactive unless a reliable source confirms that role.
- Store a unit-normalised value only when the conversion is deterministic and validated.
- Distinguish “not visible”, “not present”, and “not recognised”.
- Keep confidence as field-level evidence, not as a guarantee of correctness.

## 8. Customer catalogue integration — no shared medicine database

This is a central requirement.

### 8.1 Source of truth

The buyer's existing catalogue is the source of product records. Our software does not create or maintain a shared medicine database.

The buyer must grant an authorised read-only integration method. Preferred order:

1. Buyer-provided REST or GraphQL catalogue API.
2. A read-only SQL view or read-only database account.
3. A buyer-provided connector implementation that follows our interface.

Do not scrape private application screens, bypass access controls, or copy a buyer's catalogue without permission.

### 8.2 Canonical catalogue contract

Different companies use different database schemas. Create a configurable adapter that maps their fields into our canonical read-only structure.

Minimum fields for reliable identity resolution:

- Buyer product ID.
- Product/display name.
- Brand name.
- Printed composition text or structured catalogue description.
- Strength text.
- Dosage form text.
- Release type, where available.
- Manufacturer, if available.
- Product status, if available.
- Source/update timestamp.

Optional fields such as product image URL, barcode, price, stock, and product page URL should pass through only when the buyer permits them.

**Hard dependency:** if the buyer's catalogue has only names and no usable identifiers, barcode, or other label fields, the engine may not be able to resolve a product confidently. It must return “catalogue details insufficient” instead of inventing an identity.

### 8.3 Adapter behaviour

The adapter must expose operations such as:

- Search by exact product identifiers.
- Search by barcode or catalogue code.
- Search by printed product-name candidates.
- Retrieve the full record for a candidate.
- Return source and update timestamp.
- Report missing fields and connector errors.

All queries must be parameterised. SQL mode must use a read-only account and configured views/queries; never generate arbitrary SQL from AI output.

### 8.4 No catalogue copying by default

- No full database import.
- No background scraping.
- No persistent cache by default.
- Optional short-lived cache only within the buyer's own deployment and only if enabled by the buyer.
- Cache entries must have expiry and a clear invalidation policy.
- The buyer can turn caching off.
- Never send buyer catalogue records to the original developer.

## 9. Exact-product identity resolution engine

### 9.1 Separation from AI

The identity resolver is deterministic application code. AI may help read the image, but the final identity check is performed by tested code against the buyer's catalogue.

### 9.2 Identity evidence

Resolve only the product shown in the photograph. Evidence may include:

1. Exact barcode or buyer catalogue identifier.
2. Exact printed product name.
3. Brand text and pack-specific identifiers.
4. Printed composition and strength text as supporting identity evidence.
5. Manufacturer text, where available.
6. Other buyer-provided catalogue identifiers.

Do not treat a shared composition string as proof that two different products are the same product. Do not use this module to search for alternative medicines.

### 9.3 Result groups

Use neutral result labels:

- **Exact catalogue identity:** strong identifier evidence maps the photo to one catalogue record.
- **Likely catalogue identity — review the label:** several fields agree, but one important identifier is missing.
- **Multiple possible records:** more than one buyer record resembles the extracted text.
- **Insufficient catalogue information:** required fields are absent from the buyer's data.
- **Unable to identify:** image or text quality is insufficient.
- **No catalogue record found:** the buyer's catalogue did not return a matching product.

### 9.4 Ordering

- Prefer strong identifiers over fuzzy text similarity.
- Prefer complete, current records over incomplete records.
- Never use popularity, price, sponsorship, or “famous brand” status as an identity-confidence score.
- If multiple possible records remain, display them as unresolved possibilities and ask for better label evidence or human review.
- Do not hard-code the system to return exactly two records.

### 9.5 Explainability payload

For each possible identity, include:

- Buyer catalogue product ID.
- Fields that matched.
- Fields that differed.
- Fields that were missing.
- Source catalogue update timestamp.
- Identity status.
- Plain-language reason for that status.

The UI must not convert identity confidence into a treatment recommendation.

## 10. API design

Use versioned REST endpoints. Publish an OpenAPI document and stable request/response schemas.

### 10.1 Core endpoints

- POST /v1/scans — create a scan session.
- POST /v1/scans/{scan_id}/captures — upload an image capture.
- POST /v1/scans/{scan_id}/quality-check — assess a capture.
- POST /v1/scans/{scan_id}/recognise — run OCR/vision extraction.
- GET /v1/scans/{scan_id} — retrieve scan state.
- POST /v1/catalogue/resolve — resolve the scanned product against the buyer's catalogue.
- GET /v1/catalogue/products/{product_id} — retrieve an identified catalogue record.
- GET /v1/health — service health.
- GET /v1/ready — dependency readiness.

The host application can call these endpoints directly or through the SDK.

### 10.2 Example identity request

~~~json
{
  "scan_id": "scan_123",
  "catalogue_scope": "current_buyer_catalogue",
  "include_unresolved_candidates": true
}
~~~

### 10.3 Example response

~~~json
{
  "resolution_id": "res_123",
  "status": "likely_identity_review_required",
  "identified_fields": {
    "product_name": {
      "value": "Example product",
      "confidence": 0.93
    }
  },
  "catalogue_record": {
    "product_id": "buyer-item-001",
    "display_name": "Example catalogue product",
    "identity_status": "likely_identity",
    "matched_fields": ["product_name", "printed_composition_text"],
    "different_fields": [],
    "missing_fields": ["manufacturer"],
    "catalogue_updated_at": "2026-01-01T00:00:00Z"
  },
  "message": "Please review the printed label. This result identifies a catalogue record; it is not medical advice."
}
~~~

### 10.4 API standards

- Version every public endpoint.
- Validate image MIME type, file size, and image dimensions.
- Use request IDs and idempotency keys for upload/processing retries.
- Return stable error codes.
- Paginate unresolved candidates if required.
- Use short-lived upload tokens where appropriate.
- Support cancellation and timeouts.
- Never include API secrets in client-visible responses.
- Do not log raw images or personal data by default.

## 11. React Native / Expo SDK and reference integration

The primary mobile integration target is React Native, with an Expo-compatible reference implementation.

### 11.1 SDK responsibilities

The SDK handles:

- Opening the scanner.
- Camera permission flow.
- Guided capture screens.
- Capture preview and retake.
- Upload progress.
- API calls.
- Cancellation and retry.
- Returning structured identity results to the host app.

The SDK does not own the buyer's login, customer accounts, medicine catalogue, payments, or order flow.

### 11.2 Host-app interface

A host app should be able to configure:

- API base URL.
- Its own app/user access token.
- Maximum image size.
- Enabled capture stages.
- Gallery access on/off.
- Buyer-configured privacy text.
- Whether the host displays all extraction details or only the resolved identity.

The host receives typed events such as scan started, capture required, processing, completed, uncertain, cancelled, and failed.

### 11.3 Web SDK

A Web SDK can be a later milestone. The REST API remains platform-neutral from the first release, so a web app can integrate directly even before a polished web scanner package exists.

## 12. Configuration and secrets

Every buyer installation uses its own configuration.

Provide an environment template with placeholders only:

- API host/port.
- Buyer-owned catalogue connection details.
- AI provider selection.
- Buyer-owned AI API key.
- OCR provider selection.
- Upload size limit.
- Image retention mode.
- Temporary-storage directory.
- Log level.
- Allowed application origins.
- Authentication mode.

Never commit actual API keys, passwords, database URLs, private certificates, or real customer catalogue data to GitHub. Include local environment files in the ignore list.

## 13. Storage, privacy, and security

### 13.1 Data minimisation

- Process images in memory where practical.
- If temporary disk storage is required, use a customer-controlled temporary directory.
- Delete temporary captures after processing by default.
- Allow the buyer to configure a short retention period where needed.
- Do not persist patient names, phone numbers, prescriptions, or other personal fields unless the buyer has a documented need and lawful basis.
- Do not send data to our own analytics endpoint.
- Do not train a shared model on buyer images or catalogues.

### 13.2 Security controls

- HTTPS in production.
- API authentication and scoped credentials.
- Read-only catalogue credentials.
- Secret management through customer infrastructure.
- Upload limits and MIME/type validation.
- Rate limiting.
- Dependency and container scanning.
- Input validation and output encoding.
- Restricted CORS origins.
- No arbitrary SQL from model output.
- Redacted logs.
- Documented update process.

### 13.3 Data ownership

The buyer remains responsible for the catalogue and end-user data it connects. The software must document what is processed locally and what may be sent to a buyer-selected external AI/OCR provider.

The buyer must configure notices, permissions, and retention appropriate to its use case. Privacy and health-data obligations must be assessed for the actual deployment and law then in force.

## 14. Operational configuration panel

A small admin panel is included so a buyer does not have to edit code for ordinary settings.

Pages:

1. **System status:** API, OCR, AI provider, catalogue connector status.
2. **AI/OCR setup:** provider, model, credential status; never reveal the full secret.
3. **Catalogue mapping:** map buyer fields to canonical fields.
4. **Scanner settings:** capture steps, upload limits, image retention.
5. **Security:** allowed origins, authentication mode, rate limits.
6. **Diagnostics:** redacted recent errors and connector test results.
7. **API documentation:** link to generated OpenAPI/Swagger page.

The panel is for configuration, not for editing the buyer's catalogue.

## 15. Installation and delivery package

Target a delivery that a buyer's technical team can install independently.

Expected package structure:

~~~text
medicine-intelligence/
  backend/
  scanner-sdk/
  sample-app/
  admin-panel/
  adapters/
  deployment/
    docker-compose.yml
    Dockerfile
    healthcheck/
  docs/
    INSTALLATION.md
    CONFIGURATION.md
    API_REFERENCE.md
    CATALOGUE_ADAPTER.md
    SCANNER_UX.md
    SECURITY.md
    TROUBLESHOOTING.md
    UPGRADE_GUIDE.md
  tests/
  .env.example
  .gitignore
  README.md
  PROJECT_PLAN.md
~~~

The package must support:

- Local developer setup.
- Buyer staging installation.
- Buyer production installation.
- Configuration validation.
- Health/readiness checks.
- Backup/restore instructions for customer-owned configuration and operational data.
- Versioned upgrade notes.

A buyer should be able to run the system without signing into an account owned by the original developer.

## 16. Testing and acceptance criteria

### 16.1 Scanner tests

Test across:

- Clear front label.
- Small printed text.
- Curved or wrinkled packaging.
- Reflective foil.
- Low light.
- Excessive glare.
- Motion blur.
- Partial crop.
- Rotated images.
- Multiple captures with repeated or conflicting text.

Acceptance: the scanner asks for a targeted retry when essential information is unreadable. It must not mark a scan as fully identified when required fields are missing.

### 16.2 OCR and extraction tests

- OCR text is traceable to an image capture.
- Each extracted field has a confidence/status.
- Conflicts between captures are surfaced.
- Missing information remains missing.
- The parser rejects malformed provider output.
- Provider failure does not crash the whole API.

### 16.3 Catalogue adapter tests

- Read-only access works.
- Mapping errors are clear.
- Missing product identity fields are reported.
- SQL parameters are bound safely.
- Connector timeout is handled.
- No catalogue record is silently modified.

### 16.4 Identity-resolution tests

- Exact product identity is separated from mere text similarity.
- Similar composition text alone does not identify a different product.
- Important field conflicts are visible.
- Missing fields produce an uncertainty result.
- The system never produces “safe substitute” or “take this instead”.
- Results are reproducible for the same extracted fields and catalogue snapshot.

### 16.5 Security tests

- Invalid tokens are rejected.
- Oversized and malformed uploads are rejected.
- Secrets are redacted from logs.
- Cross-origin access is restricted.
- Temporary image deletion follows configured policy.
- The system runs with least-privilege catalogue access.

### 16.6 Release gate

Do not market the software as reliable based only on a few successful demonstrations. Before a production sale, measure field-level OCR/extraction performance on a legally obtained, representative test set, document known limitations, and obtain appropriate domain and regulatory review.

## 17. Development roadmap

Build in small, testable phases. Do not start every module simultaneously.

### Phase 0 — Specification and interface contracts

- Freeze the product boundary.
- Define scan state machine.
- Define canonical extraction schema.
- Define catalogue adapter contract.
- Define API request/response schemas.
- Design camera screens and error states.
- Create a risk register and test strategy.

**Exit:** all interfaces and acceptance tests are documented.

### Phase 1 — Scanner prototype

- Expo/React Native sample app.
- Camera permission and capture.
- Front photo and printed-details close-up steps.
- Preview, retake, torch, focus, and upload state.
- Guided retry UI.
- Mock API response.

**Exit:** a user can complete the guided scan without a real AI provider.

### Phase 2 — Image quality and OCR

- Image validation and quality assessment.
- Pre-processing pipeline.
- Local/mock OCR adapter.
- Field extraction schema.
- Capture-to-field traceability.
- Uncertainty and retry behaviour.

**Exit:** poor images are detected and missing text is not fabricated.

### Phase 3 — Buyer catalogue adapter

- Canonical product model.
- REST adapter first.
- Read-only SQL adapter after REST contract is stable.
- Field mapping configuration.
- Test fixture catalogue.
- Connector health checks.

**Exit:** a buyer can connect its own catalogue without importing it into our database.

### Phase 4 — Exact-product identity resolver

- Name and identifier normalisation.
- Barcode and catalogue-code resolution.
- Printed-label identity evidence.
- Uncertainty and ambiguity handling.
- Explainability payload.
- Tests for conflicts and missing data.

**Exit:** the same input and same catalogue data produce reproducible product-identity results.

### Phase 5 — AI provider integration

- Provider interface.
- One buyer-configured vision provider.
- Key validation.
- Timeout, retry, and error handling.
- Prompt/schema versioning.
- Provider usage reporting where available.

**Exit:** buyer credentials are used from the buyer's deployment; no developer-owned key is needed.

### Phase 6 — Admin panel and packaging

- Configuration UI.
- Docker Compose.
- Health/readiness checks.
- Installation guide.
- Environment template.
- Logging and retention controls.
- Sample integration app.

**Exit:** a clean environment can install and run the complete system from the documentation.

### Phase 7 — Validation and sale-ready release

- End-to-end tests.
- Security review.
- Performance tests.
- Representative image test set.
- External domain review.
- Regulatory assessment for intended purpose and claims.
- Build a versioned release package.

**Exit:** documented, repeatable installation and tested feature boundaries.

## 18. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Buyer catalogue has incomplete data | Return missing-data status; do not invent records |
| Each buyer uses a different schema | Adapter contract and mapping UI |
| Poor or wrinkled photos | Guided multi-photo capture and targeted retries |
| OCR and AI disagree | Preserve source text and request review |
| AI provider price changes | Buyer-owned provider account and pluggable adapters |
| AI provider becomes unavailable | Graceful error and local OCR fallback where configured |
| Similar-looking products are confused | Exact identity evidence, ambiguity state, and human review |
| Data leakage | Self-hosted deployment, no central service, read-only credentials, minimal retention |
| One buyer requests custom changes | Keep customer-specific code out of core; use adapters/configuration |
| A buyer requests exclusive rights | Separate negotiation; do not accidentally assign all IP in a standard sale |

## 19. Regulatory and professional review gate

The intended purpose and marketing claims matter. Software intended for a medical purpose may fall within India's Medical Devices Rules framework. CDSCO currently lists a 2026 guidance document on Medical Device Software under MDR-2017. Before production release or making claims that the product supports treatment decisions, obtain qualified regulatory advice on whether the intended features and claims trigger medical-device requirements.

The initial product description should remain limited to image reading and exact product identification from the buyer's catalogue. This does not remove the need for review; actual classification depends on final intended purpose and functionality.

Official references to check during implementation and release:

- CDSCO, Guidance document on Medical Device Software under MDR-2017: https://www.cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/Guidance-document-on-Medical-Device-Software-under-MDR-2017.pdf
- CDSCO, Medical Device & Diagnostics portal: https://www.cdsco.gov.in/opencms/opencms/en/Medical-Device-Diagnostics/Medical-Device-Diagnostics/
- CDSCO, Medical Devices Rules page: https://cdsco.gov.in/opencms/opencms/en/Acts-and-rules/Medical-Devices-Rules

The buyer must also review applicable privacy, consumer, pharmacy, advertising, and data-protection obligations for its own deployment. India's DPDP Act and Rules have a phased commencement timeline; confirm the provisions in force at the time of deployment rather than assuming every provision commenced on the notification date. Official Gazette reference: https://egazette.gov.in/WriteReadData/2025/267647.pdf

This section is an engineering planning note, not legal or medical advice.

## 20. Definition of done

The product is ready for a first controlled buyer evaluation only when all of the following are true:

- The scanner opens through the SDK/sample integration.
- Guided front and printed-details captures work.
- Quality checks detect common capture problems.
- A retry request names the problem and the next action.
- OCR/extraction output is structured and traceable.
- AI output is validated and cannot silently fill missing fields.
- The buyer's catalogue is accessed through a documented adapter.
- No central medicine database is required.
- Exact identity results explain supporting and missing fields.
- The product never presents a different medicine as a clinically safe replacement.
- Buyer-owned AI credentials and infrastructure are used.
- Images and logs follow customer-configured retention.
- Docker installation and health checks work from a clean environment.
- Tests and documentation are included.
- No secrets or real patient data are committed to the repository.

## 21. Decisions locked for this planning baseline

| Decision | Baseline |
|---|---|
| Product type | Self-hosted B2B software |
| Sales model | Reusable, non-exclusive software licence; multiple buyers |
| Central developer-operated API | No |
| Shared medicine database | No |
| Buyer catalogue | Source of truth |
| Database integration | REST adapter first; read-only SQL adapter later |
| AI account and charges | Buyer-owned |
| Hosting and storage charges | Buyer-owned |
| Camera experience | Guided multi-photo scanner |
| Mobile integration | React Native / Expo first |
| Public API | Versioned REST API |
| Identity logic | Deterministic and explainable |
| Cross-product substitute search | Not part of this first product |
| Clinical decision | Never automated by this product |
| Licence activation server | Not required in first release |
| Implementation status | Planning only; coding starts after plan review |

---

## 22. First implementation task list

When implementation is authorised, begin in this order:

1. Create repository documentation and architecture decisions.
2. Define the canonical scan and catalogue data contracts.
3. Build API skeleton, health endpoint, and mock provider.
4. Build the React Native/Expo scanner sample with the exact screens described above.
5. Add image-quality checks and targeted retry.
6. Add OCR and structured extraction.
7. Add the buyer catalogue adapter and test fixture.
8. Add exact-product identity resolution and explainability.
9. Add the buyer configuration panel.
10. Package with Docker, tests, and installation documentation.

Do not start with a central catalogue, subscription billing, user accounts, or a cloud service operated by the original developer.

**Core product promise:** a buyer receives a complete, self-hosted scanner and exact-product identity engine that can be integrated into its own app, connected to its own catalogue, and operated using its own infrastructure and provider accounts.
