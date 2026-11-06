from app.composition import CompositionGroupMatcher
from app.schemas import (
    BrandCategory,
    CatalogueProduct,
    CompositionComponent,
    CompositionMatchStatus,
    CompositionSearchStatus,
    ExtractedField,
    IngredientRole,
    ScanExtraction,
)


def component(name, amount, unit="mg", *, key=None, role=IngredientRole.ACTIVE, confidence=None):
    return CompositionComponent(
        ingredient_key=key,
        ingredient_name=name,
        ingredient_role=role,
        strength_value=amount,
        strength_unit=unit,
        confidence=confidence,
    )


def scanned_extraction():
    return ScanExtraction(
        composition_components=[
            component("Paracetamol", "500", confidence=0.96),
            component("Caffeine", "30", confidence=0.94),
        ],
        dosage_form_text=ExtractedField(value="Tablet", confidence=0.90),
        review_required=True,
    )


def product(product_id, name, components, **kwargs):
    return CatalogueProduct(
        product_id=product_id,
        display_name=name,
        composition_components=components,
        **kwargs,
    )


def test_returns_all_records_with_exact_active_composition_regardless_of_component_order():
    catalogue = [
        product(
            "ref-1",
            "Reference Brand",
            [
                component("Paracetamol", "500"),
                component("Caffeine", "30"),
            ],
            brand_category=BrandCategory.REFERENCE,
            dosage_form_text="Tablet",
        ),
        product(
            "other-1",
            "Other Brand",
            [
                component("Caffeine", "30"),
                component("Paracetamol", "0.5", "g"),
            ],
            brand_category=BrandCategory.OTHER,
            dosage_form_text="Tablet",
        ),
        product(
            "wrong-strength",
            "Wrong Strength",
            [
                component("Paracetamol", "650"),
                component("Caffeine", "30"),
            ],
        ),
        product(
            "wrong-salt",
            "Different Chemical Form",
            [
                component("Paracetamol sodium", "500"),
                component("Caffeine", "30"),
            ],
        ),
    ]

    result = CompositionGroupMatcher().match(
        scanned_extraction(), catalogue, scan_id="scan-1"
    )

    assert result.status == CompositionSearchStatus.MATCHES_FOUND
    assert result.total_matches == 2
    assert [item.product.product_id for item in result.matches] == ["ref-1", "other-1"]
    assert all(item.review_required for item in result.matches)


def test_formulation_difference_is_visible_not_hidden():
    catalogue = [
        product(
            "capsule-1",
            "Capsule Brand",
            [component("Paracetamol", "500"), component("Caffeine", "30")],
            dosage_form_text="Capsule",
        )
    ]
    result = CompositionGroupMatcher().match(
        scanned_extraction(), catalogue, scan_id="scan-2"
    )
    assert len(result.matches) == 1
    assert result.matches[0].status == CompositionMatchStatus.FORMULATION_DIFFERENCE
    assert "dosage_form_text" in result.matches[0].different_fields


def test_unknown_role_or_low_ocr_confidence_cannot_create_exact_composition_match():
    unknown = ScanExtraction(
        composition_components=[component("Paracetamol", "500", role=IngredientRole.UNKNOWN, confidence=0.99)]
    )
    low_confidence = ScanExtraction(
        composition_components=[component("Paracetamol", "500", confidence=0.4)]
    )
    matcher = CompositionGroupMatcher()

    assert matcher.match(unknown, [], scan_id="scan-3").status == CompositionSearchStatus.UNABLE_TO_COMPARE
    assert matcher.match(low_confidence, [], scan_id="scan-4").status == CompositionSearchStatus.UNABLE_TO_COMPARE


def test_missing_catalogue_components_are_not_guessed():
    catalogue = [
        CatalogueProduct(
            product_id="missing",
            display_name="Missing Composition",
            composition_text="Paracetamol 500 mg + Caffeine 30 mg",
        )
    ]
    result = CompositionGroupMatcher().match(
        scanned_extraction(), catalogue, scan_id="scan-5"
    )
    assert result.status == CompositionSearchStatus.NO_MATCHES
    assert result.matches == []


def test_inactive_excipients_do_not_change_the_active_signature():
    catalogue = [
        product(
            "with-excipient",
            "Brand With Excipient",
            [
                component("Paracetamol", "500"),
                component("Caffeine", "30"),
                component("Microcrystalline cellulose", "1", role=IngredientRole.INACTIVE),
            ],
        )
    ]
    result = CompositionGroupMatcher().match(
        scanned_extraction(), catalogue, scan_id="scan-6"
    )
    assert result.total_matches == 1
