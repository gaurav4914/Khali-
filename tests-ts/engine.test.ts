import { describe, expect, it } from "vitest";
import type {
  CatalogueProduct,
  CompositionComponent,
  ScanExtraction,
} from "../sdk/react-native/src/types";
import {
  determineNextGuidedStage,
  evaluateCaptureReviewBanner,
} from "../sdk/react-native/src/scanner";
import {
  CompositionGroupMatcher,
  componentSignature,
} from "../src/engine/composition";
import { extractPrintedFields } from "../src/engine/extraction";
import { ExactProductIdentityResolver } from "../src/engine/identity";
import { InvalidImageError, inspectImageBuffer } from "../src/engine/quality";

function makeComponent(
  name: string,
  amount: string,
  unit = "mg",
  opts: Partial<CompositionComponent> = {},
): CompositionComponent {
  return {
    ingredient_name: name,
    ingredient_role: "active",
    strength_value: amount,
    strength_unit: unit,
    confidence: 0.95,
    ...opts,
  };
}

function makeExtraction(
  components: CompositionComponent[],
  dosageForm = "Tablet",
): ScanExtraction {
  return {
    printed_product_name: {
      value: "Sample Product",
      confidence: 0.95,
      source_capture_ids: ["cap-1"],
      source_text: "Sample Product",
    },
    printed_composition_text: {
      value: "Each tablet contains...",
      confidence: 0.95,
      source_capture_ids: ["cap-1"],
      source_text: "Each tablet contains...",
    },
    manufacturer_text: {
      value: "Sample Pharma",
      confidence: 0.92,
      source_capture_ids: ["cap-1"],
      source_text: "Sample Pharma",
    },
    dosage_form_text: {
      value: dosageForm,
      confidence: 0.9,
      source_capture_ids: ["cap-1"],
      source_text: dosageForm,
    },
    release_type_text: {
      value: null,
      confidence: null,
      source_capture_ids: [],
      source_text: null,
    },
    route_text: {
      value: null,
      confidence: null,
      source_capture_ids: [],
      source_text: null,
    },
    composition_components: components,
    raw_text: "",
    unreadable_fields: [],
    field_conflicts: [],
    composition_parse_status: "parsed",
    review_required: true,
  };
}

function makeProduct(
  id: string,
  name: string,
  components: CompositionComponent[],
  extra: Partial<CatalogueProduct> = {},
): CatalogueProduct {
  return {
    product_id: id,
    display_name: name,
    brand_category: "unknown",
    composition_components: components,
    ...extra,
  };
}

