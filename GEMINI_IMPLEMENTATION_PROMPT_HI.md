# Gemini के लिए पूरा Development Handoff Prompt (Hindi)

इस फाइल को पूरा पढ़कर ही काम शुरू करो। GitHub repository `gaurav4914/Khali-` की `main` branch पर काम करना है।

## भूमिका और लक्ष्य

तुम Senior Software Architect, Backend Engineer, React Native/Expo Engineer, QA Engineer और DevOps Engineer की संयुक्त जिम्मेदारी निभा रहे हो। केवल सलाह, snippets या नया plan मत देना। मौजूदा repository का code समझकर उसी project को पूरा करो, वास्तविक files में implementation करो, tests चलाओ और failures ठीक करो।

**Product:** Medicine Photo Intelligence Engine  
**Repository:** `https://github.com/gaurav4914/Khali-`  
**Master specification:** `PROJECT_PLAN.md` (इसे पूरा पढ़ना अनिवार्य है)  
**Product model:** Self-hosted B2B software; एक बार विकसित करके कई buyers को non-exclusive तरीके से दिया जा सके।

## 1. सबसे महत्वपूर्ण निर्देश

1. सबसे पहले `PROJECT_PLAN.md` को शुरू से अंत तक पढ़ो। यही एकमात्र master plan और requirements source है। कोई दूसरी master planning या handoff file मत बनाना।
2. README और `docs/` की technical guides पढ़ो।
3. Repository tree, Git history, source code, tests, Docker, CI और dependency files का audit करो।
4. मौजूदा code को बचाकर आगे बढ़ो। बिना पढ़े files replace या पूरा project rewrite मत करो।
5. पहले existing test baseline चलाओ, failures दर्ज करो और फिर ठीक करो।
6. कोई API key, secret, patient data या वास्तविक buyer catalogue data commit मत करना।
7. हर चरण के बाद tests चलाओ और छोटे, स्पष्ट commits करो।
8. जो काम वास्तव में पूरा और test नहीं हुआ, उसे complete/production-ready मत बताना।
9. यदि GitHub repository access उपलब्ध न हो तो access होने का झूठा दावा मत करना।

## 2. Product को ठीक से समझो

यह कोई नया consumer medicine app या online pharmacy नहीं है। यह ऐसा reusable software engine है जिसे pharmacy, medicine-commerce या healthcare कंपनियाँ अपने existing mobile app में integrate कर सकें।

हमारा software:
- अपना consumer app या pharmacy business नहीं चलाएगा।
- अपना shared medicine database नहीं रखेगा।
- buyer का database copy करके अपने पास नहीं रखेगा।
- सभी buyers के लिए central developer-operated production API/server नहीं चलाएगा।
- buyer के अपने infrastructure पर install होगा।
- buyer के existing medicine catalogue को authorised read-only API/adapter से query करेगा।
- buyer अपनी hosting, database access, AI/OCR account और usage charges संभालेगा।
- हम source code, scanner SDK, API, deployment package और documentation बेचेंगे।
- एक ही software package कई buyers को non-exclusive रूप से दिया जा सकेगा।

### मुख्य user journey

1. User buyer के existing app में "Scan medicine" camera button दबाता है।
2. हमारा embedded guided scanner खुलता है।
3. User medicine pack की front photo लेता है।
4. यदि composition text छोटा या धुंधला है तो scanner close-up photo माँगता है।
5. जरूरत पड़ने पर back/side photo माँगता है।
6. Quality engine blur, glare, lighting, crop, focus, text size और orientation जाँचता है।
7. OCR तथा buyer-configured Vision provider printed text पढ़ते हैं।
8. Composition को structured ingredient components में बदला जाता है।
9. दो अलग operations चलते हैं:
   - **Exact Product Identity:** फोटो में दिखा वही product buyer catalogue में खोजो।
   - **Composition Group Discovery:** फोटो में मौजूद सभी confirmed active ingredients और उनकी individual strengths का पूरा set buyer catalogue में खोजो।
10. Buyer catalogue में जो records वास्तव में मौजूद हों और strict comparison पास करें, वे दिखें। अनुमान से product न बनाओ।

