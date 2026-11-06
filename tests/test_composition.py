import pytest

from app.composition import CompositionGroupMatcher, CompositionNotComparable, component_signature
from app.schemas import (
    BrandCategory,
    CatalogueProduct,
    CompositionComponent,
    CompositionMatchStatus,
    CompositionSearchStatus,
    ExtractedField,
    FormulationComparisonLabel,
    IngredientRole,
    ScanExtraction,
)


def component(
    name,
    amount,
    unit="mg",
    *,
    key=None,
    role=IngredientRole.ACTIVE,
    confidence=None,
    basis_amount=None,
    basis_unit=None,
):
    return CompositionComponent(
        ingredient_key=key,
        ingredient_name=name,
        ingredient_role=role,
        strength_value=amount,
        strength_unit=unit,
        strength_basis_amount=basis_amount,
        strength_basis_unit=basis_unit,
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
    assert result.matches_in_page == 2
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
    assert result.matches[0].comparison_label == FormulationComparisonLabel.DOSAGE_FORM_DIFFERS.value
    assert "dosage_form_text" in result.matches[0].different_fields
    assert len(result.formulation_difference_matches) == 1
    assert len(result.exact_matches) == 0


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
    assert result.matches_in_page == 1


def test_mass_unit_aliases_are_normalised_to_milligrams():
    mg = component("Ingredient A", "500", "mg", confidence=0.95)
    mcg = component("Ingredient A", "500000", "mcg", confidence=0.95)
    assert component_signature([mg], require_confidence=True) == component_signature(
        [mcg], require_confidence=True
    )


def test_strength_basis_distinguishes_per_tablet_per_5ml_and_per_ml():
    per_tablet = component("Amoxicillin", "250", "mg", basis_amount="1", basis_unit="tablet", confidence=0.95)
    per_5ml = component("Amoxicillin", "250", "mg", basis_amount="5", basis_unit="ml", confidence=0.95)
    per_1ml = component("Amoxicillin", "250", "mg", basis_amount="1", basis_unit="ml", confidence=0.95)

    sig_tab = component_signature([per_tablet], require_confidence=True)
    sig_5ml = component_signature([per_5ml], require_confidence=True)
    sig_1ml = component_signature([per_1ml], require_confidence=True)

    assert sig_tab != sig_5ml
    assert sig_5ml != sig_1ml
    assert sig_tab != sig_1ml


def test_iu_and_percentage_units_do_not_convert_to_milligrams():
    iu_comp = component("Cholecalciferol", "500", "IU", confidence=0.95)
    mg_comp = component("Cholecalciferol", "500", "mg", confidence=0.95)
    pct_ww = component("Diclofenac Diethylamine", "5", "%", basis_unit="w/w", confidence=0.95)

    assert component_signature([iu_comp], require_confidence=True) != component_signature(
        [mg_comp], require_confidence=True
    )
    assert component_signature([iu_comp], require_confidence=True) != component_signature(
        [pct_ww], require_confidence=True
    )


def test_extra_or_missing_active_ingredient_is_rejected_in_three_component_combination():
    scan_three = ScanExtraction(
        composition_components=[
            component("Aceclofenac", "100", "mg", confidence=0.95),
            component("Paracetamol", "325", "mg", confidence=0.95),
            component("Serratiopeptidase", "15", "mg", confidence=0.95),
        ]
    )
    catalogue = [
        product(
            "exact-3",
            "Triple Match",
            [
                component("Serratiopeptidase", "15", "mg"),
                component("Aceclofenac", "100", "mg"),
                component("Paracetamol", "325", "mg"),
            ],
        ),
        product(
            "only-2",
            "Missing Third Ingredient",
            [
                component("Aceclofenac", "100", "mg"),
                component("Paracetamol", "325", "mg"),
            ],
        ),
        product(
            "extra-4",
            "Extra Fourth Ingredient",
            [
                component("Aceclofenac", "100", "mg"),
                component("Paracetamol", "325", "mg"),
                component("Serratiopeptidase", "15", "mg"),
                component("Chlorzoxazone", "250", "mg"),
            ],
        ),
    ]
    result = CompositionGroupMatcher().match(scan_three, catalogue, scan_id="scan-triple")
    assert [m.product.product_id for m in result.matches] == ["exact-3"]


def test_duplicate_catalogue_product_ids_are_deduplicated():
    dup = product(
        "dup-1",
        "Duplicate Brand",
        [component("Paracetamol", "500"), component("Caffeine", "30")],
    )
    result = CompositionGroupMatcher().match(
        scanned_extraction(), [dup, dup], scan_id="scan-dup"
    )
    assert result.matches_in_page == 1


def test_second_page_is_not_sliced_twice_by_matcher():
    second_page_products = [
        product(
            f"page-2-{index}",
            f"Page 2 Brand {index}",
            [component("Paracetamol", "500"), component("Caffeine", "30")],
        )
        for index in range(3)
    ]
    result = CompositionGroupMatcher().match(
        scanned_extraction(),
        second_page_products,
        scan_id="scan-page-2",
        page=2,
        page_size=50,
    )
    assert result.page == 2
    assert result.matches_in_page == 3
    assert len(result.matches) == 3
