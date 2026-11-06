import re

from .composition import normalise_ingredient
from .ocr import OCRDocument
from .schemas import (
    CompositionComponent,
    ExtractedField,
    IngredientRole,
    ScanExtraction,
)

STRENGTH_PATTERN = re.compile(
    r"(?i)(?:^|\s)\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|ug|g|ml|iu|%)(?:\s*(?:w/w|w/v|v/v))?(?:\b|/|%|$)"
)
COMPONENT_PATTERN = re.compile(
    r"(?i)^(?P<name>.+?)\s*[:\-]?\s*(?P<amount>\d+(?:[.,]\d+)?)\s*"
    r"(?P<unit>mcg|µg|μg|ug|mg|g|iu|ml|%)"
    r"(?:\s*(?P<pct_basis>w/w|w/v|v/v))?"
    r"(?:\s*(?:per|/)\s*(?P<basis_amount>\d+(?:[.,]\d+)?)?\s*(?P<basis_unit>tablet|capsule|ml|l|g|mg|dose|puff|drop|sachet|vial|ampoule))?\s*$"
)
EACH_BASIS_HEADING = re.compile(
    r"(?i)\beach\s+(?:(?P<basis_amount>\d+(?:[.,]\d+)?)\s*)?"
    r"(?P<basis_unit>uncoated\s+tablet|film\s+coated\s+tablet|dispersible\s+tablet|tablet|capsule|ml|dose|sachet|puff|drop)\s+contains\b"
    r"|प्रत्येक\s+(?:(?P<hi_amount>\d+(?:[.,]\d+)?)\s*)?(?P<hi_unit>टैबलेट|कैप्सूल|मिली|ml)\s+में"
)
COMPOSITION_HEADING = re.compile(
    r"(?i)\bcomposition\b|\bactive\s+ingredients?\b|\beach\s+.*?\bcontains\b|संरचना|घटक|प्रत्येक\s+.*?में"
)
ACTIVE_COMPOSITION_HEADING = re.compile(
    r"(?i)\bactive\s+ingredients?\b|\beach\s+.*?\bcontains\b|सक्रिय\s+घटक|प्रत्येक\s+.*?में"
)
MANUFACTURER_HINTS = ("manufactured by", "marketed by", "mfg. by", "mfg by", "निर्माता", "विपणन")
STOP_SECTION = re.compile(
    r"(?i)^(?:indications?|directions?|dosage|storage|warning|caution|excipients?|inactive ingredients?|"
    r"colou?rs?|flavou?rs?|preservatives?|other ingredients|manufactured by|marketed by|mfg\.?\s*by|"
    r"सहायक\s+घटक|रंग|भंडारण|चेतावनी)(?:\b|:|\s|$)"
)
DOSAGE_FORM_PATTERN = re.compile(
    r"(?i)\b(film[\s\-]+coated\s+tablets?|uncoated\s+tablets?|dispersible\s+tablets?|tablets?|"
    r"hard\s+gelatin\s+capsules?|softgel\s+capsules?|capsules?|oral\s+suspension|suspension|"
    r"syrup|injection|ointment|cream|gel|eye\s+drops?|ear\s+drops?|nasal\s+spray|inhaler|powder)\b"
    r"|(टैबलेट|कैप्सूल|सिरप|इंजेक्शन|क्रीम|मलहम)"
)
RELEASE_TYPE_PATTERN = re.compile(
    r"(?i)\b(extended[\s\-]+release|sustained[\s\-]+release|prolonged[\s\-]+release|"
    r"modified[\s\-]+release|delayed[\s\-]+release|immediate[\s\-]+release|"
    r"enteric[\s\-]+coated|sr|xr|er|cr|mr|dr)\b"
)
ROUTE_PATTERN = re.compile(
    r"(?i)\b(for\s+oral\s+use|oral|topical|intravenous|intramuscular|subcutaneous|"
    r"ophthalmic|otic|nasal|inhalation|external\s+use\s+only)\b"
)
PHARMACOPOEIA_SUFFIX = re.compile(r"(?i)\s+\b(?:I\.?P\.?|B\.?P\.?|U\.?S\.?P\.?|Ph\.?\s*Eur\.?)\b\s*$")


