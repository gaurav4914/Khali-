# Medicine Photo Intelligence Engine — Master Project Plan

> Document: Product requirements, scanner UX, technical architecture, API contracts, deployment model, safety boundaries, and implementation roadmap  
> Version: 1.3  
> Status: Canonical master plan — the original planning file is preserved and all approved requirement changes are merged here; implementation foundation exists  
> Repository: gaurav4914/Khali-  
> Product model: Self-hosted B2B software, licensed repeatedly to multiple buyers  
> Core principle: Build once. Package once. Each buyer installs and operates its own copy.  
> Planning rule: This is the original master planning file from the repository's initial commit and the single source of truth. Merge future requirement changes here; do not create a duplicate or replacement plan.

---

## 1. Executive summary

We will develop a reusable software product that pharmacy, medicine-commerce, and healthcare application companies can integrate into their existing mobile or web applications.

We are **not** building a consumer medicine app, online pharmacy, or shared medicine database. Our product is a self-hosted software engine made up of:

- A guided camera-scanning experience that can be embedded in another app.
- Image quality checks and targeted multi-photo capture.
- OCR and optional AI-assisted reading of printed medicine-pack information.
- Structured extraction of product name, printed composition text, strength text, form text, manufacturer text, and other visible label fields.
- A configurable, read-only connector that queries the buyer's own authorised product catalogue.
- An exact-product identity resolver for the photographed pack.
- A separate composition-group discovery engine that finds every catalogue record whose structured active-ingredient set and strength match the photographed label, including a reference brand and other brands when those records exist in the buyer's catalogue.
- REST APIs, a React Native/Expo scanner SDK, a sample integration app, and deployment tools.
- Complete source code and documentation so the buyer can host the product in its own cloud or on-premises environment.

Each buyer runs an independent copy. The buyer supplies its own server, catalogue access, AI-provider credentials, storage policy, and any paid OCR/AI services. The product must not depend on our permanent cloud account, central API, shared medicine database, or recurring service operated by us.

### Safety boundary for the first product

The product has two distinct, non-clinical catalogue functions:

1. **Exact product identification:** identify the specific pack shown in the photograph.
2. **Composition-group discovery:** read the active-ingredient composition and strengths printed on the photographed pack, then return catalogue records whose structured active-ingredient set and strengths match exactly. This can include a reference/recognised brand and one or more other brands, but only if those records actually exist in the buyer's authorised catalogue.

The second result is a **catalogue composition match**, not a declaration of clinical interchangeability and not an instruction to replace, start, stop, or change treatment. Show the exact fields compared, any dosage-form/release/route differences, missing data, and a visible professional-review notice. Do not use words such as safe substitute, take this instead, or equivalent treatment.

## 2. Product goals

### 2.1 Main goals

1. Make the scanner easy to embed in an existing Android/iOS app.
2. Read medicine-pack text reliably, including small, curved, reflective, folded, or wrinkled packaging.
3. Ask for another targeted photo when the first image is not readable enough.
4. Convert OCR/vision output into structured, traceable fields.
5. Resolve the exact photographed product against only the buyer's authorised catalogue.
6. Extract a structured list of active ingredients and per-ingredient strengths, then query the buyer's catalogue for all exact composition-group records.
7. Keep exact product identity, composition similarity, and clinical decisions as separate concepts.
8. Support different buyer databases through adapters rather than assuming one database schema.
9. Deliver the complete system as a self-hosted package that can be sold to multiple buyers.
10. Minimise operational work for the original developer after delivery.

### 2.2 Non-goals

The first release will not:

