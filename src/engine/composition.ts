import crypto from "crypto";
import type {
  CatalogueProduct,
  CompositionComponent,
  CompositionMatchCandidate,
  CompositionMatchResponse,
  ScanExtraction,
} from "../../sdk/react-native/src/types";

const UNIT_ALIASES: Record<string, string> = {
  "µg": "mcg",
  "μg": "mcg",
  ug: "mcg",
  mcg: "mcg",
  mg: "mg",
  g: "g",
  iu: "iu",
  ml: "ml",
  "%": "%",
  "%w/w": "% w/w",
  "% w/w": "% w/w",
  "%w/v": "% w/v",
  "% w/v": "% w/v",
};

const BASIS_UNIT_ALIASES: Record<string, string> = {
  tab: "tablet",
  tablet: "tablet",
  tablets: "tablet",
  cap: "capsule",
  capsule: "capsule",
  capsules: "capsule",
  ml: "ml",
  l: "l",
  g: "g",
  mg: "mg",
  dose: "dose",
  puff: "puff",
  actuation: "actuation",
  drop: "drop",
  sachet: "sachet",
  vial: "vial",
  ampoule: "ampoule",
  "w/w": "w/w",
  "w/v": "w/v",
  "v/v": "v/v",
};

export const INFORMATIONAL_NOTICE =
  "Catalogue composition matches are informational. They do not determine whether a medicine is suitable for an individual. Ask a qualified pharmacist or prescriber before making any treatment change.";

export class CompositionNotComparable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompositionNotComparable";
  }
}

export function normaliseIngredient(value: string): string {
  const normalized = value.normalize("NFKC").toLowerCase().trim();
  // Keep Unicode letters, marks (e.g. Devanagari matras), and digits; strip punctuation/spaces
  return normalized.replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

/**
 * Deterministic decimal string arithmetic without floating-point rounding bugs.
 */
function parsePositiveDecimalScaled(
  raw: string,
  errorLabel: string,
): { scaled: bigint; scale: number } {
  const cleaned = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new CompositionNotComparable(`${errorLabel} is not numeric.`);
  }
  const [intPart, fracPart = ""] = cleaned.split(".");
  const scale = fracPart.length;
  const scaled = BigInt(intPart + fracPart);
  if (scaled <= 0n) {
    throw new CompositionNotComparable(
      `${errorLabel} must be a positive finite number.`,
    );
  }
  return { scaled, scale };
}

function formatScaledDecimal(scaled: bigint, scale: number): string {
  const str = scaled.toString().padStart(scale + 1, "0");
  if (scale === 0) return str;
  const intPart = str.slice(0, str.length - scale) || "0";
  const fracPart = str.slice(str.length - scale).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export function normaliseStrength(
  value: string,
  unit: string,
): [string, string] {
  const { scaled, scale } = parsePositiveDecimalScaled(
    value,
    "An ingredient strength",
  );
  const rawUnit = unit
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  const canonicalUnit = UNIT_ALIASES[rawUnit];
  if (!canonicalUnit) {
    throw new CompositionNotComparable(`Unsupported strength unit: ${unit}`);
  }

  if (canonicalUnit === "g") {
    return [formatScaledDecimal(scaled * 1000n, scale), "mg"];
  }
  if (canonicalUnit === "mcg") {
    return [formatScaledDecimal(scaled, scale + 3), "mg"];
  }
  return [formatScaledDecimal(scaled, scale), canonicalUnit];
}

export function normaliseBasis(
  basisAmount?: string | null,
  basisUnit?: string | null,
): [string, string] {
  if (!basisAmount && !basisUnit) {
    return ["", ""];
  }
  if (!basisUnit) {
    throw new CompositionNotComparable(
      "Strength basis unit is missing for a basis amount.",
    );
  }
  const rawBasisUnit = basisUnit.normalize("NFKC").toLowerCase().trim();
  const canonicalBasisUnit = BASIS_UNIT_ALIASES[rawBasisUnit];
  if (!canonicalBasisUnit) {
    throw new CompositionNotComparable(
      `Unsupported strength basis unit: ${basisUnit}`,
    );
  }
  if (!basisAmount) {
    if (["w/w", "w/v", "v/v"].includes(canonicalBasisUnit)) {
      return ["", canonicalBasisUnit];
    }
    return ["1", canonicalBasisUnit];
  }

  const { scaled, scale } = parsePositiveDecimalScaled(
    basisAmount,
    "Strength basis amount",
  );
  if (canonicalBasisUnit === "l") {
    return [formatScaledDecimal(scaled * 1000n, scale), "ml"];
  }
  return [formatScaledDecimal(scaled, scale), canonicalBasisUnit];
}

export type ComponentTuple = [string, string, string, string, string];

export function componentSignature(
  components: CompositionComponent[],
  options: {
    requireConfidence: boolean;
    canonicalMap?: Record<string, string>;
  },
): ComponentTuple[] {
  if (!components || components.length === 0) {
    throw new CompositionNotComparable(
      "No structured composition components were extracted.",
    );
  }

  const active: ComponentTuple[] = [];
  let unknownRole = false;

  for (const component of components) {
    const role = component.ingredient_role;
    if (role === "inactive") {
      continue;
    }
    if (role !== "active") {
      unknownRole = true;
      continue;
    }

    const normalisedName = normaliseIngredient(
      component.ingredient_name || component.ingredient_name_printed || "",
    );
    if (!normalisedName) {
      throw new CompositionNotComparable(
        "An active ingredient has no usable name or key.",
      );
    }

    const canonicalMap = options.canonicalMap;
    let ingredientIdentity = normalisedName;
    if (canonicalMap && canonicalMap[normalisedName]) {
      ingredientIdentity = canonicalMap[normalisedName];
    } else if (
      canonicalMap &&
      component.ingredient_key &&
      Object.values(canonicalMap).includes(component.ingredient_key)
    ) {
      ingredientIdentity = component.ingredient_key;
    }

    const rawStrength =
      component.strength_value || component.strength_amount || "";
    let [amount, unit] = normaliseStrength(rawStrength, component.strength_unit);
    let [basisAmount, basisUnit] = normaliseBasis(
      component.strength_basis_amount,
      component.strength_basis_unit,
    );

    if ((unit === "% w/w" || unit === "% w/v") && !basisUnit) {
      basisUnit = unit.split(" ")[1];
      unit = "%";
    }

    if (
      options.requireConfidence &&
      (component.confidence === undefined ||
        component.confidence === null ||
        component.confidence < 0.7)
    ) {
      throw new CompositionNotComparable(
        "One or more scanned ingredients are not clear enough.",
      );
    }

    active.push([ingredientIdentity, amount, unit, basisAmount, basisUnit]);
  }

  if (unknownRole) {
    throw new CompositionNotComparable(
      "The active/inactive role of one or more composition entries is unknown.",
    );
  }
  if (active.length === 0) {
    throw new CompositionNotComparable(
      "No confirmed active-ingredient components are available.",
    );
  }

  const serializedSet = new Set(active.map((item) => JSON.stringify(item)));
  if (serializedSet.size !== active.length) {
    throw new CompositionNotComparable(
      "The composition contains duplicate component entries.",
    );
  }

  return [...active].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );
}

