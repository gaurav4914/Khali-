import hashlib
import json
import re
import unicodedata
from decimal import Decimal, InvalidOperation

from .schemas import (
    CatalogueProduct,
    CompositionComponent,
    CompositionMatchCandidate,
    CompositionMatchResponse,
    CompositionMatchStatus,
    CompositionSearchStatus,
    FormulationComparisonLabel,
    IngredientRole,
    ScanExtraction,
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
    "%w/w": "% w/w",
    "% w/w": "% w/w",
    "%w/v": "% w/v",
    "% w/v": "% w/v",
}

_BASIS_UNIT_ALIASES = {
    "tab": "tablet",
    "tablet": "tablet",
    "tablets": "tablet",
    "cap": "capsule",
    "capsule": "capsule",
    "capsules": "capsule",
    "ml": "ml",
    "l": "l",
    "g": "g",
    "mg": "mg",
    "dose": "dose",
    "puff": "puff",
    "actuation": "actuation",
    "drop": "drop",
    "sachet": "sachet",
    "vial": "vial",
    "ampoule": "ampoule",
    "w/w": "w/w",
    "w/v": "w/v",
    "v/v": "v/v",
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
    raw_unit = re.sub(r"\s+", " ", raw_unit)
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


def normalise_basis(
    basis_amount: str | None,
    basis_unit: str | None,
) -> tuple[str, str]:
    if not basis_amount and not basis_unit:
        return "", ""
    if not basis_unit:
        raise CompositionNotComparable("Strength basis unit is missing for a basis amount.")

    raw_basis_unit = unicodedata.normalize("NFKC", basis_unit).casefold().strip()
    canonical_basis_unit = _BASIS_UNIT_ALIASES.get(raw_basis_unit)
    if canonical_basis_unit is None:
        raise CompositionNotComparable(f"Unsupported strength basis unit: {basis_unit}")

    if not basis_amount:
        if canonical_basis_unit in {"w/w", "w/v", "v/v"}:
            return "", canonical_basis_unit
        return "1", canonical_basis_unit

    amount_text = basis_amount.strip().replace(",", ".")
    try:
        amount = Decimal(amount_text)
    except InvalidOperation as exc:
        raise CompositionNotComparable("Strength basis amount is not numeric.") from exc
    if not amount.is_finite() or amount <= 0:
        raise CompositionNotComparable("Strength basis amount must be a positive finite number.")

    if canonical_basis_unit == "l":
        amount *= Decimal("1000")
        canonical_basis_unit = "ml"

    return format(amount.normalize(), "f"), canonical_basis_unit


def component_signature(
    components: list[CompositionComponent],
    *,
    require_confidence: bool,
    canonical_map: dict[str, str] | None = None,
) -> tuple[tuple[str, str, str, str, str], ...]:
    if not components:
        raise CompositionNotComparable("No structured composition components were extracted.")

    active: list[tuple[str, str, str, str, str]] = []
    unknown_role = False
    for component in components:
        role = component.ingredient_role
        if role == IngredientRole.INACTIVE or role == IngredientRole.INACTIVE.value:
            continue
        if role != IngredientRole.ACTIVE and role != IngredientRole.ACTIVE.value:
            unknown_role = True
            continue

        normalised_name = normalise_ingredient(component.ingredient_name)
        if not normalised_name:
            raise CompositionNotComparable("An active ingredient has no usable name or key.")

        # Use buyer-approved canonical mapping only when explicitly provided.
        if canonical_map and normalised_name in canonical_map:
            ingredient_identity = canonical_map[normalised_name]
        elif canonical_map and component.ingredient_key and component.ingredient_key in canonical_map.values():
            ingredient_identity = component.ingredient_key
        else:
            ingredient_identity = normalised_name

        amount, unit = normalise_strength(component.strength_value, component.strength_unit)
        basis_amount, basis_unit = normalise_basis(
            component.strength_basis_amount,
            component.strength_basis_unit,
        )

        # Ensure "% w/w" in unit vs "% + basis w/w" normalises consistently
        if unit in {"% w/w", "% w/v"} and not basis_unit:
            basis_unit = unit.split()[1]
            unit = "%"

        if require_confidence and (
            component.confidence is None or component.confidence < 0.70
        ):
            raise CompositionNotComparable("One or more scanned ingredients are not clear enough.")

        active.append((ingredient_identity, amount, unit, basis_amount, basis_unit))

    if unknown_role:
        raise CompositionNotComparable(
            "The active/inactive role of one or more composition entries is unknown."
        )
    if not active:
        raise CompositionNotComparable("No confirmed active-ingredient components are available.")
    if len(active) != len(set(active)):
        raise CompositionNotComparable("The composition contains duplicate component entries.")

    return tuple(sorted(active))


def signature_hash(signature: tuple[tuple[str, ...], ...]) -> str:
    raw = json.dumps(signature, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _format_comparison_label(differences: list[str]) -> str:
    if not differences:
        return FormulationComparisonLabel.EXACT_FORMULATION.value
    if len(differences) > 1:
        return FormulationComparisonLabel.MULTIPLE_FORMULATION_DIFFERENCES.value
    diff = differences[0]
    if diff == "dosage_form_text":
        return FormulationComparisonLabel.DOSAGE_FORM_DIFFERS.value
    if diff == "release_type_text":
        return FormulationComparisonLabel.RELEASE_TYPE_DIFFERS.value
    if diff == "route_text":
        return FormulationComparisonLabel.ROUTE_DIFFERS.value
    return FormulationComparisonLabel.MULTIPLE_FORMULATION_DIFFERENCES.value


def _format_component_display(component: CompositionComponent) -> str:
    base = f"{component.ingredient_name} {component.strength_value} {component.strength_unit}"
    if component.strength_basis_unit:
        if component.strength_basis_amount and component.strength_basis_amount != "1":
            return f"{base} per {component.strength_basis_amount} {component.strength_basis_unit}"
        if component.strength_basis_unit in {"w/w", "w/v", "v/v"}:
            return f"{base} {component.strength_basis_unit}"
        return f"{base} per {component.strength_basis_unit}"
    return base


class CompositionGroupMatcher:
    """Find all exact structured active-composition records in one buyer catalogue.

    This compares catalogue data only. It is not a clinical interchangeability or
    patient-specific suitability assessment.
    """

    def __init__(
        self,
        *,
        canonical_map: dict[str, str] | None = None,
        mapping_version: str = "2026.11-strict-literal-v1",
    ) -> None:
        self.canonical_map = canonical_map
        self.mapping_version = mapping_version

    def match(
        self,
        extraction: ScanExtraction,
        products: list[CatalogueProduct],
        *,
        scan_id: str,
        page: int = 1,
        page_size: int = 50,
        has_more: bool = False,
        next_cursor: str | None = None,
    ) -> CompositionMatchResponse:
        if "composition_components" in extraction.field_conflicts:
            return CompositionMatchResponse(
                scan_id=scan_id,
                composition_parse_status="conflict",
                status=CompositionSearchStatus.UNABLE_TO_COMPARE,
                message="Conflicting composition readings were detected across captures. Take a clear close-up photo.",
                page=page,
                page_size=page_size,
                mapping_version=self.mapping_version,
            )

        try:
            requested_signature = component_signature(
                extraction.composition_components,
                require_confidence=True,
                canonical_map=self.canonical_map,
            )
        except CompositionNotComparable as exc:
            return CompositionMatchResponse(
                scan_id=scan_id,
                composition_parse_status=extraction.composition_parse_status or "unable_to_compare",
                status=CompositionSearchStatus.UNABLE_TO_COMPARE,
                message=str(exc),
                page=page,
                page_size=page_size,
                mapping_version=self.mapping_version,
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
                    canonical_map=self.canonical_map,
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
            comparison_label = _format_comparison_label(differences)
            matched_components = [
                _format_component_display(component)
                for component in extraction.composition_components
                if component.ingredient_role == IngredientRole.ACTIVE
                or component.ingredient_role == IngredientRole.ACTIVE.value
            ]
            explanation = (
                "Every normalised active-ingredient name, per-ingredient strength, and "
                "strength basis matches the buyer's catalogue record."
            )
            if differences:
                explanation += " Formulation details differ: " + ", ".join(differences) + "."
            if missing:
                explanation += " Catalogue details are missing for: " + ", ".join(missing) + "."

            candidates.append(
                CompositionMatchCandidate(
                    product=product,
                    status=status,
                    comparison_label=comparison_label,
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
                brand_order.get(
                    str(
                        item.product.brand_category.value
                        if hasattr(item.product.brand_category, "value")
                        else item.product.brand_category
                    ),
                    2,
                ),
                item.product.display_name.casefold(),
                item.product.product_id,
            )
        )

        exact_matches = [
            item for item in candidates if item.status == CompositionMatchStatus.EXACT
        ]
        formulation_difference_matches = [
            item
            for item in candidates
            if item.status == CompositionMatchStatus.FORMULATION_DIFFERENCE
        ]

        # The buyer adapter has already applied page/page_size. Do not slice a
        # second time here: doing so would make page 2+ incorrectly return no rows.
        matches_in_page = len(candidates)
        return CompositionMatchResponse(
            scan_id=scan_id,
            composition_parse_status=extraction.composition_parse_status or "parsed",
            status=(
                CompositionSearchStatus.MATCHES_FOUND
                if matches_in_page
                else CompositionSearchStatus.NO_MATCHES
            ),
            composition_signature=signature_hash(requested_signature),
            matches_in_page=matches_in_page,
            page=page,
            page_size=page_size,
            has_more=has_more,
            next_cursor=next_cursor,
            mapping_version=self.mapping_version,
            exact_matches=exact_matches,
            formulation_difference_matches=formulation_difference_matches,
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