- Sell, dispense, or order medicines.
- Operate a consumer-facing marketplace.
- Maintain a shared global medicine database.
- Scrape another application's private database.
- Give diagnosis, dosage, treatment, prescription, or medicine-switching advice.
- Give patient-specific treatment recommendations or tell a person to switch products.
- Declare two different products clinically interchangeable.
- Treat a partial, fuzzy, or incomplete composition match as an exact composition match.
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
9. **Exact Product Identity Resolver:** determines whether the photographed pack maps to one specific catalogue record.
10. **Composition Parser and Group Finder:** builds an ingredient/strength signature and retrieves all buyer-catalogue records with the same exact active-composition signature.
11. **Result Formatter:** returns exact identity and composition-group results as separate groups, with matched, different, and missing fields.
12. **Configuration Panel:** lets the buyer configure providers, catalogue field mappings, retention, and scan limits.
13. **Audit/Operations Module:** customer-controlled technical logs and optional review events.

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

- Show a progress sequence: checking image quality → reading visible text → identifying the photographed pack → searching the buyer's catalogue for exact recorded-composition matches.
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

**Our exact identity resolver:** uses the extracted product identity to retrieve the photographed product record.

**Our composition-group finder:** uses the structured active-ingredient and strength list to retrieve all buyer-catalogue records with the same exact composition signature.

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

The structured output must include a component array for combination products. A single composition string is not sufficient for deterministic matching.

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
    "value": "Ingredient A 500 mg + Ingredient B 10 mg",
    "confidence": 0.84,
    "source_capture_id": "capture_124",
    "source_text": "Ingredient A 500 mg + Ingredient B 10 mg"
  },
  "composition_components": [
    {
      "ingredient_name": "Ingredient A",
      "ingredient_role": "active",
      "strength_value": "500",
      "strength_unit": "mg",
      "confidence": 0.84,
      "source_capture_ids": ["capture_124"]
    },
    {
      "ingredient_name": "Ingredient B",
      "ingredient_role": "active",
      "strength_value": "10",
      "strength_unit": "mg",
      "confidence": 0.84,
      "source_capture_ids": ["capture_124"]
    }
  ],
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
- Extract all active-ingredient names/codes and each ingredient's own strength/unit; do not merge combination products into one unstructured string.
- Treat an ingredient as active only when the buyer catalogue or a reviewed extraction rule explicitly marks that role; unknown role is not treated as active.
- Do not silently merge ingredient synonyms, salt forms, or chemical forms unless the buyer provides an approved canonical ingredient identifier.
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
- Printed composition text.
- Structured composition components with buyer-owned canonical ingredient key/name, ingredient role, per-ingredient strength value and unit.
- Strength text for display.
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
- Search by an exact active-composition signature and return all matching catalogue records, not only the first result.
- Return buyer-supplied reference-brand / other-brand classification where available.
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

Do not treat a shared composition string as proof that two different records are the same exact product. Exact product identity and composition-group discovery are separate operations. The composition-group finder may return different brand records with an exactly matching structured active composition, but its output is only a catalogue match and is not a clinical substitution decision.

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

The UI must not convert identity or composition confidence into a treatment recommendation.

### 9.6 Composition-group discovery (required product feature)

This is a separate query from exact product identity:

1. Read all active-ingredient components on the photographed pack.
2. For each component, preserve its printed name, amount, unit, capture ID, and confidence.
3. Normalize only safe formatting differences (case, Unicode, whitespace, punctuation, and explicitly supported unit aliases). Do not silently merge ingredient synonyms, salt forms, or different chemical forms unless the buyer provides an approved canonical ingredient identifier.
4. Build a deterministic signature from the complete set of active ingredient identifiers and per-ingredient strengths, sorted independent of order.
5. Query the buyer's catalogue for the signature and verify returned records locally.
6. Return every record that passes the exact structured check, subject to pagination and configured result limits.
7. If the buyer marks a record as a reference brand, show that label. Show other brand names only from buyer-supplied metadata; never infer brand status from popularity.
8. Show dosage form, release type, route, and other relevant differences explicitly. These attributes do not disappear merely because the active-ingredient signature matches.
9. If any ingredient or strength is uncertain, incomplete, or unparsed, do not claim an exact composition match. Return composition could not be compared or review required.

Required catalogue component fields:
- ingredient_key (preferred stable buyer-owned canonical ID; otherwise a strict normalised literal name)
- ingredient_name
- ingredient_role (active, inactive, or unknown)
- strength_value
- strength_unit

