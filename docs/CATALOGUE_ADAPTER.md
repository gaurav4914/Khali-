# Buyer Catalogue Adapter Contract

The engine does not ship or operate a medicine database. Every buyer connects its own authorised catalogue through a read-only adapter. The buyer's catalogue remains the source of truth.

## Required buyer endpoints

Configure:

```env
CATALOGUE_MODE=rest
CATALOGUE_BASE_URL=https://buyer.example/api
CATALOGUE_API_KEY=buyer-owned-read-only-token
CATALOGUE_TIMEOUT_SECONDS=8
```

The current REST adapter calls:

- `GET /products?query=<printed-name>&barcode=<barcode>` for exact product identity lookup.
- `POST /products/search-by-composition` for exact structured composition-group discovery.
- `GET /products/{product_id}` for a single catalogue record.

The composition search uses POST only because the structured component array is larger than a convenient query string. It is a read-only search operation: the buyer endpoint must not create or modify catalogue records.

## Composition search request

~~~json
{
  "components": [
    {
      "ingredient_key": null,
      "ingredient_name": "Ingredient A",
      "ingredient_role": "active",
      "strength_value": "500",
      "strength_unit": "mg"
    },
    {
      "ingredient_key": null,
      "ingredient_name": "Ingredient B",
      "ingredient_role": "active",
      "strength_value": "10",
      "strength_unit": "mg"
    }
  ],
  "page": 1,
  "page_size": 50
}
~~~

These are schema examples only, not actual medicine data. The buyer endpoint should query its own structured component table/index and return every record in the requested page that has the same complete active-component set and per-component strengths. It should not return a result merely because one ingredient overlaps.

## Example catalogue response

~~~json
{
  "items": [
    {
      "product_id": "buyer-record-001",
      "display_name": "Example Reference Brand",
      "brand_name": "Example Reference Brand",
      "brand_category": "reference",
      "composition_text": "Ingredient A 500 mg + Ingredient B 10 mg",
      "composition_components": [
        {
          "ingredient_key": "buyer-ingredient-a",
          "ingredient_name": "Ingredient A",
          "ingredient_role": "active",
          "strength_value": "500",
          "strength_unit": "mg"
        },
        {
          "ingredient_key": "buyer-ingredient-b",
          "ingredient_name": "Ingredient B",
          "ingredient_role": "active",
          "strength_value": "10",
          "strength_unit": "mg"
        }
      ],
      "dosage_form_text": "Tablet",
      "release_type_text": "Immediate release",
      "route_text": "Oral",
      "manufacturer": "Buyer catalogue value",
      "product_status": "active",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ]
}
~~~

The response may be an array or an object containing an `items` array. Every returned product must include `product_id`, `display_name`, and structured `composition_components` for composition matching.

## Component data contract

Each composition component should include:

- `ingredient_key`: buyer-owned canonical identifier, when the buyer has one.
- `ingredient_name`: the buyer's canonical display name.
- `ingredient_role`: `active`, `inactive`, or `unknown`.
- `strength_value`: numeric value as text.
- `strength_unit`: unit as text.

The engine compares all confirmed active components. Inactive components are not included in the active-composition signature. A record with unknown ingredient roles or missing strengths cannot be labelled an exact composition match.

The initial matcher uses strict normalised ingredient names so a photographed label can match the buyer catalogue even when the scanner does not know the buyer's internal ingredient IDs. It preserves salt/chemical-form words. No synonym or salt-form equivalence is inferred automatically. A buyer may add a reviewed canonical name-to-key mapping in a future adapter version.

## Brand labels

The engine does not infer that a product is famous, popular, original, or a substitute. The buyer may supply:

- `brand_category: "reference"`
- `brand_category: "other"`
- `brand_category: "unknown"`

The UI uses this field only as a catalogue metadata label for grouping/display order. It is not a clinical ranking.

## What the adapter must guarantee

- Results come only from the buyer's own authorised catalogue.
- Search is read-only.
- Composition queries return all matching records in the requested page.
- Returned composition components are structured, complete, and accurate to the buyer's catalogue.
- The endpoint does not use an "any one ingredient matches" condition.
- The engine independently verifies every returned candidate before including it.
- Missing catalogue components are not guessed from the product name.
- Pagination is respected.

## Security requirements

- Use a buyer-owned, read-only API credential.
- Restrict access to the minimum product data needed.
- Use HTTPS in production.
- Never expose the catalogue credential to the mobile app.
- Never use a database superuser or write access.
- Do not let model-generated text become SQL or executable query syntax.
- Do not scrape private application screens or access data without permission.

## Adding another adapter

Implement the `CatalogueAdapter` protocol in `backend/app/catalogue.py` or a new module. It must implement `search`, `search_by_composition`, and `get_product`, validate external data with `CatalogueProduct`, and raise `CatalogueAdapterError` for upstream failures.
