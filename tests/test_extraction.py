from app.extraction import extract_printed_fields
from app.ocr import OCRDocument
from app.schemas import IngredientRole


def doc(text: str, confidence: float = 0.95) -> OCRDocument:
    return OCRDocument(text=text, mean_confidence=confidence, provider="test")


def test_extracts_multiple_components_from_explicit_each_tablet_contains_label():
    result = extract_printed_fields([
        (
            "front-1",
            doc("Sample Brand\nEach tablet contains: Ingredient A 500 mg + Ingredient B 10 mg"),
        )
    ])

    assert result.printed_product_name.value == "Sample Brand"
    assert [item.ingredient_name for item in result.composition_components] == [
        "Ingredient A",
        "Ingredient B",
    ]
    assert all(
        item.ingredient_role == IngredientRole.ACTIVE for item in result.composition_components
    )
    assert all(
        item.strength_basis_unit == "tablet" and item.strength_basis_amount == "1"
        for item in result.composition_components
    )
    assert all(
        item.source_capture_ids == ["front-1"] for item in result.composition_components
    )


def test_extracts_per_5ml_basis_from_syrup_heading():
    result = extract_printed_fields([
        (
            "front-syrup",
            doc(
                "Paediatric Suspension\n"
                "Each 5 ml contains:\n"
                "Paracetamol IP 250 mg\n"
                "Excipients q.s."
            ),
        )
    ])

    assert len(result.composition_components) == 1
    comp = result.composition_components[0]
    assert comp.ingredient_name == "Paracetamol"
    assert comp.strength_value == "250"
    assert comp.strength_unit == "mg"
    assert comp.strength_basis_amount == "5"
    assert comp.strength_basis_unit == "ml"


def test_generic_composition_heading_does_not_guess_active_role():
    result = extract_printed_fields([
        ("back-1", doc("Sample Brand\nComposition: Ingredient A 500 mg"))
    ])

    assert len(result.composition_components) == 1
    assert result.composition_components[0].ingredient_role == IngredientRole.UNKNOWN


def test_excipients_section_stops_active_component_capture():
    result = extract_printed_fields([
        (
            "back-1",
            doc(
                "Sample Brand\nEach tablet contains: Ingredient A 500 mg\n"
                "Excipients: Ingredient B 100 mg"
            ),
        )
    ])

    assert [item.ingredient_name for item in result.composition_components] == ["Ingredient A"]


def test_conflicting_composition_photos_are_not_silently_merged():
    result = extract_printed_fields([
        ("front", doc("Sample Brand\nEach tablet contains: Ingredient A 500 mg")),
        ("back", doc("Each tablet contains: Ingredient A 250 mg")),
    ])

    assert result.composition_components == []
    assert "composition_components" in result.field_conflicts
    assert result.composition_parse_status == "conflict"


def test_extracts_hindi_and_mixed_script_labels():
    result = extract_printed_fields([
        (
            "front-hi",
            doc(
                "कालपोल 500 टैबलेट\n"
                "प्रत्येक टैबलेट में: पैरासिटामोल 500 mg\n"
                "निर्माता: सिंथेटिक फार्मा लिमिटेड"
            ),
        )
    ])

    assert result.printed_product_name.value == "कालपोल 500 टैबलेट"
    assert len(result.composition_components) == 1
    assert result.composition_components[0].ingredient_name == "पैरासिटामोल"
    assert result.composition_components[0].ingredient_role == IngredientRole.ACTIVE
    assert result.composition_components[0].strength_basis_unit == "tablet"
    assert result.manufacturer_text.value == "निर्माता: सिंथेटिक फार्मा लिमिटेड"