def _extract_heading_basis(line: str) -> tuple[str | None, str | None]:
    match = EACH_BASIS_HEADING.search(line)
    if not match:
        return None, None
    amount = match.group("basis_amount") or match.group("hi_amount")
    raw_unit = (match.group("basis_unit") or match.group("hi_unit") or "").casefold().strip()
    if "tablet" in raw_unit or raw_unit == "टैबलेट":
        return amount or "1", "tablet"
    if "capsule" in raw_unit or raw_unit == "कैप्सूल":
        return amount or "1", "capsule"
    if raw_unit in {"ml", "मिली"}:
        return amount or "1", "ml"
    if raw_unit:
        return amount or "1", raw_unit
    return None, None


def _clean_ingredient_name(raw_name: str) -> str:
    cleaned = raw_name.strip(" :;,-•*")
    cleaned = PHARMACOPOEIA_SUFFIX.sub("", cleaned).strip(" :;,-")
    return cleaned


def _parse_components(
    line: str,
    capture_id: str,
    confidence: float | None,
    *,
    active_context: bool,
    default_basis: tuple[str | None, str | None] = (None, None),
    provenance: str = "ocr",
) -> list[CompositionComponent]:
    text = re.sub(
        r"(?i)^\s*(?:composition\s*[:\-]?\s*)?(?:active\s+ingredients?\s*[:\-]?\s*)?"
        r"(?:each\s+[^:\n]+?\s+contains\s*[:\-]?\s*)?"
        r"(?:प्रत्येक\s+[^:\n]+?\s+में\s*[:\-]?\s*)?",
        "",
        line,
    ).strip(" :;,-")
    if not text or not STRENGTH_PATTERN.search(text):
        return []

    parts = re.split(r"\s*\+\s*|\s*;\s*|\s+and\s+", text, flags=re.IGNORECASE)
    parsed: list[CompositionComponent] = []
    for part in parts:
        candidate = part.strip(" :;,-•*")
        if re.match(r"(?i)^(?:excipients?|q\.?s\.?)\b", candidate):
            continue
        match = COMPONENT_PATTERN.match(candidate)
        if not match:
            continue
        printed_name = _clean_ingredient_name(match.group("name"))
        if len(printed_name) < 2:
            continue

        pct_basis = match.group("pct_basis")
        explicit_basis_amount = match.group("basis_amount")
        explicit_basis_unit = match.group("basis_unit")

        basis_amount: str | None = None
        basis_unit: str | None = None
        if pct_basis:
            basis_unit = pct_basis.casefold()
        elif explicit_basis_unit:
            basis_amount = (explicit_basis_amount or "1").replace(",", ".")
            basis_unit = explicit_basis_unit.casefold()
        elif default_basis[1]:
            basis_amount, basis_unit = default_basis

        parsed.append(
            CompositionComponent(
                ingredient_name=printed_name,
                ingredient_name_printed=printed_name,
                ingredient_name_normalised=normalise_ingredient(printed_name),
                ingredient_role=IngredientRole.ACTIVE if active_context else IngredientRole.UNKNOWN,
                strength_value=match.group("amount").replace(",", "."),
                strength_amount=match.group("amount").replace(",", "."),
                strength_unit=match.group("unit").casefold(),
                strength_basis_amount=basis_amount,
                strength_basis_unit=basis_unit,
                confidence=confidence,
                source_capture_id=capture_id,
                source_capture_ids=[capture_id],
                source_text=candidate,
                provenance=provenance,
            )
        )
    return parsed


