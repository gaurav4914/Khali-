import type {
  CatalogueIdentityResult,
  CatalogueProduct,
  ScanExtraction,
} from "../../sdk/react-native/src/types";

export function normaliseLabel(value?: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

function similarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  // Levenshtein distance
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return 1 - dp[a.length][b.length] / maxLen;
}

export class ExactProductIdentityResolver {
  resolve(
    extraction: ScanExtraction,
    products: CatalogueProduct[],
    barcode?: string | null,
  ): CatalogueIdentityResult[] {
    if (!products || products.length === 0) {
      return [];
    }

    if (barcode) {
      const barcodeMatches = products.filter(
        (p) => p.barcode && p.barcode === barcode,
      );
      if (barcodeMatches.length === 1) {
        return [
          {
            product: barcodeMatches[0],
            status: "exact_catalogue_identity",
            evidence: {
              matched_fields: ["barcode"],
              missing_fields: [],
              different_fields: [],
              explanation:
                "The scanned barcode exactly matches one buyer catalogue record.",
            },
            review_required: true,
          },
        ];
      }
      if (barcodeMatches.length > 1) {
        return barcodeMatches.map((p) => this.ambiguous(p, ["barcode"]));
      }
    }

    const printedName = extraction.printed_product_name?.value;
    const nameKey = normaliseLabel(printedName);
    if (!nameKey) {
      return [];
    }

    const exact = products.filter(
      (product) =>
        normaliseLabel(product.display_name) === nameKey ||
        normaliseLabel(product.brand_name) === nameKey,
    );

    if (exact.length === 1) {
      const matched = ["printed_product_name"];
      const missing: string[] = [];
      if (!extraction.manufacturer_text?.value || !exact[0].manufacturer) {
        missing.push("manufacturer");
      } else if (
        normaliseLabel(extraction.manufacturer_text.value).includes(
          normaliseLabel(exact[0].manufacturer),
        ) ||
        normaliseLabel(exact[0].manufacturer).includes(
          normaliseLabel(extraction.manufacturer_text.value),
        )
      ) {
        matched.push("manufacturer_text");
      }

      return [
        {
          product: exact[0],
          status: "exact_catalogue_identity",
          evidence: {
            matched_fields: matched,
            missing_fields: missing,
            different_fields: [],
            explanation:
              "The printed product/brand name exactly matches one buyer catalogue record after punctuation and case normalisation.",
          },
          review_required: true,
        },
      ];
    }

    if (exact.length > 1) {
      return exact.map((p) => this.ambiguous(p, ["printed_product_name"]));
    }

    const scored: Array<[number, CatalogueProduct]> = [];
    for (const product of products) {
      const candidates = [product.display_name, product.brand_name || ""].filter(
        Boolean,
      );
      const score = Math.max(
        ...candidates.map((name) => similarityRatio(nameKey, normaliseLabel(name))),
        0,
      );
      if (score >= 0.78) {
        scored.push([score, product]);
      }
    }

    scored.sort((a, b) => b[0] - a[0]);
    if (scored.length === 0) {
      return [];
    }

    const topScore = scored[0][0];
    const plausible = scored.filter(([score]) => topScore - score <= 0.04);

    return plausible.map(([, product]) => ({
      product,
      status:
        plausible.length === 1
          ? "likely_identity_review_required"
          : "multiple_possible_records",
      evidence: {
        matched_fields: ["similar_printed_product_name"],
        missing_fields: ["exact_barcode_or_exact_name_confirmation"],
        different_fields: [],
        explanation:
          "The printed name resembles this catalogue record but is not an exact identity match. Human verification is required.",
      },
      review_required: true,
    }));
  }

  private ambiguous(
    product: CatalogueProduct,
    matched: string[],
  ): CatalogueIdentityResult {
    return {
      product,
      status: "multiple_possible_records",
      evidence: {
        matched_fields: matched,
        missing_fields: ["unique_catalogue_identifier"],
        different_fields: [],
        explanation:
          "More than one buyer catalogue record matched the available identity evidence.",
      },
      review_required: true,
    };
  }
}
