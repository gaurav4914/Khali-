from app.identity import ExactProductIdentityResolver
from app.schemas import CatalogueProduct, ExtractedField, IdentityStatus, ScanExtraction


def test_exact_name_matches_single_catalogue_record():
    extraction = ScanExtraction(
        printed_product_name=ExtractedField(value="Example Brand 10"),
    )
    catalogue = [
        CatalogueProduct(product_id="p-1", display_name="Example Brand 10"),
        CatalogueProduct(product_id="p-2", display_name="Different Product"),
    ]
    result = ExactProductIdentityResolver().resolve(extraction, catalogue)
    assert len(result) == 1
    assert result[0].status == IdentityStatus.EXACT_IDENTITY
    assert result[0].product.product_id == "p-1"


def test_composition_alone_does_not_resolve_a_product():
    extraction = ScanExtraction(
        printed_composition_text=ExtractedField(value="Example Ingredient 10 mg"),
    )
    catalogue = [
        CatalogueProduct(
            product_id="p-1",
            display_name="Product One",
            composition_text="Example Ingredient 10 mg",
        )
    ]
    assert ExactProductIdentityResolver().resolve(extraction, catalogue) == []


def test_fuzzy_name_requires_review():
    extraction = ScanExtraction(
        printed_product_name=ExtractedField(value="Exampel Brand 10"),
    )
    catalogue = [CatalogueProduct(product_id="p-1", display_name="Example Brand 10")]
    result = ExactProductIdentityResolver().resolve(extraction, catalogue)
    assert len(result) == 1
    assert result[0].status == IdentityStatus.LIKELY_REVIEW
    assert result[0].review_required is True


def test_duplicate_exact_names_are_ambiguous():
    extraction = ScanExtraction(
        printed_product_name=ExtractedField(value="Example Brand"),
    )
    catalogue = [
        CatalogueProduct(product_id="p-1", display_name="Example Brand"),
        CatalogueProduct(product_id="p-2", brand_name="Example Brand", display_name="Different Pack"),
    ]
    result = ExactProductIdentityResolver().resolve(extraction, catalogue)
    assert len(result) == 2
    assert all(item.status == IdentityStatus.MULTIPLE for item in result)