function makeValidPngBuffer(width = 900, height = 900): Buffer {
  const buf = Buffer.alloc(64);
  // PNG header
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR length & type
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("Composition Matching Engine — Mandatory Precision Rules", () => {
  it("returns all records with exact active composition regardless of ingredient order", () => {
    const extraction = makeExtraction([
      makeComponent("Paracetamol", "500"),
      makeComponent("Caffeine", "30"),
    ]);

    const catalogue: CatalogueProduct[] = [
      makeProduct(
        "ref-1",
        "Reference Brand",
        [makeComponent("Paracetamol", "500"), makeComponent("Caffeine", "30")],
        { brand_category: "reference", dosage_form_text: "Tablet" },
      ),
      makeProduct(
        "other-1",
        "Other Brand Reordered + Gram Conversion",
        [
          makeComponent("Caffeine", "30"),
          makeComponent("Paracetamol", "0.5", "g"),
        ],
        { brand_category: "other", dosage_form_text: "Tablet" },
      ),
      makeProduct("wrong-strength", "Wrong Strength", [
        makeComponent("Paracetamol", "650"),
        makeComponent("Caffeine", "30"),
      ]),
      makeProduct("wrong-salt", "Different Salt Form", [
        makeComponent("Paracetamol sodium", "500"),
        makeComponent("Caffeine", "30"),
      ]),
    ];

    const result = new CompositionGroupMatcher().match(extraction, catalogue, {
      scanId: "scan-1",
    });

    expect(result.status).toBe("matches_found");
    expect(result.matches_in_page).toBe(2);
    expect(result.matches.map((m) => m.product.product_id)).toEqual([
      "ref-1",
      "other-1",
    ]);
  });

  it("distinguishes strength bases: 250 mg per tablet vs per 5 mL vs per mL", () => {
    const perTablet = makeComponent("Amoxicillin", "250", "mg", {
      strength_basis_amount: "1",
      strength_basis_unit: "tablet",
    });
    const per5Ml = makeComponent("Amoxicillin", "250", "mg", {
      strength_basis_amount: "5",
      strength_basis_unit: "ml",
    });
    const per1Ml = makeComponent("Amoxicillin", "250", "mg", {
      strength_basis_amount: "1",
      strength_basis_unit: "ml",
    });

    const sigTab = JSON.stringify(
      componentSignature([perTablet], { requireConfidence: true }),
    );
    const sig5Ml = JSON.stringify(
      componentSignature([per5Ml], { requireConfidence: true }),
    );
    const sig1Ml = JSON.stringify(
      componentSignature([per1Ml], { requireConfidence: true }),
    );

    expect(sigTab).not.toBe(sig5Ml);
    expect(sig5Ml).not.toBe(sig1Ml);
    expect(sigTab).not.toBe(sig1Ml);
  });

  it("never converts IU or percentage (% w/w) to mass (mg)", () => {
    const iuComp = makeComponent("Cholecalciferol", "500", "IU");
    const mgComp = makeComponent("Cholecalciferol", "500", "mg");
    const pctComp = makeComponent("Diclofenac", "5", "% w/w");

    const sigIu = JSON.stringify(
      componentSignature([iuComp], { requireConfidence: true }),
    );
    const sigMg = JSON.stringify(
      componentSignature([mgComp], { requireConfidence: true }),
    );
    const sigPct = JSON.stringify(
      componentSignature([pctComp], { requireConfidence: true }),
    );

    expect(sigIu).not.toBe(sigMg);
    expect(sigIu).not.toBe(sigPct);
  });

  it("rejects extra or missing active ingredients in 3-component combinations", () => {
    const scan3 = makeExtraction([
      makeComponent("Aceclofenac", "100"),
      makeComponent("Paracetamol", "325"),
      makeComponent("Serratiopeptidase", "15"),
    ]);

    const catalogue = [
      makeProduct("exact-3", "Exact 3 Components", [
        makeComponent("Serratiopeptidase", "15"),
        makeComponent("Aceclofenac", "100"),
        makeComponent("Paracetamol", "325"),
      ]),
      makeProduct("partial-2", "Partial 2 Components", [
        makeComponent("Aceclofenac", "100"),
        makeComponent("Paracetamol", "325"),
      ]),
      makeProduct("extra-4", "Extra 4th Component", [
        makeComponent("Aceclofenac", "100"),
        makeComponent("Paracetamol", "325"),
        makeComponent("Serratiopeptidase", "15"),
        makeComponent("Chlorzoxazone", "250"),
      ]),
    ];

    const res = new CompositionGroupMatcher().match(scan3, catalogue, {
      scanId: "scan-3",
    });
    expect(res.matches.map((m) => m.product.product_id)).toEqual(["exact-3"]);
  });

  it("excludes inactive excipients from active signature and flags unknown roles or low confidence as unable_to_compare", () => {
    const unknownRole = makeExtraction([
      makeComponent("Paracetamol", "500", "mg", { ingredient_role: "unknown" }),
    ]);
    const lowConf = makeExtraction([
      makeComponent("Paracetamol", "500", "mg", { confidence: 0.45 }),
    ]);

    const matcher = new CompositionGroupMatcher();
    expect(matcher.match(unknownRole, [], { scanId: "s1" }).status).toBe(
      "unable_to_compare",
    );
    expect(matcher.match(lowConf, [], { scanId: "s2" }).status).toBe(
      "unable_to_compare",
    );
  });

  it("surfaces dosage form differences explicitly and never double-slices page 2", () => {
    const extraction = makeExtraction([
      makeComponent("Paracetamol", "500"),
      makeComponent("Caffeine", "30"),
    ]);
    const page2Items = [
      makeProduct(
        "cap-1",
        "Capsule Variant",
        [makeComponent("Paracetamol", "500"), makeComponent("Caffeine", "30")],
        { dosage_form_text: "Capsule" },
      ),
    ];

    const result = new CompositionGroupMatcher().match(extraction, page2Items, {
      scanId: "scan-p2",
      page: 2,
      pageSize: 50,
    });

    expect(result.page).toBe(2);
    expect(result.matches_in_page).toBe(1);
    expect(result.matches[0].status).toBe(
      "composition_match_formulation_details_differ",
    );
    expect(result.matches[0].comparison_label).toBe(
      "same active composition; dosage form differs",
    );
  });
});

describe("OCR & Vision Structured Extraction, Identity & Guided Scanner", () => {
  it("extracts per-5mL syrup basis, Hindi labels, and flags conflicting captures", () => {
    const syrup = extractPrintedFields([
      [
        "cap-syrup",
        {
          text: "Mox 250 Suspension\nEach 5 ml contains: Amoxicillin IP 250 mg\nExcipients q.s.",
          mean_confidence: 0.95,
          provider: "tesseract",
        },
      ],
    ]);
    expect(syrup.composition_components).toHaveLength(1);
    expect(syrup.composition_components[0].ingredient_name).toBe("Amoxicillin");
    expect(syrup.composition_components[0].strength_basis_amount).toBe("5");
    expect(syrup.composition_components[0].strength_basis_unit).toBe("ml");

    const hindi = extractPrintedFields([
      [
        "cap-hi",
        {
          text: "कालपोल 500 टैबलेट\nप्रत्येक टैबलेट में: पैरासिटामोल 500 mg",
          mean_confidence: 0.94,
          provider: "tesseract",
        },
      ],
    ]);
    expect(hindi.composition_components).toHaveLength(1);
    expect(hindi.composition_components[0].ingredient_name).toBe("पैरासिटामोल");
    expect(hindi.composition_components[0].ingredient_role).toBe("active");

    const conflict = extractPrintedFields([
      [
        "cap-1",
        {
          text: "Each tablet contains: Paracetamol 500 mg",
          mean_confidence: 0.95,
          provider: "tesseract",
        },
      ],
      [
        "cap-2",
        {
          text: "Each tablet contains: Paracetamol 650 mg",
          mean_confidence: 0.95,
          provider: "tesseract",
        },
      ],
    ]);
    expect(conflict.composition_parse_status).toBe("conflict");
    expect(conflict.field_conflicts).toContain("composition_components");
  });

  it("separates exact product identity from composition similarity", () => {
    const resolver = new ExactProductIdentityResolver();
    const onlyComp: ScanExtraction = {
      ...makeExtraction([]),
      printed_product_name: {
        value: null,
        confidence: null,
        source_capture_ids: [],
        source_text: null,
      },
    };
    const catalogue = [makeProduct("p-1", "Calpol 500 Tablet", [])];
    expect(resolver.resolve(onlyComp, catalogue)).toEqual([]);
  });

  it("validates image buffers and guides adaptive scanner stages", () => {
    expect(() => inspectImageBuffer(Buffer.from("not an image"))).toThrow(
      InvalidImageError,
    );
    const validPng = makeValidPngBuffer(900, 900);
    const report = inspectImageBuffer(validPng, {
      captureId: "c1",
      step: "front",
      presetHint: "small_text",
    });
    expect(report.width).toBe(900);
    const banner = evaluateCaptureReviewBanner(report);
    expect(banner.headline).toBe("Need a closer photo — text is too small");

    const next = determineNextGuidedStage({
      completedSteps: ["front"],
      latestCapture: {
        capture_id: "c1",
        step: "front",
        filename: "c1.png",
        content_type: "image/png",
        created_at: new Date().toISOString(),
        quality: report,
      },
      config: {
        allowGalleryImport: true,
        maxUploadBytes: 10485760,
        privacyNotice: "Self-hosted",
        externalAiEnabled: false,
        requireBackCaptureForMissingManufacturer: true,
      },
    });
    expect(next.nextScreen).toBe("S3_COMPOSITION_CLOSEUP");
  });
});
