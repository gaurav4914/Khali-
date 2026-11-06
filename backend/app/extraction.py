import re

from .ocr import OCRDocument
from .schemas import ExtractedField, ScanExtraction

STRENGTH_PATTERN = re.compile(
    r"(?i)\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|μg|g|ml|mL|iu|%)(?:\b|/)"
)
MANUFACTURER_HINTS = ("manufactured by", "marketed by", "निर्माता", "विपणन")


def extract_printed_fields(documents: list[tuple[str, OCRDocument]]) -> ScanExtraction:
    """Extract visible text candidates only; never infer missing medicine facts."""
    lines: list[tuple[str, str, float | None]] = []
    raw_parts: list[str] = []

    for capture_id, document in documents:
        raw_parts.append(document.text)
        for line in document.text.splitlines():
            value = line.strip()
            if value:
                lines.append((value, capture_id, document.mean_confidence))

    product_line = next(
        (
            row for row in lines
            if 3 <= len(row[0]) <= 90
            and not STRENGTH_PATTERN.search(row[0])
            and sum(ch.isalpha() for ch in row[0]) >= 3
        ),
        None,
    )
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

    missing = []
    if product_line is None:
        missing.append("printed_product_name")
    if composition_line is None:
        missing.append("printed_composition_text")
    if manufacturer_line is None:
        missing.append("manufacturer_text")

    return ScanExtraction(
        printed_product_name=field(product_line),
        printed_composition_text=field(composition_line),
        manufacturer_text=field(manufacturer_line),
        raw_text="\n".join(part for part in raw_parts if part)[:12000],
        unreadable_fields=missing,
        review_required=True,
    )