The engine compares the full set of active components only. If the catalogue has no reliable ingredient role or strength for an expected component, that record cannot be labelled an exact composition match. Excipients may be displayed as label data but are not silently mixed into the active-composition signature.

Composition match result labels:
- **Exact recorded composition match:** all active ingredient keys/names and per-ingredient strengths match.
- **Composition match — formulation details differ:** active composition matches, but dosage form, release type, or route differs; show the difference prominently.
- **Not an exact composition match:** one or more active ingredients or strengths differ.
- **Unable to compare composition:** data is missing, unparseable, or uncertain.

No match class is a medical approval or an instruction to change treatment.

## 10. API design

Use versioned REST endpoints. Publish an OpenAPI document and stable request/response schemas.

### 10.1 Core endpoints

- POST /v1/scans — create a scan session.
- POST /v1/scans/{scan_id}/captures — upload an image capture.
- POST /v1/scans/{scan_id}/quality-check — assess a capture.
- POST /v1/scans/{scan_id}/recognise — run OCR/vision extraction.
- GET /v1/scans/{scan_id} — retrieve scan state.
- POST /v1/catalogue/resolve — resolve the exact photographed product against the buyer's catalogue.
- POST /v1/catalogue/composition-matches — return all buyer-catalogue records with an exact structured active-composition signature.
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

### 10.4 Composition-group request/response contract

Request:

~~~json
{
  "scan_id": "scan_123",
  "page": 1,
  "page_size": 50
}
~~~

The engine sends the buyer catalogue a read-only search request containing the complete extracted active-component list, each component's strict ingredient name/key, strength value, and unit. The buyer API must return all matching records in that page, with structured components and buyer-supplied brand-category metadata.

Response groups are separate from exact product identity:
- exact recorded composition match;
- composition match where a known dosage-form/release/route difference is present;
- no exact recorded composition match;
- unable to compare due to incomplete or uncertain source data.

The API response includes matched components, differences, missing fields, source update timestamp, and a professional-review notice. The result count is for the returned and locally verified page; clients request subsequent pages when needed.

### 10.5 API standards

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
- Similar composition text alone does not identify a different exact product.
- An exact active-composition group returns all matching buyer-catalogue records, including multiple brands when present.
- Ingredient order does not affect the composition signature.
- Missing ingredient strengths, unknown ingredient roles, salt-form ambiguity, and uncertain OCR do not produce an exact match.
- Dosage-form, release-type, or route differences remain visible.
- Composition matches are labelled as catalogue data, not clinical interchangeability.
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

### Phase 4 — Exact-product identity and composition-group engines

- Keep exact product identity resolution separate.
- Add structured multi-component composition extraction.
- Add strict active-ingredient/strength normalisation and deterministic signatures.
- Extend the buyer catalogue adapter to query by composition signature and return all matches.
- Return reference-brand / other-brand metadata only when buyer data supplies it.
- Show dosage-form, release-type, and route differences.
- Add uncertainty handling and explainability.
- Test exact, reordered, missing, mixed, and conflicting components.

**Exit:** exact product identity and composition-group results are reproducible and clearly separated.

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

The initial product description should remain limited to image reading, product identification from the buyer's catalogue, and neutral catalogue composition matching. Do not market a composition match as a clinical substitution recommendation. This does not remove the need for review; actual classification depends on final intended purpose and functionality.

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
- Exact composition-group search returns all records in the buyer catalogue that pass strict active-ingredient and strength comparison.
- Reference-brand and other-brand labels come only from buyer catalogue metadata.
- Dosage form, release type, route, and missing data are always visible.
- The product never presents a composition match as a clinically safe replacement or patient-specific recommendation.
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
| Composition-group discovery | Required; exact structured active-ingredient/strength match across buyer catalogue records |
| Brand grouping | Buyer-provided reference-brand / other-brand metadata only |
| Clinical decision | Never automated; catalogue match is not a prescription or switch instruction |
| Licence activation server | Not required in first release |
| Implementation status | Partial backend/API and composition-group foundation exists; full scanner SDK, production adapters, persistence and sale-ready validation remain |

