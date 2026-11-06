import re
from difflib import SequenceMatcher

from .schemas import (
    CatalogueIdentityResult,
    CatalogueProduct,
    IdentityEvidence,
    IdentityStatus,
    ScanExtraction,
)


def normalise_label(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


class ExactProductIdentityResolver:
    """Resolve the item photographed; never recommend a different product.

    Composition text is evidence shown to reviewers, not a key for treating
    different catalogue products as the same product.
    """

    def resolve(
        self,
        extraction: ScanExtraction,
        products: list[CatalogueProduct],
        barcode: str | None = None,
    ) -> list[CatalogueIdentityResult]:
        if not products:
            return []

        if barcode:
            barcode_matches = [p for p in products if p.barcode and p.barcode == barcode]
            if len(barcode_matches) == 1:
                product = barcode_matches[0]
                return [CatalogueIdentityResult(
                    product=product,
                    status=IdentityStatus.EXACT_IDENTITY,
                    evidence=IdentityEvidence(
                        matched_fields=["barcode"],
                        explanation="The scanned barcode exactly matches one buyer catalogue record.",
                    ),
                    review_required=True,
                )]
            if len(barcode_matches) > 1:
                return [self._ambiguous(p, ["barcode"]) for p in barcode_matches]

        printed_name = extraction.printed_product_name.value
        name_key = normalise_label(printed_name)
        if not name_key:
            return []

        exact = [
            product for product in products
            if normalise_label(product.display_name) == name_key
            or normalise_label(product.brand_name) == name_key
        ]
        if len(exact) == 1:
            product = exact[0]
            return [CatalogueIdentityResult(
                product=product,
                status=IdentityStatus.EXACT_IDENTITY,
                evidence=IdentityEvidence(
                    matched_fields=["printed_product_name"],
                    explanation="The printed product/brand name exactly matches one buyer catalogue record after punctuation and case normalisation.",
                ),
                review_required=True,
            )]
        if len(exact) > 1:
            return [self._ambiguous(p, ["printed_product_name"]) for p in exact]

        scored: list[tuple[float, CatalogueProduct]] = []
        for product in products:
            candidates = [product.display_name, product.brand_name or ""]
            score = max(
                (
                    SequenceMatcher(None, name_key, normalise_label(name)).ratio()
                    for name in candidates if name
                ),
                default=0.0,
            )
            if score >= 0.78:
                scored.append((score, product))
        scored.sort(key=lambda item: item[0], reverse=True)

        if not scored:
            return []
        top_score = scored[0][0]
        plausible = [item for item in scored if top_score - item[0] <= 0.04]
        return [
            CatalogueIdentityResult(
                product=product,
                status=IdentityStatus.LIKELY_REVIEW if len(plausible) == 1 else IdentityStatus.MULTIPLE,
                evidence=IdentityEvidence(
                    matched_fields=["similar_printed_product_name"],
                    missing_fields=["exact_barcode_or_exact_name_confirmation"],
                    explanation="The printed name resembles this catalogue record but is not an exact identity match. Human verification is required.",
                ),
                review_required=True,
            )
            for _, product in plausible
        ]

    @staticmethod
    def _ambiguous(product: CatalogueProduct, matched: list[str]):
        return CatalogueIdentityResult(
            product=product,
            status=IdentityStatus.MULTIPLE,
            evidence=IdentityEvidence(
                matched_fields=matched,
                missing_fields=["unique_catalogue_identifier"],
                explanation="More than one buyer catalogue record matched the available identity evidence.",
            ),
            review_required=True,
        )