export function signatureHash(signature: ComponentTuple[]): string {
  const raw = JSON.stringify(signature);
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function formatComparisonLabel(differences: string[]): string {
  if (differences.length === 0) {
    return "same active composition; formulation details match";
  }
  if (differences.length > 1) {
    return "same active composition; multiple formulation details differ";
  }
  const diff = differences[0];
  if (diff === "dosage_form_text") {
    return "same active composition; dosage form differs";
  }
  if (diff === "release_type_text") {
    return "same active composition; release type differs";
  }
  if (diff === "route_text") {
    return "same active composition; route differs";
  }
  return "same active composition; multiple formulation details differ";
}

function formatComponentDisplay(component: CompositionComponent): string {
  const val = component.strength_value || component.strength_amount || "";
  const base = `${component.ingredient_name} ${val} ${component.strength_unit}`;
  if (component.strength_basis_unit) {
    if (
      component.strength_basis_amount &&
      component.strength_basis_amount !== "1"
    ) {
      return `${base} per ${component.strength_basis_amount} ${component.strength_basis_unit}`;
    }
    if (["w/w", "w/v", "v/v"].includes(component.strength_basis_unit)) {
      return `${base} ${component.strength_basis_unit}`;
    }
    return `${base} per ${component.strength_basis_unit}`;
  }
  return base;
}

export class CompositionGroupMatcher {
  constructor(
    private readonly options: {
      canonicalMap?: Record<string, string>;
      mappingVersion?: string;
    } = {},
  ) {}

  match(
    extraction: ScanExtraction,
    products: CatalogueProduct[],
    params: {
      scanId: string;
      page?: number;
      pageSize?: number;
      hasMore?: boolean;
      nextCursor?: string | null;
    },
  ): CompositionMatchResponse {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const mappingVersion =
      this.options.mappingVersion ?? "2026.11-strict-literal-v1";

    if (extraction.field_conflicts?.includes("composition_components")) {
      return {
        request_id: `req_${crypto.randomUUID().slice(0, 12)}`,
        scan_id: params.scanId,
        composition_parse_status: "conflict",
        status: "unable_to_compare",
        matches_in_page: 0,
        page,
        page_size: pageSize,
        has_more: false,
        next_cursor: null,
        mapping_version: mappingVersion,
        exact_matches: [],
        formulation_difference_matches: [],
        matches: [],
        informational_notice: INFORMATIONAL_NOTICE,
        message:
          "Conflicting composition readings were detected across captures. Take a clear close-up photo.",
      };
    }

    let requestedSignature: ComponentTuple[];
    try {
      requestedSignature = componentSignature(
        extraction.composition_components,
        {
          requireConfidence: true,
          canonicalMap: this.options.canonicalMap,
        },
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Composition could not be compared.";
      return {
        request_id: `req_${crypto.randomUUID().slice(0, 12)}`,
        scan_id: params.scanId,
        composition_parse_status:
          extraction.composition_parse_status || "unable_to_compare",
        status: "unable_to_compare",
        matches_in_page: 0,
        page,
        page_size: pageSize,
        has_more: false,
        next_cursor: null,
        mapping_version: mappingVersion,
        exact_matches: [],
        formulation_difference_matches: [],
        matches: [],
        informational_notice: INFORMATIONAL_NOTICE,
        message: msg,
      };
    }

    const candidates: CompositionMatchCandidate[] = [];
    const seenIds = new Set<string>();
    const requestedJson = JSON.stringify(requestedSignature);

    for (const product of products) {
      if (seenIds.has(product.product_id)) {
        continue;
      }
      seenIds.add(product.product_id);

      let candidateSignature: ComponentTuple[];
      try {
        candidateSignature = componentSignature(
          product.composition_components,
          {
            requireConfidence: false,
            canonicalMap: this.options.canonicalMap,
          },
        );
      } catch {
        continue;
      }

      if (JSON.stringify(candidateSignature) !== requestedJson) {
        continue;
      }

      const differences: string[] = [];
      const missing: string[] = [];
      const formulationFields = [
        "dosage_form_text",
        "release_type_text",
        "route_text",
      ] as const;

      for (const fieldName of formulationFields) {
        const scannedVal = extraction[fieldName]?.value;
        const catalogueVal = product[fieldName];
        if (scannedVal && catalogueVal) {
          if (
            normaliseIngredient(scannedVal) !==
            normaliseIngredient(catalogueVal)
          ) {
            differences.push(fieldName);
          }
        } else {
          missing.push(fieldName);
        }
      }

      const status =
        differences.length > 0
          ? "composition_match_formulation_details_differ"
          : "exact_recorded_composition_match";
      const comparisonLabel = formatComparisonLabel(differences);
      const matchedComponents = extraction.composition_components
        .filter((c) => c.ingredient_role === "active")
        .map(formatComponentDisplay);

      let explanation =
        "Every normalised active-ingredient name, per-ingredient strength, and strength basis matches the buyer's catalogue record.";
      if (differences.length > 0) {
        explanation += ` Formulation details differ: ${differences.join(", ")}.`;
      }
      if (missing.length > 0) {
        explanation += ` Catalogue details are missing for: ${missing.join(", ")}.`;
      }

      candidates.push({
        product,
        status,
        comparison_label: comparisonLabel,
        matched_components: matchedComponents,
        different_fields: differences,
        missing_fields: missing,
        explanation,
        review_required: true,
      });
    }

    const brandOrder: Record<string, number> = {
      reference: 0,
      other: 1,
      unknown: 2,
    };
    candidates.sort((a, b) => {
      const orderA = brandOrder[a.product.brand_category ?? "unknown"] ?? 2;
      const orderB = brandOrder[b.product.brand_category ?? "unknown"] ?? 2;
      if (orderA !== orderB) return orderA - orderB;
      const nameCmp = a.product.display_name
        .toLowerCase()
        .localeCompare(b.product.display_name.toLowerCase());
      if (nameCmp !== 0) return nameCmp;
      return a.product.product_id.localeCompare(b.product.product_id);
    });

    const exactMatches = candidates.filter(
      (c) => c.status === "exact_recorded_composition_match",
    );
    const formulationDifferenceMatches = candidates.filter(
      (c) => c.status === "composition_match_formulation_details_differ",
    );

    const matchesInPage = candidates.length;
    return {
      request_id: `req_${crypto.randomUUID().slice(0, 12)}`,
      scan_id: params.scanId,
      composition_parse_status: extraction.composition_parse_status || "parsed",
      status: matchesInPage > 0 ? "matches_found" : "no_matches",
      composition_signature: signatureHash(requestedSignature),
      matches_in_page: matchesInPage,
      page,
      page_size: pageSize,
      has_more: params.hasMore ?? false,
      next_cursor: params.nextCursor ?? null,
      mapping_version: mappingVersion,
      exact_matches: exactMatches,
      formulation_difference_matches: formulationDifferenceMatches,
      matches: candidates,
      informational_notice: INFORMATIONAL_NOTICE,
      message:
        matchesInPage > 0
          ? "These buyer-catalogue records have the same recorded active-ingredient set and strengths. This is catalogue information, not confirmation that any product is suitable for a particular person. Request the next page when this page is full."
          : "No exact structured active-composition records were found on this catalogue page.",
    };
  }
}