def extract_printed_fields(documents: list[tuple[str, OCRDocument]]) -> ScanExtraction:
    """Extract visible label text and conservative structured composition components."""
    lines: list[tuple[str, str, float | None, str]] = []
    raw_parts: list[str] = []
    all_component_sets: list[list[CompositionComponent]] = []
    providers_seen: list[str] = []

    for capture_id, document in documents:
        if document.provider and document.provider not in providers_seen:
            providers_seen.append(document.provider)
        raw_parts.append(document.text)
        in_composition_section = False
        active_composition_context = False
        current_basis: tuple[str | None, str | None] = (None, None)
        context_lines_remaining = 0
        capture_components: list[CompositionComponent] = []

        for raw_line in document.text.splitlines():
            value = raw_line.strip()
            if not value:
                continue
            lines.append((value, capture_id, document.mean_confidence, document.provider))

            if STOP_SECTION.search(value):
                in_composition_section = False
                active_composition_context = False
                current_basis = (None, None)
                context_lines_remaining = 0
                continue

            if COMPOSITION_HEADING.search(value):
                in_composition_section = True
                context_lines_remaining = 8
                active_composition_context = bool(ACTIVE_COMPOSITION_HEADING.search(value))
                heading_basis = _extract_heading_basis(value)
                if heading_basis[1]:
                    current_basis = heading_basis
                components = _parse_components(
                    value,
                    capture_id,
                    document.mean_confidence,
                    active_context=active_composition_context,
                    default_basis=current_basis,
                    provenance=document.provider or "ocr",
                )
                capture_components.extend(components)
                continue

            components = _parse_components(
                value,
                capture_id,
                document.mean_confidence,
                active_context=in_composition_section and active_composition_context,
                default_basis=current_basis if in_composition_section else (None, None),
                provenance=document.provider or "ocr",
            )
            capture_components.extend(components)
            if in_composition_section:
                context_lines_remaining -= 1
                if context_lines_remaining <= 0:
                    in_composition_section = False
                    active_composition_context = False
                    current_basis = (None, None)

        if capture_components:
            all_component_sets.append(capture_components)

    product_line = next(
        (
            row
            for row in lines
            if 3 <= len(row[0]) <= 90
            and not STRENGTH_PATTERN.search(row[0])
            and not COMPOSITION_HEADING.search(row[0])
            and not STOP_SECTION.search(row[0])
            and sum(ch.isalpha() for ch in row[0]) >= 3
        ),
        None,
    )
    composition_line = next((row for row in lines if COMPOSITION_HEADING.search(row[0])), None)
    if composition_line is None:
        composition_line = next((row for row in lines if STRENGTH_PATTERN.search(row[0])), None)
    manufacturer_line = next(
        (row for row in lines if any(hint in row[0].lower() for hint in MANUFACTURER_HINTS)),
        None,
    )

    dosage_row = None
    release_row = None
    route_row = None
    for row in lines:
        if dosage_row is None:
            m_dosage = DOSAGE_FORM_PATTERN.search(row[0])
            if m_dosage:
                dosage_row = (m_dosage.group(0), row[1], row[2], row[3])
        if release_row is None:
            m_rel = RELEASE_TYPE_PATTERN.search(row[0])
            if m_rel:
                release_row = (m_rel.group(0), row[1], row[2], row[3])
        if route_row is None:
            m_route = ROUTE_PATTERN.search(row[0])
            if m_route:
                route_row = (m_route.group(0), row[1], row[2], row[3])

    def field(row) -> ExtractedField:
        if row is None:
            return ExtractedField()
        value, capture_id, confidence, provider = row
        return ExtractedField(
            value=value,
            confidence=confidence,
            source_capture_id=capture_id,
            source_capture_ids=[capture_id],
            source_text=value,
            provenance=provider or "ocr",
        )

    conflicts: list[str] = []
    composition_components: list[CompositionComponent] = []
    if all_component_sets:
        signatures = {
            tuple(
                sorted(
                    (
                        normalise_ingredient(component.ingredient_name),
                        component.strength_value,
                        component.strength_unit,
                        component.strength_basis_amount or "",
                        component.strength_basis_unit or "",
                    )
                    for component in component_set
                )
            )
            for component_set in all_component_sets
        }
        if len(signatures) > 1:
            conflicts.append("composition_components")
        else:
            composition_components = max(
                all_component_sets,
                key=lambda component_set: (
                    sum(item.ingredient_role == IngredientRole.ACTIVE for item in component_set),
                    max(
                        (item.confidence or 0.0 for item in component_set),
                        default=0.0,
                    ),
                ),
            )

    missing: list[str] = []
    if product_line is None:
        missing.append("printed_product_name")
    if composition_line is None:
        missing.append("printed_composition_text")
    if not composition_components:
        missing.append("composition_components")
    if manufacturer_line is None:
        missing.append("manufacturer_text")

    return ScanExtraction(
        printed_product_name=field(product_line),
        printed_composition_text=field(composition_line),
        manufacturer_text=field(manufacturer_line),
        dosage_form_text=field(dosage_row),
        release_type_text=field(release_row),
        route_text=field(route_row),
        composition_components=composition_components,
        raw_text="\n".join(part for part in raw_parts if part)[:12000],
        unreadable_fields=missing,
        field_conflicts=conflicts,
        composition_parse_status=(
            "conflict" if conflicts else "parsed" if composition_components else "unavailable"
        ),
        ocr_provenance=providers_seen[0] if providers_seen else "tesseract",
        review_required=True,
    )