---

## 22. First implementation task list

When implementation is authorised, begin in this order:

1. Audit the existing repository and reconcile code with this plan before changing files.
2. Fix existing failing tests and implementation/contract mismatches.
3. Finalise canonical scan, per-ingredient strength and buyer-catalogue contracts.
4. Complete conservative OCR composition-component extraction with provenance and uncertainty handling.
5. Complete exact product identity and exact composition-group discovery as separate API operations.
6. Build the Expo guided scanner demo and reusable SDK UI, including adaptive retakes.
7. Add the buyer-configured Vision provider adapter using buyer-owned credentials.
8. Add buyer configuration/admin UI and adapter field mapping.
9. Add customer-managed temporary/persistent session storage options and multi-replica support.
10. Complete Docker deployment, end-to-end tests, security review, documentation and release packaging.

Do not start with a central catalogue, subscription billing, user accounts, or a cloud service operated by the original developer.

**Core product promise:** a buyer receives a complete, self-hosted scanner and exact-product identity engine that can be integrated into its own app, connected to its own catalogue, and operated using its own infrastructure and provider accounts.


---

## 23. Owner's requirement — plain-language product definition

The user is commissioning a **technology product to sell to existing pharmacy/medicine applications**, not a separate consumer app.

A person using a buyer's existing app photographs a medicine pack. Our scanner reads the printed product identity and composition. The engine then queries the buyer's own catalogue and returns:

1. The exact catalogue product shown in the photo, when it can be identified.
2. A separate group containing **all catalogue records with the same complete, structured active-ingredient set and the same per-ingredient strength**, when the buyer's catalogue contains such records.
3. The buyer-provided brand classification for those records (for example, reference brand / other brand), if the buyer maintains that field.
4. Clear differences or missing information (dosage form, release type, route, pack size, manufacturer, etc.).

Example using synthetic names only:

- Scanned label: Ingredient A 500 mg + Ingredient B 10 mg.
- Buyer catalogue record 1: reference brand with the same complete active composition.
- Buyer catalogue record 2: another brand with the same complete active composition.
- Engine result: both catalogue records appear under the same recorded-composition group, separately labelled and with their actual product names.

The engine does not invent a second product if the buyer's catalogue does not contain it. It does not assume there will always be exactly two results. The number of matches is determined by the buyer's catalogue and the exact comparison rules.

A composition match is a catalogue/data match only. It is not a statement that a product is suitable for a particular patient or a direction to switch treatment. This distinction must be visible in API wording and UI copy.

## 24. Scanner UI — implementation-level screen specification

The complete camera experience is a required deliverable, not merely an API client. Build it as an Expo-compatible React Native scanner module and a runnable sample host app.

### 24.1 Screen S0 — scanner entry

- App-bar title: `Scan medicine pack`.
- Short instruction: `Keep the pack inside the frame. We will guide you if another photo is needed.`
- Primary button: `Start scan`.
- Secondary action: `Choose photo` only if the buyer enables gallery import.
- Privacy note must be configurable by the buyer and must say whether image bytes leave the buyer's infrastructure for the selected AI/OCR provider.
- Request camera permission only after a clear user action.
- If permission is denied, explain how to enable it in device settings and allow closing the scanner.

### 24.2 Screen S1 — front photo

- Live preview takes most of the screen.
- Large rounded guide frame, with a pack outline / alignment hint.
- Top: close, progress (for example, `Photo 1 of 2`), help.
- Bottom: torch, capture, gallery (optional), camera switch (when supported).
- Guidance: `Show the full front of the pack.`
- Show a live focus indicator where supported.
- Do not ask the user to photograph every side by default.

### 24.3 Screen S2 — capture review

Display the captured image with one of:
- `Clear enough`
- `Try again — image is blurred`
- `Need a closer photo — text is too small`
- `Move the pack into the frame`
- `Reduce glare by slightly changing the angle`

Actions: `Retake` and `Use photo`. Retake must remove/replace the previous capture rather than accumulating duplicate images.

