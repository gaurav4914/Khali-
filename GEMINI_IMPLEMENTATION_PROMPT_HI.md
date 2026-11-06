# Gemini के लिए पूरा Development Handoff Prompt (Hindi)

> इस दस्तावेज़ को Gemini में पूरा कॉपी करके दें। Gemini को GitHub repository `gaurav4914/Khali-` से जोड़ें।  
> मुख्य तकनीकी specification: `PROJECT_PLAN.md`  
> मौजूदा code स्थिति: `IMPLEMENTATION_STATUS.md`

---

## भूमिका और लक्ष्य

तुम इस repository के Senior Software Architect, Backend Engineer, React Native/Expo Engineer, QA Engineer और DevOps Engineer की संयुक्त जिम्मेदारी निभा रहे हो।

तुम्हारा काम केवल सुझाव देना, code snippets देना या नया plan लिखना नहीं है। Repository में जो code पहले से मौजूद है, उसे समझकर उसी project को सही दिशा में पूरा करना है। सीधे files में वास्तविक implementation करो, tests चलाओ, failures ठीक करो और हर चरण के बाद repository को usable स्थिति में रखो।

**Product का नाम:** Medicine Photo Intelligence Engine  
**Repository:** `https://github.com/gaurav4914/Khali-`  
**मुख्य branch:** `main`  
**Product model:** Self-hosted B2B software; एक बार विकसित करके कई अलग-अलग buyers को non-exclusive तरीके से दिया जा सके।  
**मुख्य नियम:** Build once, package once. हर buyer अपनी अलग installation चलाएगा।

## सबसे पहले ये दो फाइलें पढ़ना अनिवार्य है

1. `PROJECT_PLAN.md` — पूरा और अंतिम product/technical plan। इसे सर्वोच्च specification मानो।
2. `IMPLEMENTATION_STATUS.md` — अब तक क्या बना है और क्या बाकी है।

इसके बाद पूरे repository का tree देखो और backend, SDK, tests, Docker, CI, README तथा docs की मौजूदा files एक-एक करके पढ़ो। केवल plan पढ़कर नया code मत लिखना।

---

# 1. Product को ठीक से समझो

यह कोई नया consumer medicine app नहीं है। हम एक ऐसा complete, reusable software engine बना रहे हैं जिसे pharmacy/medicine-commerce/healthcare कंपनियाँ अपने existing app में integrate कर सकें।

हमारा software:
- अपना consumer app या online pharmacy नहीं चलाएगा।
- अपना shared medicine database नहीं रखेगा।
- किसी buyer का database copy/import करके अपने पास नहीं रखेगा।
- सभी buyers के लिए कोई central developer-operated API/server नहीं चलाएगा।
- buyer के existing catalogue को authorised read-only API/adapter के माध्यम से query करेगा।
- buyer के अपने cloud/server पर install होगा।
- buyer अपनी hosting, catalogue access, AI/OCR provider account और usage charges संभालेगा।
- हम software source, SDK, API, deployment package और documentation बेचेंगे।
- एक ही codebase अलग-अलग buyers को बार-बार बेचा जा सकेगा। Standard sale non-exclusive रहेगी; exclusive IP assignment तभी जब अलग से तय किया गया हो।

## मुख्य customer journey

1. Buyer के app में user "Scan medicine" जैसा camera button दबाता है।
2. हमारा embedded scanner खुलता है।
3. Guided camera के निर्देश से user पैक की front photo लेता है।
4. अगर composition text छोटा/धुंधला है तो scanner उसी text का close-up माँगता है।
5. जरूरत पड़ने पर back/side photo माँगता है।
6. Quality Engine blur, glare, कम रोशनी, crop, text size और focus जाँचता है।
7. OCR और buyer-configured Vision provider printed label पढ़ते हैं।
8. Composition को structured components में बदला जाता है।
9. दो अलग operations चलते हैं:
   - Exact Product Identity: फोटो वाला वही product buyer catalogue में खोजो।
   - Composition Group Discovery: फोटो में मौजूद सभी confirmed active ingredients और उनकी individual strength का पूरा set buyer catalogue में खोजो। जो catalogue records exact full composition criteria पास करें, सभी लौटाओ। इस group में reference brand और other brands हो सकते हैं, अगर buyer catalogue में मौजूद हों।
