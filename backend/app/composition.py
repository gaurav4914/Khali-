import hashlib
import json
import re
import unicodedata
from decimal import Decimal, InvalidOperation

from .schemas import (
    CompositionComponent,
    CompositionMatchCandidate,
    CompositionMatchStatus,
    CompositionSearchStatus,
    CompositionMatchResponse,
    ScanExtraction,
    CatalogueProduct,
    IngredientRole,
)

_UNIT_ALIASES = {
    "µg": "mcg",
    "μg": "mcg",
    "ug": "mcg",
    "mcg": "mcg",
    "mg": "mg",
    "g": "g",
    "iu": "iu",
    "ml": "ml",
    "%": "%",
}
_NAME_CLEANER = re.compile(r"[^\w]+", re.UNICODE)


class CompositionNotComparable(ValueError):
    """Raised when the scan does not contain a complete, reliable composition."""


def normalise_ingredient(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold().strip()
    # Remove punctuation/spacing only. Salt and chemical-form words remain significant.
    return _NAME_CLEANER.sub("", value)


def normalise_strength(value: str, unit: str) -> tuple[str, str]:
    amount_text = value.strip().replace(",", ".")
    try:
        amount = Decimal(amount_text)
    except InvalidOperation as exc:
        raise CompositionNotComparable("An ingredient strength is not numeric.") from exc
    if not amount.is_finite() or amount <= 0:
        raise CompositionNotComparable("Ingredient strength must be a positive finite number.")

    raw_unit = unicodedata.normalize("NFKC", unit).casefold().strip()
    canonical_unit = _UNIT_ALIASES.get(raw_unit)
    if canonical_unit is None:
        raise CompositionNotComparable(f"Unsupported strength unit: {unit}")

    # Canonicalise mass strengths to mg. IU and percentage units remain separate
    # because conversion can be substance-specific or context-dependent.
    if canonical_unit == "g":
        amount *= Decimal("1000")
        canonical_unit = "mg"
    elif canonical_unit == "mcg":
        amount /= Decimal("1000")
        canonical_unit = "mg"

    canonical_amount = format(amount.normalize(), "f")
    return canonical_amount, canonical_unit


def component_signature(
    components: list[CompositionComponent],
    *,
    require_confidence: bool,
) -> tuple[tuple[str, str, str], ...]:
    if not components:
        raise CompositionNotComparable("No structured composition components were extracted.")

    active: list[tuple[str, str, str]] = []
    unknown_role = False
    for component in components:
        role = component.ingredient_role
        if role == IngredientRole.INACTIVE or role == IngredientRole.INACTIVE.value:
            continue
        if role != IngredientRole.ACTIVE and role != IngredientRole.ACTIVE.value:
            unknown_role = True
            continue

        # The photographed pack generally has no buyer-catalogue ingredient ID.
        # Use a strict normalised printed name for cross-system comparison; buyer
        # ingredient keys remain metadata until a trusted name-to-key map is supplied.
        ingredient_key = normalise_ingredient(component.ingredient_name)
        if not ingredient_key:
            raise CompositionNotComparable("An active ingredient has no usable name or key.")
        amount, unit = normalise_strength(component.strength_value, component.strength_unit)

        if require_confidence and (
            component.confidence is None or component.confidence < 0.70
        ):
            raise CompositionNotComparable("One or more scanned ingredients are not clear enough.")

        active.append((ingredient_key, amount, unit))

    if unknown_role:
        raise CompositionNotComparable(
            "The active/inactive role of one or more composition entries is unknown."
        )
    if not active:
        raise CompositionNotComparable("No confirmed active-ingredient components are available.")
    if len(active) != len(set(active)):
        raise CompositionNotComparable("The composition contains duplicate component entries.")

    return tuple(sorted(active))


def signature_hash(signature: tuple[tuple[str, str, str], ...]) -> str:
    raw = json.dumps(signature, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class CompositionGroupMatcher:
    """Find all exact structured active-composition records in one buyer catalogue.

    This compares catalogue data only. It is not a clinical interchangeability or
    patient-specific suitability assessment.
    """

    def match(
        self,
        extraction: ScanExtraction,
        products: list[CatalogueProduct],
        *,
        scan_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> CompositionMatchResponse:
        try:
            requested_signature = component_signature(
                extraction.composition_components,
                require_confidence=True,
            )
        except CompositionNotComparable as exc:
            return CompositionMatchResponse(
                scan_id=scan_id,
                status=CompositionSearchStatus.UNABLE_TO_COMPARE,
                message=str(exc),
                page=page,
                page_size=page_size,
            )

        candidates: list[CompositionMatchCandidate] = []
        seen_ids: set[str] = set()
        for product in products:
            if product.product_id in seen_ids:
                continue
            seen_ids.add(product.product_id)
            try:
                candidate_signature = component_signature(
                    product.composition_components,
                    require_confidence=False,
                )
            except CompositionNotComparable:
                continue
            if candidate_signature != requested_signature:
                continue

            differences: list[str] = []
            missing: list[str] = []
            for field_name in ("dosage_form_text", "release_type_text", "route_text"):
                scanned = getattr(extraction, field_name).value
                catalogue_value = getattr(product, field_name)
                if scanned and catalogue_value:
                    if normalise_ingredient(scanned) != normalise_ingredient(catalogue_value):
                        differences.append(field_name)
                else:
                    # Missing on either side is visible; do not assume a formulation
                    # detail is the same just because the catalogue has no value.
                    missing.append(field_name)

            status = (
                CompositionMatchStatus.FORMULATION_DIFFERENCE
                if differences
                else CompositionMatchStatus.EXACT
            )
            matched_components = [
                f"{component.ingredient_name} {component.strength_value} {component.strength_unit}"
                for component in extraction.composition_components
                if component.ingredient_role == IngredientRole.ACTIVE
            ]
            explanation = (
                "Every normalised active-ingredient name and per-ingredient strength matches "
                "the buyer's catalogue record."
            )
            if differences:
                explanation += " Formulation details differ: " + ", ".join(differences) + "."
            if missing:
                explanation += " Catalogue details are missing for: " + ", ".join(missing) + "."

            candidates.append(
                CompositionMatchCandidate(
                    product=product,
                    status=status,
                    matched_components=matched_components,
                    different_fields=differences,
                    missing_fields=missing,
                    explanation=explanation,
                    review_required=True,
                )
            )

        # Buyer-supplied reference-brand classification is a grouping label, not a clinical rank.
        brand_order = {"reference": 0, "other": 1, "unknown": 2}
        candidates.sort(
            key=lambda item: (
                brand_order.get(str(item.product.brand_category.value if hasattr(item.product.brand_category, "value") else item.product.brand_category), 2),
                item.product.display_name.casefold(),
                item.product.product_id,
            )
        )

        # The buyer adapter has already applied page/page_size. Do not slice a
        # second time here: doing so would make page 2+ incorrectly return no rows.
        matches_in_page = len(candidates)
        return CompositionMatchResponse(
            scan_id=scan_id,
            status=(
                CompositionSearchStatus.MATCHES_FOUND
                if matches_in_page
                else CompositionSearchStatus.NO_MATCHES
            ),
            composition_signature=signature_hash(requested_signature),
            matches_in_page=matches_in_page,
            page=page,
            page_size=page_size,
            matches=candidates,
            message=(
                "These buyer-catalogue records have the same recorded active-ingredient "
                "set and strengths. This is catalogue information, not confirmation that "
                "any product is suitable for a particular person. Request the next page "
                "when this page is full."
                if matches_in_page
                else "No exact structured active-composition records were found on this catalogue page."
            ),
        )