### 24.4 Screen S3 — targeted composition close-up

Show only when the composition text was not captured clearly in S1 or the OCR result is incomplete.

Guidance: `Bring the printed composition details closer. Keep all lines inside the frame.`

- Focus the guide rectangle on the text area rather than the whole pack.
- Do not require a 3D scan or arbitrary left/right rotations.
- Allow a second close-up only when the first remains unreadable.

### 24.5 Screen S4 — back/side photo

Request only when a missing field could reasonably be printed on another side (for example, manufacturer or additional product identifier). Explain the reason in plain language.

### 24.6 Screen S5 — processing

Show stages:
1. Checking photo quality.
2. Reading printed text.
3. Checking the buyer's catalogue.
4. Preparing the result.

Show progress and a cancel action. Keep the captures available for retry until the scan expires or the user cancels.

### 24.7 Screen S6 — results

Separate the result into two sections:

**A. Exact product identity**
- Exact product record, likely identity requiring review, multiple possible records, no record, or unable to identify.

**B. Same recorded active composition in this catalogue**
- Show every matching buyer-catalogue record returned across pages.
- Show brand label only from buyer metadata.
- Display each record's actual composition components and strengths.
- Display dosage form, release type, route, manufacturer and other known differences.
- If composition cannot be parsed confidently, show `Composition could not be compared`, not a guessed list.

Keep a persistent, readable notice: `Catalogue composition matches are informational. They do not determine whether a medicine is suitable for an individual. Ask a qualified pharmacist or prescriber before making any treatment change.`

Never use `Take this instead`, `Safe substitute`, or a medicine-switch button.

## 25. Composition data model — mandatory precision

A single free-text field such as `Ingredient A 500 mg + Ingredient B 10 mg` is not enough for reliable comparison. Both scanned data and buyer catalogue data need structured component arrays.

Each component must preserve:

- `ingredient_name_printed`: literal label text.
- `ingredient_name_normalised`: conservative normalised name.
- `ingredient_key`: optional buyer-owned canonical identifier.
- `ingredient_role`: `active`, `inactive`, or `unknown`.
- `strength_amount`: decimal string, not a floating-point number.
- `strength_unit`: mg, mcg, g, IU, %, etc.
- `strength_basis_amount`: optional denominator amount (for example 5).
- `strength_basis_unit`: optional denominator unit (for example mL).
- `confidence`: field-level extraction confidence.
- `source_capture_id`: which photo supplied the value.
- `source_text`: OCR text span supporting the value.

Examples of strength expressions that must remain distinct:
- 5 mg per tablet.
- 5 mg per 5 mL.
- 5 mg per mL.
- 5% w/w.
- 500 IU.

The matcher must not compare these as if they were interchangeable quantities. Unit conversion is allowed only when deterministic and the basis is identical or a safe, explicitly implemented conversion is available. IU must not be converted to mass without a substance-specific authoritative conversion table supplied and reviewed by the buyer.

### 25.1 Active/inactive distinction

- Only components reliably marked active are included in the active-composition signature.
- Excipients/inactive ingredients must not be treated as active.
- A generic `Composition` heading alone may be ambiguous. Do not automatically mark every parsed line as active.
- Prefer explicit `Active ingredients` or a clear `Each tablet/capsule/dose contains` context.
- If active/inactive status remains unknown, request a better image or mark the composition uncomparable.

### 25.2 Normalisation rules

Allowed by default:
- Unicode normalisation.
- Case and harmless whitespace/punctuation normalisation.
- Decimal formatting such as `0.5 g` to `500 mg`, where exact deterministic conversion applies.
- Ingredient order independence for combination products.

Not allowed by default:
- Guessing synonyms.
- Merging salt forms or chemical forms.
- Guessing missing strength.
- Treating a partial set as a full match.
- Treating two different release mechanisms as the same formulation.
- Using an AI confidence score as proof of equivalence.

Synonym/canonical ingredient mapping must come from a buyer-approved, versioned mapping table. Record the mapping version in the comparison result.

