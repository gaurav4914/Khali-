import type {
  CompositionComponent,
  ExtractedField,
  ScanExtraction,
} from "../../sdk/react-native/src/types";
import { normaliseIngredient } from "./composition";

export interface OCRDocument {
  text: string;
  mean_confidence: number | null;
  provider: string;
}

const STRENGTH_PATTERN =
  /(?:^|\s)\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|ug|g|ml|iu|%)(?:\s*(?:w\/w|w\/v|v\/v))?(?:\b|\/|%|$)/i;

const COMPONENT_PATTERN =
  /^(?<name>.+?)\s*[:\-]?\s*(?<amount>\d+(?:[.,]\d+)?)\s*(?<unit>mcg|µg|μg|ug|mg|g|iu|ml|%)(?:\s*(?<pct_basis>w\/w|w\/v|v\/v))?(?:\s*(?:per|\/)\s*(?<basis_amount>\d+(?:[.,]\d+)?)?\s*(?<basis_unit>tablet|capsule|ml|l|g|mg|dose|puff|drop|sachet|vial|ampoule))?\s*$/i;

const EACH_BASIS_HEADING =
  /\beach\s+(?:(?<basis_amount>\d+(?:[.,]\d+)?)\s*)?(?<basis_unit>uncoated\s+tablet|film\s+coated\s+tablet|dispersible\s+tablet|tablet|capsule|ml|dose|sachet|puff|drop)\s+contains\b|प्रत्येक\s+(?:(?<hi_amount>\d+(?:[.,]\d+)?)\s*)?(?<hi_unit>टैबलेट|कैप्सूल|मिली|ml)\s+में/i;

const COMPOSITION_HEADING =
  /\bcomposition\b|\bactive\s+ingredients?\b|\beach\s+.*?\bcontains\b|संरचना|घटक|प्रत्येक\s+.*?में/i;

const ACTIVE_COMPOSITION_HEADING =
  /\bactive\s+ingredients?\b|\beach\s+.*?\bcontains\b|सक्रिय\s+घटक|प्रत्येक\s+.*?में/i;

const MANUFACTURER_HINTS = [
  "manufactured by",
  "marketed by",
  "mfg. by",
  "mfg by",
  "निर्माता",
  "विपणन",
];

const STOP_SECTION =
  /^(?:indications?|directions?|dosage|storage|warning|caution|excipients?|inactive ingredients?|colou?rs?|flavou?rs?|preservatives?|other ingredients|manufactured by|marketed by|mfg\.?\s*by|सहायक\s+घटक|रंग|भंडारण|चेतावनी)(?:\b|:|\s|$)/i;

const DOSAGE_FORM_PATTERN =
  /\b(film[\s\-]+coated\s+tablets?|uncoated\s+tablets?|dispersible\s+tablets?|tablets?|hard\s+gelatin\s+capsules?|softgel\s+capsules?|capsules?|oral\s+suspension|suspension|syrup|injection|ointment|cream|gel|eye\s+drops?|ear\s+drops?|nasal\s+spray|inhaler|powder)\b|(टैबलेट|कैप्सूल|सिरप|इंजेक्शन|क्रीम|मलहम)/i;

const RELEASE_TYPE_PATTERN =
  /\b(extended[\s\-]+release|sustained[\s\-]+release|prolonged[\s\-]+release|modified[\s\-]+release|delayed[\s\-]+release|immediate[\s\-]+release|enteric[\s\-]+coated|sr|xr|er|cr|mr|dr)\b/i;

const ROUTE_PATTERN =
  /\b(for\s+oral\s+use|oral|topical|intravenous|intramuscular|subcutaneous|ophthalmic|otic|nasal|inhalation|external\s+use\s+only)\b/i;

const PHARMACOPOEIA_SUFFIX =
  /\s+\b(?:I\.?P\.?|B\.?P\.?|U\.?S\.?P\.?|Ph\.?\s*Eur\.?)\b\s*$/i;

function extractHeadingBasis(line: string): [string | null, string | null] {
  const match = line.match(EACH_BASIS_HEADING);
  if (!match || !match.groups) return [null, null];
  const amount = match.groups.basis_amount || match.groups.hi_amount || null;
  const rawUnit = (match.groups.basis_unit || match.groups.hi_unit || "")
    .toLowerCase()
    .trim();
  if (rawUnit.includes("tablet") || rawUnit === "टैबलेट") {
    return [amount || "1", "tablet"];
  }
  if (rawUnit.includes("capsule") || rawUnit === "कैप्सूल") {
    return [amount || "1", "capsule"];
  }
  if (rawUnit === "ml" || rawUnit === "मिली") {
    return [amount || "1", "ml"];
  }
  if (rawUnit) {
    return [amount || "1", rawUnit];
  }
  return [null, null];
}