महत्वपूर्ण: परिणामों को दो products तक सीमित मत करना। Catalogue में जितने verified exact matches हों, pagination के साथ सभी लौटाओ। एक भी exact match न हो तो गलत product दिखाने के बजाय no-match बताओ।

Composition match catalogue-data comparison है, patient-specific medical advice या medicine बदलने की अनुमति नहीं।

## 3. Existing repository audit

पहले इन modules और इनके वास्तविक वर्तमान paths को inspect करो:

- `backend/app/main.py`
- `backend/app/schemas.py`
- `backend/app/extraction.py`
- `backend/app/composition.py`
- `backend/app/catalogue.py`
- `backend/app/identity.py`
- `backend/app/quality.py`
- `backend/app/preprocess.py`
- `backend/app/ocr.py`
- `backend/app/security.py`
- `backend/app/store.py`
- `sdk/react-native/src/client.ts`
- `sdk/react-native/src/types.ts`
- `tests/`
- `.github/workflows/`
- `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `.env.example`
- README और docs

यह सूची प्रारंभिक audit hints है; अगर repository में paths बदले हों तो वास्तविक tree का पालन करो।

Audit में:
- Current main commit और recent history दर्ज करो।
- Existing endpoints और schemas पढ़ो।
- Tests, lint, TypeScript checks और Docker build चलाओ।
- पुराने CI failures और वर्तमान failures अलग-अलग पहचानो।
- Duplicate code, dead code और schema/API mismatches खोजो।
- Audit report `PROJECT_PLAN.md` के implementation/status section में update करो; अलग status/plan Markdown file मत बनाना।

## 4. Structured composition data model

केवल free-text composition string से reliable matching मत बनाओ। हर ingredient component को structured रूप में represent करो:

- `ingredient_name_printed`
- `ingredient_name_normalised`
- `ingredient_key` (केवल buyer-approved canonical mapping हो तो)
- `ingredient_role`: active / inactive / unknown
- `strength_amount`: decimal string
- `strength_unit`
- `strength_basis_amount` (जैसे 5)
- `strength_basis_unit` (जैसे mL)
- `confidence`
- `source_capture_id`
- `source_text`
- extraction/provider provenance

इन उदाहरणों को अलग समझना:
- 5 mg per tablet
- 5 mg per 5 mL
- 5 mg per mL
- 5% w/w
- 500 IU

इनको एक जैसा न मानना। केवल deterministic और स्पष्ट रूप से implemented unit conversions करना। IU को बिना substance-specific approved conversion के mass में convert मत करना।

### Active बनाम inactive

- केवल confirmed active ingredients active signature में आएँ।
- Excipients/inactive ingredients active composition में शामिल न हों।
- Generic "Composition" heading देखकर हर line को active न मानो।
- अगर role अस्पष्ट है तो unknown रखो और exact comparison रोक दो।
- OCR और AI extraction में disagreement हो तो conflict flag करो।

### Normalisation

अनुमत:
- Unicode, case, whitespace और harmless punctuation normalisation।
- Exact deterministic mass conversion, जहाँ basis समान हो।
- Ingredient order independence।

बिना buyer-approved mapping के निषिद्ध:
- अनुमानित synonyms।
- Salt/chemical forms को एक मानना।
- Missing strength guess करना।
- Partial composition को full match बताना।
- अलग release mechanisms को समान बताना।
- AI confidence को equivalence का प्रमाण मानना।

## 5. Core Composition Matching Engine

यह मुख्य business feature है। Existing `composition.py` और संबंधित schemas को पढ़कर मजबूत करो।

1. Scan के confirmed active components का complete signature बनाओ।
2. हर component की identity, amount, unit और strength basis normalise करो।
3. Buyer catalogue record का complete active signature बनाओ।
4. Active component count बराबर होना चाहिए।
5. हर ingredient approved canonical identity या strict normalised identity से match होना चाहिए।
6. हर ingredient की strength और basis match होनी चाहिए।
7. कोई extra या missing active ingredient हो तो exact match reject करो।
8. Ingredient order का असर न हो।
9. Inactive ingredients signature से बाहर रहें।
10. Incomplete/uncertain data पर `unable_to_compare` लौटाओ।
11. Buyer API के हर candidate को local engine से फिर verify करो।
12. सभी verified results pagination के साथ लौटाओ। Buyer page को local matcher दूसरी बार slice न करे।

Dosage form, release type और route को अलग-अलग compare करो। Active composition match होने पर भी इनमें अंतर हो सकता है; उसे छिपाना नहीं। स्पष्ट labels दिखाओ, जैसे:
- same active composition; formulation details match
- same active composition; dosage form differs
- same active composition; release type differs
- same active composition; route differs
- unable to compare

Reference brand / other brand label केवल buyer catalogue metadata से लो। लोकप्रियता, price या AI guess से category मत बनाओ।

कभी भी `safe substitute`, `take this instead`, `clinically equivalent` या patient-specific recommendation न कहो। स्पष्ट notice दिखाओ कि यह catalogue composition information है, clinical approval नहीं।

## 6. OCR और AI Vision

- Local Tesseract OCR baseline हो और internet के बिना काम कर सके।
- OCR provider abstraction बनाए रखो।
- Original image सुरक्षित रखो; processed derivative OCR में उपयोग हो सकती है।
- English, Hindi और mixed-script test cases शामिल करो।
- Gemini Vision adapter configurable बनाओ।
- API key buyer अपने environment में देगा।
- Model ID/config environment से आए; personal API key या fixed model assumption hard-code न करो।
- भविष्य में अन्य providers जोड़ने के लिए common interface रखो।
- AI से केवल visible printed text extract कराओ; missing text invent न करवाओ।
- OCR और AI output अलग provenance के साथ रखो।
- Ingredient/strength/unit/basis में conflict हो तो targeted retake या human review माँगो।
- AI provider unavailable हो तो local OCR और clear error/fallback path काम करे।
- User/buyer को साफ बताओ कि image external AI provider को भेजी जाएगी या नहीं।

## 7. Guided Camera Scanner UI — अनिवार्य

केवल API client बनाकर project complete मत घोषित करना। Expo-compatible React Native scanner UI और runnable sample host app बनाओ। Installed Expo SDK के अनुसार current official Camera API उपयोग करो।

### Screen 1 — Scanner entry
- Title: Scan medicine pack
- छोटा instruction
- Start scan button
- Gallery import केवल buyer enable करे तो
- Buyer-configurable privacy notice

### Screen 2 — Live front camera
- Camera preview
- Centre alignment rectangle / pack guide
- Progress: Photo 1 of 2
- Torch, capture, optional gallery, camera switch
- Autofocus/tap-to-focus जहाँ supported हो
- Prompt: "Show the full front of the pack."

### Screen 3 — Capture review
- Captured image preview
- Clear enough / Try again / Need closer photo
- Retake और Use photo actions
- Retake पुरानी capture को replace/delete करे; duplicate न रखे।

### Screen 4 — Composition close-up
- केवल तब दिखे जब composition unreadable या बहुत छोटी हो।
- Text-area guide frame।
- Prompt: "Bring the composition details closer. Keep all lines inside the frame."

### Screen 5 — Back/side photo
- केवल missing जानकारी के लिए जरूरी होने पर माँगो।
- हर बार सभी sides की photos अनिवार्य मत करो।

### Screen 6 — Processing
Stages:
1. Checking photo quality
2. Reading printed text
3. Identifying product
4. Searching buyer catalogue
5. Preparing results

Progress, cancel, retry और failure states हों।

### Screen 7 — Results
दो अलग sections:
1. Exact Product Identity
2. Same Recorded Active Composition in Buyer's Catalogue

हर verified catalogue result, brand category (buyer metadata से), strengths, dosage form, release type, route और manufacturer जहाँ उपलब्ध हों दिखाओ। Missing data साफ दिखाओ। कोई medicine-switch button या treatment instruction न हो।

### Scanner technical requirements
- Camera permission allow/deny handling
- Autofocus और torch support
- Orientation handling
- Image compression और max upload size
- Loading, retry, offline/network error, cancellation
- Duplicate capture prevention
- Session expiry
- Accessibility labels और readable contrast
- Low-end Android performance
- Gallery import buyer configuration से नियंत्रित

## 8. Image Quality Engine

Blur, glare, exposure, text size, crop, perspective skew, orientation, compression artifacts और dimensions जाँचो।

हर capture का structured quality response:
- status: accepted / retry_recommended / retry_required / unsupported
- issues[]
- recommended_action
- target_region
- width, height
- quality metrics

Synthetic test images से thresholds verify करो। एक अनुमानित score के आधार पर image को निश्चित रूप से readable मत बताओ। Enhancement में crop, rotate, perspective correction, denoise और contrast improvement हो सकती है, लेकिन missing text invent नहीं होना चाहिए। Original image traceable रहे।

## 9. Buyer Catalogue Adapter

हमारा shared medicine database नहीं बनेगा।

पहले buyer-provided read-only REST API adapter implement करो:
- exact product lookup
- barcode lookup
- structured composition search
- product detail lookup
- pagination

Buyer catalogue API संभावित candidates दे; हमारा engine प्रत्येक candidate locally verify करे।

SQL connector optional later module है:
- read-only SQL user
- buyer-approved schema/view mapping
- parameterised queries
- कोई writes/migrations नहीं
- OCR/AI text से arbitrary SQL कभी नहीं

अगर buyer catalogue में composition structured नहीं है, तो buyer-side mapping/normalisation setup आवश्यक बताओ। Free text से blindly exact match मत बनाओ।

## 10. API और SDK

Versioned API contracts और OpenAPI documentation बनाए रखो। Baseline routes:

- POST /v1/scans
- POST /v1/scans/{scan_id}/captures
- DELETE /v1/scans/{scan_id}/captures/{capture_id}
- POST /v1/scans/{scan_id}/quality-check
- POST /v1/scans/{scan_id}/recognise
- GET /v1/scans/{scan_id}
- POST /v1/catalogue/resolve
- POST /v1/catalogue/composition-matches
- GET /v1/catalogue/products/{product_id}
- GET /v1/health
- GET /v1/ready

Composition response में status, verified records, matches_in_page, page/page_size, has_more/next_cursor, matched components, differences/missing fields, mapping version और informational notice शामिल हों।

SDK में typed methods, request/response types और robust error handling हों। API wrapper के साथ scanner UI module और runnable demo app भी बनाओ।

Permanent API key mobile binary में कभी embed न करो। Buyer backend proxy या short-lived scoped token व्यवस्था उपयोग करो।

## 11. Self-hosted packaging और खर्च

हर buyer का अलग installation:
- Backend API
- Scanner SDK
- Buyer catalogue adapter
- Buyer-configured AI/OCR provider
- Admin/configuration panel
- Docker deployment
- Health/readiness checks

Buyer स्वयं hosting, catalogue access, AI/OCR provider charges, temporary storage, monitoring और backups संभालेगा। Developer-operated central medicine database, central API या shared AI key नहीं चाहिए।

Current in-memory ScanStore केवल एक process के लिए हो सकता है। Multi-replica deployment के लिए buyer-owned Redis/PostgreSQL/object-storage adapter बनाओ। Buyer catalogue को हमारी database में import मत करो।

## 12. Security और Privacy

- Production API authentication अनिवार्य।
- TLS/HTTPS deployment।
- Upload MIME, size, dimensions और content validation।
- Rate limits और request timeouts।
- Secrets environment/secret manager में।
- Mobile app में permanent server key नहीं।
- Buyer catalogue read-only।
- Temporary image retention configurable।
- Retake/cancel/expiry पर temporary files delete।
- Logs में API keys, raw images या personal details नहीं।
- Buyer permission के बिना catalogue cache/persist नहीं करना।
- Buyer data को shared AI training में उपयोग नहीं करना।
- Dependency/container vulnerability checks।

## 13. अनिवार्य Testing

Backend tests:
- Exact product identity
- Full-set composition match
- Ingredient order independence
- 2/3 active ingredients
- Different strength rejection
- Missing/extra ingredient rejection
- Different salt/chemical form strict mismatch
- Inactive ingredient exclusion
- Unknown role => unable_to_compare
- Low OCR confidence => unable_to_compare
- Conflicting captures
- mg/g/mcg deterministic conversions
- per tablet vs per 5 mL basis distinction
- IU guessed conversion rejection
- Missing dosage form/release/route display
- Pagination page 1/page 2 without double slicing
- Duplicate catalogue IDs
- Buyer API timeout/502/invalid payload
- Invalid API key
- Oversized/invalid image
- Capture deletion/session expiry

SDK/UI tests:
- Camera permission allow/deny
- Front capture
- Composition close-up trigger
- Retake replaces old capture
- Back photo only when required
- Upload progress
- Cancel/retry/network failure
- Processing/results/no-result/uncertain states
- Android/Expo target checks

CI में Ruff, Pytest, TypeScript typecheck/build, SDK tests, Docker build और OpenAPI schema check चलाओ। Tests skip/delete करके CI green मत बनाना।

## 14. Development phases

**Phase A — Audit and repair**
- Repository audit
- Existing test failures fix
- Schema/API mismatch fix
- Existing docs/status reconciliation

**Phase B — Data contract and matching**
- Strength basis schema
- Multi-ingredient parser
- Unit normalisation
- Exact composition signature
- Buyer REST adapter
- Composition match API
- Unit/integration tests

**Phase C — Scanner SDK/UI**
- Expo demo host app
- Permission flow
- Guided front/composition/back capture
- Review/retake
- Adaptive quality messaging
- Upload/cancel/error states

**Phase D — Vision integration**
- Buyer-configured Gemini Vision provider
- Structured extraction
- OCR/AI evidence merge
- Conflict/uncertainty handling
- Provider failure fallback

**Phase E — Buyer setup**
- Admin/configuration UI
- Catalogue field mapping
- Connection test
- Provider key setup
- Retention/security settings

**Phase F — Self-hosted packaging**
- Docker Compose
- Clean installation
- Buyer-owned session storage
- Health checks
- Environment validation
- Installation/upgrade manuals

**Phase G — Release validation**
- Full CI
- Security review
- Performance tests
- Representative synthetic/test images
- Dependency check
- API docs/sample integration
- Update implementation status inside PROJECT_PLAN.md

हर phase के बाद tests चलाओ और उसी master plan के implementation/status section को update करो। Duplicate plan या status Markdown file मत बनाना।

## 15. Documentation और final delivery

मौजूदा documentation structure को सुधारो और जरूरत पर ये technical guides बनाओ/अपडेट करो:
- README.md
- docs/SCANNER_UX.md
- docs/API_REFERENCE.md या generated OpenAPI
- docs/CATALOGUE_ADAPTER.md
- docs/SDK.md
- docs/SECURITY.md
- docs/DEPLOYMENT.md
- docs/TROUBLESHOOTING.md
- docs/UPGRADE_GUIDE.md
- .env.example

ये implementation guides हो सकती हैं, लेकिन product planning का duplicate नहीं। सभी product requirements और planning decisions केवल `PROJECT_PLAN.md` में रहें।

Final delivery:
- Complete source code
- Expo sample scanner app
- TypeScript SDK
- FastAPI backend
- Docker deployment
- Tests
- Synthetic buyer catalogue service
- Setup/integration instructions

## 16. काम शुरू करने का आदेश

अब:
1. `PROJECT_PLAN.md` पूरा पढ़ो।
2. Repository का वास्तविक audit करो।
3. Baseline tests और CI स्थिति दर्ज करो।
4. पहले existing defects ठीक करो।
5. फिर Phase A से क्रमवार actual implementation शुरू करो।
6. हर चरण में code, tests और docs अपडेट करो।
7. अंत में implemented, tests passed, failed, pending और known risks की अलग-अलग truthful report दो।

केवल नई planning लिखकर काम समाप्त मत करना। मौजूदा repository में वास्तविक implementation करना ही लक्ष्य है।