## 26. Exact composition-group comparison contract

The primary query is not a fuzzy similarity search. It is a complete-set comparison.

1. Build a scan signature from every confirmed active ingredient and its full strength expression.
2. Build a catalogue signature from every active component in each returned catalogue record.
3. Sort components so ingredient order does not matter.
4. Require the same number of active components.
5. Require every ingredient identity/key to match under the approved normalisation/mapping rules.
6. Require the strength amount, unit, and basis to match after allowed deterministic conversions.
7. Reject a record if it has an extra active ingredient or is missing one.
8. Keep inactive ingredients outside the active signature.
9. Verify every catalogue result again inside our engine, even if the buyer API claims to filter correctly.
10. Return every verified match across pages, not just the first result.

Dosage form, release type, and route must be separately compared and shown. If the active-component signature matches but one of these attributes differs, place the record in a clearly labelled `composition match — formulation details differ` subgroup. Do not hide the difference or merge it into the exact-formulation subgroup.

The engine must return:
- `matches_found`
- `no_matches`
- `unable_to_compare`
- `catalogue_unavailable` (API error)

A low-confidence or incomplete scan must never be converted into a confident no-match result. It is `unable_to_compare`.

## 27. Buyer catalogue adapter — complete integration rules

### 27.1 Preferred first integration

Implement the buyer-provided REST API adapter first. It is safer and easier to sell than asking every buyer to expose its database credentials.

The buyer API should provide:
- Exact product lookup by barcode or identifier.
- Exact product lookup by printed-name candidates.
- Structured composition search with pagination.
- Full product detail lookup.
- Read-only access to brand classification and display metadata.

### 27.2 SQL integration

A direct SQL adapter is a later optional module:
- Read-only database user.
- Buyer-approved view/schema mapping.
- Parameterised queries only.
- No arbitrary SQL generated from OCR or AI text.
- Connection secrets remain in buyer infrastructure.
- No writes or migrations against the buyer database.

### 27.3 Pagination

The buyer adapter must return:
- Current page records.
- `page`, `page_size`.
- `has_more` or a `next_cursor` supplied by the buyer API.

Do not slice the same page twice. The matcher verifies the records returned for that page and returns a page-scoped result count. The SDK must expose page continuation clearly.

### 27.4 Catalogue record minimum

A composition-search record needs:
- `product_id`.
- `display_name`.
- `brand_name` (nullable).
- `brand_category` (`reference`, `other`, `unknown`).
- `composition_components[]` with complete active component data.
- Dosage form.
- Release type.
- Route.
- Manufacturer.
- Product status/update timestamp.

If a buyer only has a free-text composition string, provide a buyer-side mapping/normalisation process or return `unable_to_compare`. Never guess missing component data.

## 28. Public API contract — version 1

All request and response schemas must be published in the generated OpenAPI document. The following endpoint names are the baseline:

- `POST /v1/scans`
- `POST /v1/scans/{scan_id}/captures`
- `DELETE /v1/scans/{scan_id}/captures/{capture_id}`
- `POST /v1/scans/{scan_id}/quality-check`
- `POST /v1/scans/{scan_id}/recognise`
- `GET /v1/scans/{scan_id}`
- `POST /v1/catalogue/resolve`
- `POST /v1/catalogue/composition-matches`
- `GET /v1/catalogue/products/{product_id}`
- `GET /v1/health`
- `GET /v1/ready`

The composition-matches response must include:
- scan ID and request ID.
- scan composition parse status.
- match status.
- page/page_size/has_more or next cursor.
- page-scoped number of verified results.
- separate exact active-composition group and formulation-difference group.
- complete product catalogue records as buyer permitted.
- matched component list.
- different/missing fields.
- mapping/normalisation version.
- professional-review notice.

No permanent server API key may be shipped in a mobile binary. The buyer's backend should call the self-hosted engine or issue narrowly scoped short-lived tokens.

## 29. AI and OCR provider policy