function cleanIngredientName(rawName: string): string {
  return rawName
    .replace(/^[ :;,\-•*]+|[ :;,\-•*]+$/g, "")
    .replace(PHARMACOPOEIA_SUFFIX, "")
    .replace(/^[ :;,\-•*]+|[ :;,\-•*]+$/g, "");
}

function parseComponents(
  line: string,
  captureId: string,
  confidence: number | null,
  options: {
    activeContext: boolean;
    defaultBasis?: [string | null, string | null];
    provenance?: string;
  },
): CompositionComponent[] {
  const stripped = line
    .replace(
      /^\s*(?:composition\s*[:\-]?\s*)?(?:active\s+ingredients?\s*[:\-]?\s*)?(?:each\s+[^:\n]+?\s+contains\s*[:\-]?\s*)?(?:प्रत्येक\s+[^:\n]+?\s+में\s*[:\-]?\s*)?/i,
      "",
    )
    .replace(/^[ :;,\-]+|[ :;,\-]+$/g, "");

  if (!stripped || !STRENGTH_PATTERN.test(stripped)) {
    return [];
  }

  const parts = stripped.split(/\s*\+\s*|\s*;\s*|\s+and\s+/i);
  const parsed: CompositionComponent[] = [];

  for (const part of parts) {
    const candidate = part.replace(/^[ :;,\-•*]+|[ :;,\-•*]+$/g, "");
    if (/^(?:excipients?|q\.?s\.?)\b/i.test(candidate)) {
      continue;
    }
    const match = candidate.match(COMPONENT_PATTERN);
    if (!match || !match.groups) continue;

    const printedName = cleanIngredientName(match.groups.name);
    if (printedName.length < 2) continue;

    const pctBasis = match.groups.pct_basis;
    const explicitBasisAmount = match.groups.basis_amount;
    const explicitBasisUnit = match.groups.basis_unit;

    let basisAmount: string | null = null;
    let basisUnit: string | null = null;

    if (pctBasis) {
      basisUnit = pctBasis.toLowerCase();
    } else if (explicitBasisUnit) {
      basisAmount = (explicitBasisAmount || "1").replace(",", ".");
      basisUnit = explicitBasisUnit.toLowerCase();
    } else if (options.defaultBasis && options.defaultBasis[1]) {
      [basisAmount, basisUnit] = options.defaultBasis;
    }

    const strengthVal = match.groups.amount.replace(",", ".");
    parsed.push({
      ingredient_name: printedName,
      ingredient_name_printed: printedName,
      ingredient_name_normalised: normaliseIngredient(printedName),
      ingredient_role: options.activeContext ? "active" : "unknown",
      strength_value: strengthVal,
      strength_amount: strengthVal,
      strength_unit: match.groups.unit.toLowerCase(),
      strength_basis_amount: basisAmount,
      strength_basis_unit: basisUnit,
      confidence,
      source_capture_id: captureId,
      source_capture_ids: [captureId],
      source_text: candidate,
      provenance: options.provenance ?? "ocr",
    });
  }

  return parsed;
}