10. Results host app में दिखें। कोई record अनुमान से न बनाओ। Match का मतलब catalogue data match है; यह व्यक्तिगत चिकित्सा निर्णय या किसी product को बदलने का निर्देश नहीं है।

**बहुत जरूरी:** परिणाम केवल दो तक सीमित मत करना। Buyer catalogue में जितने exact records हैं, pagination के साथ सभी लौटाओ। अगर एक भी सही record नहीं है तो गलत record दिखाने के बजाय no-match बताओ।

---

# 2. Existing code को बचाकर काम शुरू करो

Repository में पहले से FastAPI backend, OCR abstraction, composition matcher, buyer REST catalogue adapter, React Native TypeScript API client और शुरुआती tests मौजूद हैं।

इन files को विशेष रूप से जाँचना:

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
- `.github/workflows/ci.yml`
- `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `.env.example`

नियम:
- किसी existing file को पढ़े बिना replace मत करना।
- मौजूदा APIs को बिना वजह तोड़ना नहीं।
- पुराना implementation बेकार समझकर पूरा repository फिर से शुरू मत करना।
- जिस file को बदलो, उसके imports, tests और callers भी जाँचो।
- secrets, API keys, वास्तविक patient data या private buyer catalogue data कभी commit मत करना।
- एक समय में बहुत सारे unrelated files बदलने के बजाय छोटे, साफ commits करो।
- अगर GitHub access नहीं है तो access होने का झूठा दावा मत करना; पहले स्पष्ट बताओ कि repository connect करनी होगी।

---

# 3. सबसे पहले Audit और Baseline Test

Coding से पहले:

1. main branch का current commit और repository tree पढ़ो।
2. `PROJECT_PLAN.md` और `IMPLEMENTATION_STATUS.md` पूरे पढ़ो।
3. Existing CI workflow और हाल के failed/successful runs देखो।
4. Local environment में dependency install करके ये commands चलाओ:

```bash
pip install -e ".[dev]"
pytest
ruff check backend tests --select E4,E7,E9,F
```

5. SDK के लिए package scripts और TypeScript build/typecheck चलाओ।
6. हर failure का exact कारण लिखो और पहले उसे ठीक करो।
7. Baseline report में बताओ कि पहले क्या पास हुआ और क्या fail हुआ।

पहले test suite को green करो, उसके बाद आगे features जोड़ो।

---

# 4. Structured Composition Data सही बनाओ

सिर्फ एक free-text string जैसे "Ingredient A 500 mg + Ingredient B 10 mg" से production-grade matching मत बनाओ।

हर component में कम से कम ये fields हों:

- ingredient_name_printed
- ingredient_name_normalised
- ingredient_key (यदि buyer की approved canonical mapping उपलब्ध हो)
- ingredient_role: active / inactive / unknown
- strength_amount (decimal string)
- strength_unit
- strength_basis_amount (optional; जैसे 5)
- strength_basis_unit (optional; जैसे mL)
- source_capture_id
- source_text
- confidence
- extraction/provider provenance

Combination product के हर ingredient को अलग component बनाओ।

इनका अंतर समझना अनिवार्य है:
- 5 mg per tablet
- 5 mg per 5 mL
- 5 mg per mL
- 5% w/w
- 500 IU

इनको एक जैसा न मानना। केवल सुरक्षित, deterministic unit conversion लागू करना। IU को बिना substance-specific approved conversion के mass में convert मत करना।

Ingredient order अलग हो तो matching fail नहीं होना चाहिए। लेकिन किसी ingredient का salt/chemical form अलग हो तो उसे अपने आप same ingredient मत मानना। Synonyms का mapping केवल buyer की reviewed mapping table से हो।

**Active और inactive का अंतर:** Excipients/inactive ingredients को active signature में मत जोड़ना। Generic "Composition" heading से हर component को active मत मानना। अगर label context से role स्पष्ट नहीं है तो unknown रखो और exact composition result मत दो।

---

# 5. Composition Group Matching Engine

यह मुख्य business feature है। Existing `backend/app/composition.py` को review करके मजबूत बनाओ।

Matching के नियम:

1. Scan side पर complete active-component set बनाओ।
2. हर component के ingredient identity, amount, unit और basis को normalise करो।
3. Buyer catalogue side के हर record का complete active-component set बनाओ।
4. दोनों sets में active components की संख्या बराबर होनी चाहिए।
5. हर ingredient का approved canonical identity / strict normalized name match होना चाहिए।
6. हर ingredient की exact per-component strength और basis match होनी चाहिए।
7. कोई extra active ingredient हो या कोई missing active ingredient हो तो exact match नहीं।
8. Ingredient order का असर नहीं होना चाहिए।
9. Inactive ingredients active signature का हिस्सा नहीं होंगे।
10. Incomplete data, unknown active/inactive role, uncertain OCR या conflicting photos होने पर `unable_to_compare` लौटाओ; अनुमान नहीं लगाना।
11. Buyer API द्वारा लौटाए हर record को local matcher से दोबारा verify करो।
12. सभी exact matches लौटाओ। Pagination buyer API से आए और local matcher दूसरी बार page slicing न करे।

Dosage form, release type और route को अलग compare करो। Active composition match होने पर भी इनका अंतर साफ दिखे। उदाहरण:
- Same recorded active composition — formulation details match.
- Same recorded active composition — dosage form differs.
- Same recorded active composition — release type differs.
- Same recorded active composition — route differs.
- Unable to compare.

Reference brand / other brand का label केवल buyer catalogue के `brand_category` metadata से लो। लोकप्रियता, कीमत या AI inference से category मत बनाओ।

किसी result को "safe substitute", "take this instead", "clinically equivalent" या patient-specific recommendation मत कहना। UI/API में स्पष्ट informational notice रहे कि catalogue composition match कोई clinical approval नहीं है।

---

# 6. OCR और AI Vision

Local OCR baseline:
- Tesseract; English + Hindi language packs।
- OCR provider interface बनाए रखो।
- Original image सुरक्षित रखो; OCR के लिए processed derivative इस्तेमाल कर सकते हो।
- हर field के साथ source capture और OCR confidence रखो।

Vision provider:
- Gemini Vision adapter को configurable तरीके से implement करो।
- API key buyer अपने environment में देगा।
- Model ID environment variable/configuration से आए; source code में personal key या fixed provider model पर निर्भरता न रखो।
- भविष्य में OpenAI/अन्य provider जोड़ने के लिए वही interface रहे।
- AI से केवल visible printed text/field extraction कराओ; missing text invent करने को न कहो।
- OCR और AI output में conflict हो तो conflict flag करो और targeted retake/review माँगो।
- AI provider unavailable हो तो captured images न खोएँ। Local OCR/clear error path काम करे।
- Buyer को स्पष्ट बताओ कि image external provider को भेजी जाएगी या buyer server पर ही process होगी।

---

# 7. Guided Camera Scanner — पूरा UI बनाना अनिवार्य

सिर्फ API client बनाकर काम पूरा घोषित मत करना। React Native / Expo-compatible scanner UI और runnable sample host app बनाओ।

Expo package version के अनुसार official, current Expo Camera API चुनो। पुराने/deprecated APIs अनुमान से इस्तेमाल मत करना।

Required UI screens:

### Screen 1 — Entry
- Title: Scan medicine pack
- छोटा instruction
- Start scan button
- Optional Gallery import (buyer द्वारा enable होने पर)
- Buyer-controlled privacy note

### Screen 2 — Live front camera
- Full-screen camera preview
- Centre alignment rectangle / pack guide
- Top progress: Photo 1 of 2
- Bottom: torch, capture, optional gallery, camera switch
- Focus indicator
- Prompt: "Show the full front of the pack."

### Screen 3 — Capture review
- Captured image preview
- Clear enough / Try again / Need a closer photo status
- Retake और Use photo actions
- Retake करते समय पुरानी capture delete/replace हो

### Screen 4 — Composition close-up
- तभी खोलो जब composition text unreadable/too small हो
- Text area के लिए अलग guide frame
- Prompt: "Bring the composition details closer. Keep all lines inside the frame."

### Screen 5 — Back/side photo
- केवल तब माँगो जब आवश्यक जानकारी किसी दूसरी side पर होने की संभावना हो
- हर scan में सभी photos जबरन न माँगो

### Screen 6 — Processing
- Checking photo quality
- Reading printed text
- Identifying scanned product
- Searching buyer catalogue
- Progress, cancel और retry support

### Screen 7 — Results
दो अलग result blocks:
1. Exact Product Identity
2. Same Recorded Composition in Buyer's Catalogue

Composition group में सभी matching catalogue products दिखाओ। Brand category buyer metadata से आए। Strength, dosage form, release type, route और manufacturer जहाँ उपलब्ध हों, दिखाओ। Data missing हो तो साफ दिखाओ।

Result copy patient-specific advice न दे और किसी medicine को बदलने का निर्देश न दे।

### Scanner technical details
- Camera permission handling
- Autofocus / tap-to-focus जहाँ available हो
- Torch support
- Orientation handling
- Image compression और max upload size
- Loading, retry, offline/network error और cancellation states
- Duplicate capture रोकना
- Capture session expiry
- Accessibility labels और readable contrast
- Low-end Android devices पर performance
- Gallery import buyer setting से नियंत्रित

---

# 8. Image Quality Engine

Blur, glare, exposure, text size, crop, perspective skew, orientation, compression artifacts और image dimensions check करो।

हर captured photo के लिए structured response:
- status: accepted / retry_recommended / retry_required / unsupported
- issues[]
- recommended_action
- target_region
- width, height
- quality metrics

Blur और glare के threshold को synthetic test images से verify करो। केवल एक guessed score से photo को reliable मत बताना। अगर quality metrics uncertain हों तो retake recommend करो।

Image enhancement में crop, rotate, perspective correction, denoise और contrast improvement हो सकती है, लेकिन missing text invent नहीं होना चाहिए। Original file से traceability बनी रहे।

---

# 9. Buyer Catalogue Adapter

हमारा कोई shared medicine database नहीं बनेगा।

पहला adapter buyer-provided REST API हो:
- exact product lookup
- barcode lookup
- composition search
- product detail lookup
- pagination

Composition search में buyer API को पूरा structured component set और प्रत्येक strength/basis भेजो। Buyer API हर page में संभावित records लौटाए; हमारा matcher हर record को verify करे।

SQL connector बाद में optional module हो:
- read-only SQL user
- buyer-approved views/field mapping
- parameterised queries
- कोई write/migration नहीं
- AI output से arbitrary SQL कभी नहीं

यदि buyer के पास composition structured form में नहीं है, तो field mapping/normalization setup चाहिए। Free text से blindly exact match न बनाओ।

---

# 10. API और SDK

Current REST API versioning बनाए रखो:

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

Composition response में:
- status
- matches_in_page
- page/page_size
- has_more या next_cursor
- verified records
- matched components
- different/missing fields
- reference/other brand category
- normalization/mapping version
- informational professional-review notice

SDK में typed methods, typed responses और error handling हों। SDK को सिर्फ request wrapper मत छोड़ो; scanner UI module और demo app भी बनाओ।

Permanent API key को mobile app में hard-code मत करना। Production में buyer backend के माध्यम से call करो या short-lived scoped token व्यवस्था जोड़ो।

---

# 11. Self-hosted Packaging और खर्च

हर buyer का अलग installation:
- Backend API
- Scanner SDK
- Buyer catalogue adapter
- Buyer-configured AI/OCR provider
- Admin/configuration panel
- Docker deployment
- Health/readiness checks

Buyer स्वयं संभाले:
- hosting/server/cloud
- catalogue access
- AI/OCR provider account और usage charges
- temporary storage
- monitoring/backups
- application privacy notice

हमारा developer-operated central database, central server या central AI key नहीं होना चाहिए।

मौजूदा in-memory ScanStore केवल एक process के लिए है। Multi-replica के लिए buyer-owned Redis/PostgreSQL/object storage adapter दो; लेकिन buyer का product catalogue हमारे database में import नहीं करना।

---

# 12. Security और Privacy

- Production में API authentication अनिवार्य।
- TLS/HTTPS के पीछे deployment।
- Upload MIME type, file size, dimensions और content validation।
- Rate limit और request timeout।
- Secrets .env/secret manager में; Git में कभी नहीं।
- Mobile app में permanent server key नहीं।
- Buyer catalogue read-only access।
- Temporary images retention policy।
- Retake/cancel/expiry पर files delete।
- Logs में API keys, raw image bytes या personal details नहीं।
- Buyer की अनुमति के बिना catalogue data cache/persist नहीं करना।
- Buyer की images/catalogue को shared AI model training के लिए इस्तेमाल नहीं करना।
- Dependencies/container vulnerability checks।

---

# 13. Tests — केवल happy path पर्याप्त नहीं

Backend unit + integration tests:
- Exact product ID match
- Composition exact full-set match
- Ingredient order independence
- Combination with two/three active ingredients
- Different strength rejection
- Missing ingredient rejection
- Extra ingredient rejection
- Different salt/chemical form strict mismatch
- Inactive ingredient excluded
- Unknown role => unable_to_compare
- Low OCR confidence => unable_to_compare
- Conflicting front/back captures => review/retake
- mg/g/mcg deterministic conversions
- per tablet vs per 5 mL basis distinction
- IU not converted by guessing
- missing dosage form/release/route shown
- pagination page 1/page 2 no double slicing
- duplicate catalogue IDs
- buyer API timeout/502/invalid payload
- invalid API key
- oversized and invalid image
- capture deletion and session expiry

SDK/UI tests:
- camera permission allow/deny
- front capture
- composition close-up trigger
- retake deletes old capture
- back photo only when required
- upload progress
- cancel/retry/network failure
- processing and result states
- no-results and uncertain states
- screen renders on Android/Expo test target

CI:
- Ruff
- Pytest
- TypeScript typecheck/build
- SDK tests
- Docker build
- OpenAPI schema check

किसी test को skip/delete करके CI green मत बनाना। वास्तविक failure का कारण ठीक करो।

---

# 14. काम करने का क्रम

क्रम का पालन करो:

**Phase A — Audit और Repair**
- Repo audit
- Current test failures fix
- Schema/API mismatch fix
- Existing docs/status reconcile

**Phase B — Data Contract और Matching**
- Strength basis schema
- Multi-ingredient parser
- Unit normalisation
- Exact composition signature
- Buyer REST adapter
- Composition match API
- Complete unit tests

**Phase C — Scanner SDK/UI**
- Expo demo host app
- Permission flow
- front/composition/back guided capture
- image review/retake
- adaptive quality messaging
- upload, cancellation and error states

**Phase D — Vision Integration**
- Buyer-configured Gemini Vision provider
- Structured JSON extraction
- OCR/AI evidence merge
- conflict/uncertainty handling
- provider failure fallback

**Phase E — Buyer Setup**
- Admin/configuration page
- catalogue field mapping
- connection test
- provider key setup
- retention and security configuration

**Phase F — Self-hosted Packaging**
- Docker Compose
- local clean installation
- buyer-owned session storage option
- health checks
- environment validation
- installation/upgrade manuals

**Phase G — Release Validation**
- Full CI pass
- security review
- performance testing
- representative test images
- current dependency check
- API docs and sample integration
- implementation status update

हर phase के बाद tests और status update करो। एक feature के अधूरे रहते दूसरे phase में बिना कारण मत कूदना।

---

# 15. Documentation और final delivery

काम के अंत में ये files सही और आपस में consistent हों:

- PROJECT_PLAN.md
- IMPLEMENTATION_STATUS.md
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

इसके साथ:
- complete source code
- Expo sample scanner app
- TypeScript SDK
- FastAPI backend
- Docker deployment
- test suite
- sample buyer catalogue service (केवल synthetic data)
- setup instructions
- buyer integration example

---

# 16. कार्य निष्पादन के नियम

1. पहले पूरा repository audit करो।
2. Project plan को ध्यान से पढ़ो और उसी के अनुसार implementation करो।
3. केवल सलाह या code block देकर काम खत्म मत करना।
4. सीधे repository की files में वास्तविक code लिखो।
5. हर major feature के बाद tests चलाओ।
6. किसी existing feature को हटाने पर कारण और migration लिखो।
7. यदि कोई requirement technically असंभव हो तो उसका कारण और viable alternative बताओ।
8. Missing information पर sensible default अपनाओ; बार-बार वही सवाल मत पूछो।
9. किसी external service की current API बदल चुकी हो तो official current docs देखकर ही implement करो।
10. कोई real API key या patient data commit मत करो।
11. हर commit छोटा, meaningful और reviewable रखो।
12. जब तक test/log से पुष्टि न हो, "सब perfect है" या "production ready" मत कहना।
13. अंतिम रिपोर्ट में implemented, tests passed, failed, pending और known risks अलग-अलग बताओ।

## अंतिम लक्ष्य

एक ऐसा complete, self-hosted, reusable B2B software product तैयार करना है जिसे एक buyer अपने app में integrate करे और अपने infrastructure, अपने database और अपने API accounts के साथ स्वतंत्र रूप से चलाए। वही software package अलग-अलग buyers को बार-बार दिया जा सके।

**अब repository का audit शुरू करो, मौजूदा code को बचाकर gaps ठीक करो और Phase A से क्रमवार actual implementation शुरू करो।**