- Local Tesseract is the baseline provider and must work without internet.
- Optional Gemini Vision adapter is configurable through environment settings and buyer-owned API credentials.
- Additional providers may be plugged in behind the same interface.
- Never hard-code a personal developer API key.
- Never commit buyer keys to Git.
- Model output must be schema-validated.
- Request literal visible text, not invented completions.
- Keep OCR output and AI output separate with provenance.
- If they disagree on ingredient name, strength, unit, or basis, flag conflict and request a targeted retake or human review.
- Model failure must not break local OCR or delete the captured image.
- Show the buyer whether image bytes are sent to an external provider.

## 30. Storage and buyer-owned runtime

The product has no shared medicine catalogue and no central developer-operated production API.

A buyer installation may still need temporary scan-session state and temporary image files. These are buyer-owned runtime data, not our medicine database.

- Current in-memory ScanStore is one process only.
- Add a storage interface so the buyer can choose local ephemeral storage or its own Redis/PostgreSQL/object storage for multi-replica deployments.
- Default image retention should be short and configurable.
- Delete rejected captures, expired scans, and temporary files.
- Do not save customer catalogue rows permanently.
- Caching is opt-in, buyer-controlled, short-lived, and invalidatable.
- Do not send analytics, images, or catalogue information to the original developer.

## 31. Commercial delivery and repeatable licensing

Deliver one product package that can be sold repeatedly under a non-exclusive agreement.

Each buyer gets:
- Backend source and build artefacts.
- Scanner SDK and demo app.
- API/OpenAPI documentation.
- Docker deployment bundle.
- Buyer adapter contract.
- Environment template.
- Test suite and synthetic sample data.
- Installation and upgrade manuals.
- Software licence document/template.

The buyer pays for its own hosting, storage, database access, AI/OCR provider usage, and operation. We do not need a central billing server, subscription backend, or activation server in the first edition.

Do not promise lifetime free upgrades or indefinite support unless that is explicitly agreed in the buyer's sale terms. The developer retains the right to sell the same non-exclusive product to other buyers unless a separately negotiated exclusive assignment is made.

## 32. Existing repository audit — baseline for the next developer

The following files already exist and must be reviewed before changes:

- `backend/app/main.py`: FastAPI endpoints and dependency wiring.
- `backend/app/schemas.py`: scan, capture, catalogue and result data contracts.
- `backend/app/extraction.py`: OCR text and early multi-component parsing.
- `backend/app/composition.py`: strict structured composition-group matching.
- `backend/app/catalogue.py`: buyer read-only REST adapter.
- `backend/app/identity.py`: exact photographed-product identity.
- `backend/app/quality.py` and `preprocess.py`: initial image checks/pre-processing.
- `backend/app/ocr.py`: OCR abstraction and Tesseract/mock implementation.
- `backend/app/store.py`: temporary in-memory scan session store.
- `sdk/react-native/src/client.ts` and `types.ts`: typed API client.
- `tests/`: initial API, identity, composition, extraction, quality, and preprocessing tests.
- `docs/` and `README.md`: installation, API, integration and operational notes.

### 32.1 Known gaps to verify/fix

- Full React Native/Expo guided camera screens are not complete; the current package is primarily a typed API client.
- OCR component extraction is deliberately conservative and supports only a subset of label layouts. It needs tests for multi-line layouts, ingredient lists, strength bases, Hindi/English and mixed scripts.
- Current composition schema must be extended for strength basis (for example, per tablet vs per 5 mL) before exact production comparisons.
- The first REST adapter expects a buyer-specific `/products/search-by-composition` contract; document it and provide a mock buyer catalogue service for integration testing.
- In-memory scan sessions do not support multiple replicas or durable restart recovery.
- API-key-only auth is adequate for an initial trusted server-to-server integration, but a production mobile integration must not embed a permanent key in the app.
- External production AI Vision adapter, configuration/admin UI, field mapping, and customer-managed storage are incomplete.
- Verify all latest CI runs. Earlier CI history contains a failure caused by a test expecting `total_matches` after the response field had been changed to `matches_in_page`; confirm that this mismatch is fixed and the latest tests are green.
- Review pagination end-to-end. The buyer adapter applies pagination, so the local matcher must not slice the same page again.
- Validate composition extraction cannot mark inactive ingredients as active when the label heading is ambiguous.
- Ensure a missing dosage-form/release/route field is represented as missing, not assumed equal.

