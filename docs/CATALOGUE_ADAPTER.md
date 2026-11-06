# Buyer Catalogue Adapter Contract

The engine does not ship a medicine database. Each buyer connects its own authorised catalogue through a read-only adapter.

## REST adapter

Set:

```env
CATALOGUE_MODE=rest
CATALOGUE_BASE_URL=https://buyer.example/api
CATALOGUE_API_KEY=buyer-owned-token
CATALOGUE_TIMEOUT_SECONDS=8
```

The adapter calls:

- `GET /products?query=<printed-name>&barcode=<barcode>`
- `GET /products/{product_id}`

The search endpoint may return either a JSON array or:

```json
{
  "items": [
    {
      "product_id": "buyer-record-123",
      "display_name": "Exact catalogue product name",
      "brand_name": "Brand as stored by buyer",
      "barcode": "buyer-supplied-code",
      "composition_text": "Literal catalogue composition text",
      "strength_text": "Literal catalogue strength text",
      "dosage_form_text": "Tablet",
      "manufacturer": "Manufacturer as stored by buyer",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

This JSON is a contract example, not a medicine record. Do not copy example values into a real catalogue.

## Required fields

`product_id` and `display_name` are required. Other fields are optional. Missing fields remain missing in the engine response.

## Security requirements

- Use a buyer-owned, read-only API credential.
- Restrict access to the minimum product data needed for identity lookup.
- Use HTTPS in production.
- Do not expose the credential to the mobile app.
- Do not provide a database superuser or write access.
- Do not let model-generated text become SQL or executable query syntax.
- Do not scrape private application screens or access data without written permission.

## Adding another adapter

Implement the `CatalogueAdapter` protocol in `backend/app/catalogue.py` or a new module. The adapter must implement async `search(query, barcode)` and `get_product(product_id)`, validate external data with `CatalogueProduct`, and raise `CatalogueAdapterError` for upstream failures.