export function extractPrintedFields(
  documents: Array<[string, OCRDocument]>,
): ScanExtraction {
  const lines: Array<[string, string, number | null, string]> = [];
  const rawParts: string[] = [];
  const allComponentSets: CompositionComponent[][] = [];
  const providersSeen: string[] = [];

  for (const [captureId, document] of documents) {
    if (document.provider && !providersSeen.includes(document.provider)) {
      providersSeen.push(document.provider);
    }
    rawParts.push(document.text);

    let inCompositionSection = false;
    let activeCompositionContext = false;
    let currentBasis: [string | null, string | null] = [null, null];
    let contextLinesRemaining = 0;
    const captureComponents: CompositionComponent[] = [];

    for (const rawLine of document.text.split(/\r?\n/)) {
      const value = rawLine.trim();
      if (!value) continue;
      lines.push([value, captureId, document.mean_confidence, document.provider]);

      if (STOP_SECTION.test(value)) {
        inCompositionSection = false;
        activeCompositionContext = false;
        currentBasis = [null, null];
        contextLinesRemaining = 0;
        continue;
      }

      if (COMPOSITION_HEADING.test(value)) {
        inCompositionSection = true;
        contextLinesRemaining = 8;
        activeCompositionContext = ACTIVE_COMPOSITION_HEADING.test(value);
        const headingBasis = extractHeadingBasis(value);
        if (headingBasis[1]) {
          currentBasis = headingBasis;
        }
        const components = parseComponents(
          value,
          captureId,
          document.mean_confidence,
          {
            activeContext: activeCompositionContext,
            defaultBasis: currentBasis,
            provenance: document.provider || "ocr",
          },
        );
        captureComponents.push(...components);
        continue;
      }

      const components = parseComponents(
        value,
        captureId,
        document.mean_confidence,
        {
          activeContext: inCompositionSection && activeCompositionContext,
          defaultBasis: inCompositionSection ? currentBasis : [null, null],
          provenance: document.provider || "ocr",
        },
      );
      captureComponents.push(...components);

      if (inCompositionSection) {
        contextLinesRemaining -= 1;
        if (contextLinesRemaining <= 0) {
          inCompositionSection = false;
          activeCompositionContext = false;
          currentBasis = [null, null];
        }
      }
    }

    if (captureComponents.length > 0) {
      allComponentSets.push(captureComponents);
    }
  }

  const countAlpha = (str: string) =>
    (str.match(/\p{L}/gu) || []).length;

  const productLine =
    lines.find(
      (row) =>
        row[0].length >= 3 &&
        row[0].length <= 90 &&
        !STRENGTH_PATTERN.test(row[0]) &&
        !COMPOSITION_HEADING.test(row[0]) &&
        !STOP_SECTION.test(row[0]) &&
        countAlpha(row[0]) >= 3,
    ) ?? null;

  const compositionLine =
    lines.find((row) => COMPOSITION_HEADING.test(row[0])) ??
    lines.find((row) => STRENGTH_PATTERN.test(row[0])) ??
    null;

  const manufacturerLine =
    lines.find((row) =>
      MANUFACTURER_HINTS.some((hint) => row[0].toLowerCase().includes(hint)),
    ) ?? null;

  let dosageRow: [string, string, number | null, string] | null = null;
  let releaseRow: [string, string, number | null, string] | null = null;
  let routeRow: [string, string, number | null, string] | null = null;

  for (const row of lines) {
    if (!dosageRow) {
      const m = row[0].match(DOSAGE_FORM_PATTERN);
      if (m) dosageRow = [m[0], row[1], row[2], row[3]];
    }
    if (!releaseRow) {
      const m = row[0].match(RELEASE_TYPE_PATTERN);
      if (m) releaseRow = [m[0], row[1], row[2], row[3]];
    }
    if (!routeRow) {
      const m = row[0].match(ROUTE_PATTERN);
      if (m) routeRow = [m[0], row[1], row[2], row[3]];
    }
  }

  const makeField = (
    row: [string, string, number | null, string] | null,
  ): ExtractedField => {
    if (!row) {
      return {
        value: null,
        confidence: null,
        source_capture_id: null,
        source_capture_ids: [],
        source_text: null,
        provenance: "ocr",
      };
    }
    return {
      value: row[0],
      confidence: row[2],
      source_capture_id: row[1],
      source_capture_ids: [row[1]],
      source_text: row[0],
      provenance: row[3] || "ocr",
    };
  };

  const conflicts: string[] = [];
  let compositionComponents: CompositionComponent[] = [];

  if (allComponentSets.length > 0) {
    const signatures = new Set(
      allComponentSets.map((set) =>
        JSON.stringify(
          [...set]
            .map((c) => [
              normaliseIngredient(c.ingredient_name),
              c.strength_value,
              c.strength_unit,
              c.strength_basis_amount || "",
              c.strength_basis_unit || "",
            ])
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        ),
      ),
    );

    if (signatures.size > 1) {
      conflicts.push("composition_components");
    } else {
      compositionComponents = [...allComponentSets].sort((a, b) => {
        const activeA = a.filter((i) => i.ingredient_role === "active").length;
        const activeB = b.filter((i) => i.ingredient_role === "active").length;
        if (activeA !== activeB) return activeB - activeA;
        const confA = Math.max(...a.map((i) => i.confidence ?? 0), 0);
        const confB = Math.max(...b.map((i) => i.confidence ?? 0), 0);
        return confB - confA;
      })[0];
    }
  }

  const missing: string[] = [];
  if (!productLine) missing.push("printed_product_name");
  if (!compositionLine) missing.push("printed_composition_text");
  if (compositionComponents.length === 0) missing.push("composition_components");
  if (!manufacturerLine) missing.push("manufacturer_text");

  return {
    printed_product_name: makeField(productLine),
    brand_name: makeField(null),
    printed_composition_text: makeField(compositionLine),
    manufacturer_text: makeField(manufacturerLine),
    dosage_form_text: makeField(dosageRow),
    release_type_text: makeField(releaseRow),
    route_text: makeField(routeRow),
    composition_components: compositionComponents,
    raw_text: rawParts.filter(Boolean).join("\n").slice(0, 12000),
    unreadable_fields: missing,
    field_conflicts: conflicts,
    composition_parse_status:
      conflicts.length > 0
        ? "conflict"
        : compositionComponents.length > 0
          ? "parsed"
          : "unavailable",
    ocr_provenance: providersSeen[0] || "tesseract",
    vision_provenance: providersSeen.find((p) => p.includes("gemini")) || null,
    review_required: true,
  };
}