Do not claim the product is production-ready just because the basic unit tests pass.

### 32.2 Implementation and audit update (v0.3.0)

- **Structured Composition Contract (`schemas.py`, `sdk/react-native/src/types.ts`, `src/engine/composition.ts`):** Extended `CompositionComponent` with `ingredient_name_printed`, `ingredient_name_normalised`, `strength_amount`, `strength_basis_amount`, `strength_basis_unit`, `source_capture_id`, and `provenance`. Distinctly separates `per tablet`, `per 5 mL`, `per mL`, `% w/w`, and `IU` (never converting `IU` or `%` to mass).
- **Exact Composition-Group Matcher (`composition.py`, `src/engine/composition.ts`):** Full-set active component comparison, order-independent sorting, excipient exclusion, explicit formulation comparison labels (`same active composition; formulation details match`, `same active composition; dosage form differs`, `same active composition; release type differs`, `same active composition; route differs`), separate `exact_matches` and `formulation_difference_matches` lists, `has_more`/`next_cursor` pagination without double-slicing, and mandatory `informational_notice`.
- **Multi-Line & Hindi/English Extraction (`extraction.py`, `src/engine/extraction.ts`):** Added `Each 5 ml contains` / `Each tablet contains` / `प्रत्येक टैबलेट में` basis inheritance, pharmacopoeia suffix stripping (`IP`/`BP`/`USP`), dosage form/release/route parsing, excipient stop boundaries (`Excipients`/`सहायक घटक`), and cross-capture conflict detection.
- **Buyer-Configured Vision Provider (`backend/app/providers/vision.py`, `server.ts`):** Added `GeminiVisionProvider` using buyer-supplied `GEMINI_API_KEY` and configurable model (`gemini-3.8-flash`) with automatic fallback to local OCR when disabled or unavailable.
- **Synthetic Buyer Catalogue & Guided Scanner Reference UI (`server.ts`, `src/App.tsx`, `sdk/react-native/src/scanner.ts`):** Implemented the runnable full-stack engine on port 3000 with Guided Scanner Screens S0–S6, adaptive retake/close-up routing, capture deletion on retake (`DELETE /v1/scans/{scan_id}/captures/{capture_id}`), synthetic buyer REST catalogue service (`/v1/buyer-mock/*`), and Buyer Operational Configuration Panel (`/v1/admin/config`).

## 33. Implementation sequence for the next AI coding session

1. Read this entire `PROJECT_PLAN.md`. It is the single master requirements and planning document. Then read `README.md` and the technical guides under `docs/`.
2. Inspect every source file, tests, dependency file, workflow and current Git history.
3. Run the existing test and lint commands and record the actual baseline.
4. Fix any current failing tests and contract mismatches before adding features.
5. Finalise the structured component schema, including strength basis and source provenance.
6. Add comprehensive unit tests for exact composition signature creation, units, bases, ingredient order, partial mismatch, extra active component, unknown role, salt/chemical form, low confidence, and missing catalogue data.
7. Complete the buyer REST adapter contract and end-to-end mock catalogue service.
8. Complete the composition-group API response and pagination contract.
9. Build the Expo sample host app and guided scanner screens.
10. Add capture quality scoring and adaptive retake behaviour.
11. Complete OCR/pre-processing and buyer-configured Vision provider integration.
12. Add secure configuration/admin panel and customer-owned storage options.
13. Run CI, security checks, packaging and clean-install validation.
14. Update `README.md` and the relevant technical guides under `docs/`. Keep all product requirements and planning decisions in this `PROJECT_PLAN.md`; do not create another master-plan or handoff file.
15. Provide a truthful completion report listing what passed, what remains and any unverified production assumptions.

The next AI should implement real code, not merely rewrite plans or produce snippets, and should make small, reviewable commits.
