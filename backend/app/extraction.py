import re

from .ocr import OCRDocument
from .schemas import (
    CompositionComponent,
    ExtractedField,
    IngredientRole,
    ScanExtraction,
)

STRENGTH_PATTERN = re.compile(
    r"(?i)\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|μg|ug|g|ml|iu|%)(?:\b|/)"
)
COMPONENT_PATTERN = re.compile(
    r"(?i)^(?P<name>.+?)\s+(?P<amount>\d+(?:[.,]\d+)?)\s*(?P<unit>mcg|µg|μg|ug|mg|g|iu|ml|%)\s*$"
)
COMPOSITION_HEADING = re.compile(
    r"(?i)\bcomposition\b|\beach\s+(?:tablet|capsule|5\s*ml|10\s*ml|dose)\s+contains\b"
)
MANUFACTURER_HINTS = ("manufactured by", "marketed by", "निर्माता", "विपणन")
STOP_SECTION = re.compile(
    r"(?i)^(?:indications?|directions?|dosage|storage|warning|manufactured by|marketed by)\b"
)


def _parse_components(line: str, capture_id: str, confidence: float | None, *, active_context: bool):
    text = re.sub(
        r"(?i)^\s*(?:composition\s*[:\-]?\s*)?(?:each\s+(?:tablet|capsule|5\s*ml|10\s*ml|dose)\s+contains\s*[:\-]?\s*)?",
        "",
        line,
    ).strip(" :;,-")
    if not text or not STRENGTH_PATTERN.search(text):
        return []

    parts = re.split(r"\s*\+\s*|\s*;\s*|\s+and\s+", text, flags=re.IGNORECASE)
    parsed = []
    for part in parts:
        candidate = part.strip(" :;,-")
        match = COMPONENT_PATTERN.match(candidate)
        if not match:
            continue
        name = match.group("name").strip(" :;,-")
        if len(name) < 2:
            continue
        parsed.append(
            CompositionComponent(
                ingredient_name=name,
                ingredient_role=IngredientRole.ACTIVE if active_context else IngredientRole.UNKNOWN,
                strength_value=match.group("amount").replace(",", "."),
                strength_unit=match.group("unit").casefold(),
                confidence=confidence,
                source_capture_ids=[capture_id],
                source_text=candidate,
            )
        )
    return parsed


def extract_printed_fields(documents: list[tuple[str, OCRDocument]]) -> ScanExtraction:
    """Extract visible label text and conservative structured composition components."""
    lines: list[tuple[str, str, float | None]] = []
    raw_parts: list[str] = []
    all_component_sets: list[list[CompositionComponent]] = []

    for capture_id, document in documents:
        raw_parts.append(document.text)
        in_composition_section = False
        context_lines_remaining = 0
        capture_components: list[CompositionComponent] = []

        for raw_line in document.text.splitlines():
            value = raw_line.strip()
            if not value:
                continue
            lines.append((value, capture_id, document.mean_confidence))

            if COMPOSITION_HEADING.search(value):
                in_composition_section = True
                context_lines_remaining = 6
                components = _parse_components(
                    value, capture_id, document.mean_confidence, active_context=True
                )
                capture_components.extend(components)
                continue

            if STOP_SECTION.search(value):
                in_composition_section = False
                context_lines_remaining = 0
                continue

            components = _parse_components(
                value,
                capture_id,
                document.mean_confidence,
                active_context=in_composition_section,
            )
            capture_components.extend(components)
            if in_composition_section:
                context_lines_remaining -= 1
                if context_lines_remaining <= 0:
                    in_composition_section = False

        if capture_components:
            all_component_sets.append(capture_components)

    product_line = next(
        (
            row for row in lines
            if 3 <= len(row[0]) <= 90
            and not STRENGTH_PATTERN.search(row[0])
            and not COMPOSITION_HEADING.search(row[0])
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

    def field(row):
        if row is None:
            return ExtractedField()
        value, capture_id, confidence = row
        return ExtractedField(
            value=value,
            confidence=confidence,
            source_capture_ids=[capture_id],
            source_text=value,
        )

    conflicts = []
    composition_components: list[CompositionComponent] = []
    if all_component_sets:
        signatures = {
            tuple(sorted(
                (
                    component.ingredient_name.casefold(),
                    component.strength_value,
                    component.strength_unit,
                )
                for component in component_set
            ))
            for component_set in all_component_sets
        }
        if len(signatures) > 1:
            conflicts.append("composition_components")
        else:
            # Prefer a clear, explicitly labelled composition section, then higher OCR confidence.
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

    missing = []
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
        composition_components=composition_components,
        raw_text="\n".join(part for part in raw_parts if part)[:12000],
        unreadable_fields=missing,
        field_conflicts=conflicts,
        composition_parse_status=(
            "conflict" if conflicts else "parsed" if composition_components else "unavailable"
        ),
        review_required=True,
    )
