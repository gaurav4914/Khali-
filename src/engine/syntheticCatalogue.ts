import type {
  CatalogueProduct,
  CompositionComponent,
} from "../../sdk/react-native/src/types";
import { componentSignature, normaliseIngredient } from "./composition";

export interface SyntheticPackPreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  barcode?: string;
  requiresCloseup: boolean;
  requiresBackCapture: boolean;
  qualityPreset: "clear" | "small_text" | "blur" | "glare";
  frontOcrText: string;
  frontConfidence: number;
  compositionCloseupText?: string;
  compositionConfidence?: number;
  backOcrText?: string;
  backConfidence?: number;
  visualTheme: {
    stripBg: string;
    accentColor: string;
    brandTitle: string;
    rxLine: string;
    compLines: string[];
    mfgLine: string;
  };
}

export const DEFAULT_CANONICAL_INGREDIENT_MAP: Record<string, string> = {
  paracetamol: "ing_paracetamol",
  acetaminophen: "ing_paracetamol",
  "पैरासिटामोल": "ing_paracetamol",
  caffeine: "ing_caffeine",
  amoxicillin: "ing_amoxicillin",
  amoxycillin: "ing_amoxicillin",
  aceclofenac: "ing_aceclofenac",
  serratiopeptidase: "ing_serratiopeptidase",
  diclofenacdiethylamine: "ing_diclofenac_diethylamine",
  cholecalciferol: "ing_cholecalciferol",
};

export const SYNTHETIC_BUYER_CATALOGUE: CatalogueProduct[] = [
  // Group 1: Paracetamol 500 mg per tablet (Reference + Other brands + Formulation diff + Wrong strength)
  {
    product_id: "buyer-sku-1001",
    display_name: "Calpol 500 Tablet",
    brand_name: "Calpol",
    brand_category: "reference",
    barcode: "8901148241015",
    composition_text: "Each uncoated tablet contains: Paracetamol IP 500 mg",
    composition_components: [
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "500",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "500 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd",
    pack_size_text: "Strip of 15 tablets",
    product_status: "active",
    updated_at: "2026-11-01T08:30:00Z",
  },
  {
    product_id: "buyer-sku-1002",
    display_name: "Pacimol 500 Tablet",
    brand_name: "Pacimol",
    brand_category: "other",
    barcode: "8901072001129",
    composition_text: "Each tablet contains: Paracetamol IP 500 mg",
    composition_components: [
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "500",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_name: "Starch",
        ingredient_role: "inactive",
        strength_value: "15",
        strength_unit: "mg",
        provenance: "catalogue",
      },
    ],
    strength_text: "500 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Ipca Laboratories Ltd",
    pack_size_text: "Strip of 15 tablets",
    product_status: "active",
    updated_at: "2026-11-01T08:30:00Z",
  },
  {
    product_id: "buyer-sku-1003",
    display_name: "Febrex Plain 500 Tablet",
    brand_name: "Febrex",
    brand_category: "other",
    barcode: "8901072003345",
    composition_text: "Each tablet contains: Paracetamol 0.5 g",
    composition_components: [
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "0.5",
        strength_unit: "g",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "0.5 g (500 mg) per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Indoco Remedies Ltd",
    pack_size_text: "Strip of 10 tablets",
    product_status: "active",
    updated_at: "2026-11-01T08:30:00Z",
  },
  {
    product_id: "buyer-sku-1004",
    display_name: "ParaFast 500 Softgel Capsule",
    brand_name: "ParaFast",
    brand_category: "other",
    barcode: "8901072009996",
    composition_text: "Each capsule contains: Paracetamol 500 mg",
    composition_components: [
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "500",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "500 mg",
    dosage_form_text: "Capsule",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Apex Formulations Pvt Ltd",
    pack_size_text: "Strip of 10 capsules",
    product_status: "active",
    updated_at: "2026-11-01T08:30:00Z",
  },
  {
    product_id: "buyer-sku-1005",
    display_name: "Calpol 650 Tablet",
    brand_name: "Calpol",
    brand_category: "reference",
    barcode: "8901148241099",
    composition_text: "Each tablet contains: Paracetamol IP 650 mg",
    composition_components: [
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "650",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "650 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd",
    pack_size_text: "Strip of 15 tablets",
    product_status: "active",
    updated_at: "2026-11-01T08:30:00Z",
  },

  // Group 2: Paracetamol 500 mg + Caffeine 30 mg per tablet (Combination order-independent)
  {
    product_id: "buyer-sku-2001",
    display_name: "Panadol Extra Advance Tablet",
    brand_name: "Panadol",
    brand_category: "reference",
    barcode: "8902200110012",
    composition_text:
      "Each film coated tablet contains: Paracetamol 500 mg + Caffeine 30 mg",
    composition_components: [
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "500",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_caffeine",
        ingredient_name: "Caffeine",
        ingredient_role: "active",
        strength_value: "30",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "500 mg + 30 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Haleon Healthcare Ltd",
    pack_size_text: "Strip of 12 tablets",
    product_status: "active",
    updated_at: "2026-11-02T10:15:00Z",
  },
  {
    product_id: "buyer-sku-2002",
    display_name: "Metacin Plus Tablet",
    brand_name: "Metacin",
    brand_category: "other",
    barcode: "8902200110029",
    composition_text:
      "Each tablet contains: Caffeine 30 mg + Paracetamol 0.5 g",
    composition_components: [
      {
        ingredient_key: "ing_caffeine",
        ingredient_name: "Caffeine",
        ingredient_role: "active",
        strength_value: "30",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "0.5",
        strength_unit: "g",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_name: "Titanium Dioxide",
        ingredient_role: "inactive",
        strength_value: "2",
        strength_unit: "mg",
        provenance: "catalogue",
      },
    ],
    strength_text: "30 mg + 500 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Themis Medicare Ltd",
    pack_size_text: "Strip of 10 tablets",
    product_status: "active",
    updated_at: "2026-11-02T10:15:00Z",
  },
  {
    product_id: "buyer-sku-2003",
    display_name: "CafPara SR 500/30 Extended Release Tablet",
    brand_name: "CafPara",
    brand_category: "other",
    barcode: "8902200110036",
    composition_text:
      "Each tablet contains: Paracetamol 500 mg + Caffeine 30 mg",
    composition_components: [
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "500",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_caffeine",
        ingredient_name: "Caffeine",
        ingredient_role: "active",
        strength_value: "30",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "500 mg + 30 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Extended release",
    route_text: "Oral",
    manufacturer: "Nova Formulations Ltd",
    pack_size_text: "Strip of 10 tablets",
    product_status: "active",
    updated_at: "2026-11-02T10:15:00Z",
  },
  {
    product_id: "buyer-sku-2004",
    display_name: "ParaSalt Sodium 500/30 Tablet",
    brand_name: "ParaSalt",
    brand_category: "other",
    barcode: "8902200110043",
    composition_text:
      "Each tablet contains: Paracetamol Sodium 500 mg + Caffeine 30 mg",
    composition_components: [
      {
        ingredient_name: "Paracetamol Sodium",
        ingredient_role: "active",
        strength_value: "500",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_name: "Caffeine",
        ingredient_role: "active",
        strength_value: "30",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "500 mg + 30 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "SaltChem Labs Ltd",
    pack_size_text: "Strip of 10 tablets",
    product_status: "active",
    updated_at: "2026-11-02T10:15:00Z",
  },

  // Group 3: 3-ingredient combination: Aceclofenac 100 mg + Paracetamol 325 mg + Serratiopeptidase 15 mg
  {
    product_id: "buyer-sku-3001",
    display_name: "Zerodol-SP Tablet",
    brand_name: "Zerodol-SP",
    brand_category: "reference",
    barcode: "8903300220011",
    composition_text:
      "Each tablet contains: Aceclofenac 100 mg + Paracetamol 325 mg + Serratiopeptidase 15 mg",
    composition_components: [
      {
        ingredient_key: "ing_aceclofenac",
        ingredient_name: "Aceclofenac",
        ingredient_role: "active",
        strength_value: "100",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "325",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_serratiopeptidase",
        ingredient_name: "Serratiopeptidase",
        ingredient_role: "active",
        strength_value: "15",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "100 mg + 325 mg + 15 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Ipca Laboratories Ltd",
    pack_size_text: "Strip of 10 tablets",
    product_status: "active",
    updated_at: "2026-11-03T11:00:00Z",
  },
  {
    product_id: "buyer-sku-3002",
    display_name: "Hifenac-SP Tablet",
    brand_name: "Hifenac-SP",
    brand_category: "other",
    barcode: "8903300220028",
    composition_text:
      "Each tablet contains: Serratiopeptidase 15 mg + Paracetamol 325 mg + Aceclofenac 100 mg",
    composition_components: [
      {
        ingredient_key: "ing_serratiopeptidase",
        ingredient_name: "Serratiopeptidase",
        ingredient_role: "active",
        strength_value: "15",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "325",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_aceclofenac",
        ingredient_name: "Aceclofenac",
        ingredient_role: "active",
        strength_value: "100",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "15 mg + 325 mg + 100 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Intas Pharmaceuticals Ltd",
    pack_size_text: "Strip of 10 tablets",
    product_status: "active",
    updated_at: "2026-11-03T11:00:00Z",
  },
  {
    product_id: "buyer-sku-3003",
    display_name: "Zerodol-P Tablet (2-Component Partial — Must Not Match 3-Component Scan)",
    brand_name: "Zerodol-P",
    brand_category: "other",
    barcode: "8903300220035",
    composition_text:
      "Each tablet contains: Aceclofenac 100 mg + Paracetamol 325 mg",
    composition_components: [
      {
        ingredient_key: "ing_aceclofenac",
        ingredient_name: "Aceclofenac",
        ingredient_role: "active",
        strength_value: "100",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
      {
        ingredient_key: "ing_paracetamol",
        ingredient_name: "Paracetamol",
        ingredient_role: "active",
        strength_value: "325",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "tablet",
        provenance: "catalogue",
      },
    ],
    strength_text: "100 mg + 325 mg per tablet",
    dosage_form_text: "Tablet",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Ipca Laboratories Ltd",
    pack_size_text: "Strip of 10 tablets",
    product_status: "active",
    updated_at: "2026-11-03T11:00:00Z",
  },

  // Group 4: Liquid Oral Suspension (250 mg per 5 mL vs 250 mg per mL vs 250 mg per tablet)
  {
    product_id: "buyer-sku-4001",
    display_name: "Mox 250 Rediuse Oral Suspension",
    brand_name: "Mox",
    brand_category: "reference",
    barcode: "8904400330019",
    composition_text: "Each 5 ml contains: Amoxicillin 250 mg",
    composition_components: [
      {
        ingredient_key: "ing_amoxicillin",
        ingredient_name: "Amoxicillin",
        ingredient_role: "active",
        strength_value: "250",
        strength_unit: "mg",
        strength_basis_amount: "5",
        strength_basis_unit: "ml",
        provenance: "catalogue",
      },
    ],
    strength_text: "250 mg per 5 mL",
    dosage_form_text: "Suspension",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    pack_size_text: "Bottle of 60 mL",
    product_status: "active",
    updated_at: "2026-11-04T09:00:00Z",
  },
  {
    product_id: "buyer-sku-4002",
    display_name: "Novamox 250 Paediatric Suspension",
    brand_name: "Novamox",
    brand_category: "other",
    barcode: "8904400330026",
    composition_text: "Each 5 ml contains: Amoxicillin 250 mg",
    composition_components: [
      {
        ingredient_key: "ing_amoxicillin",
        ingredient_name: "Amoxicillin",
        ingredient_role: "active",
        strength_value: "250",
        strength_unit: "mg",
        strength_basis_amount: "5",
        strength_basis_unit: "ml",
        provenance: "catalogue",
      },
    ],
    strength_text: "250 mg per 5 mL",
    dosage_form_text: "Suspension",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Cipla Ltd",
    pack_size_text: "Bottle of 60 mL",
    product_status: "active",
    updated_at: "2026-11-04T09:00:00Z",
  },
  {
    product_id: "buyer-sku-4003",
    display_name: "MoxConcentrate 250 mg/mL Drops (Different Basis — Must Not Match per 5 mL)",
    brand_name: "MoxConcentrate",
    brand_category: "other",
    barcode: "8904400330033",
    composition_text: "Each ml contains: Amoxicillin 250 mg",
    composition_components: [
      {
        ingredient_key: "ing_amoxicillin",
        ingredient_name: "Amoxicillin",
        ingredient_role: "active",
        strength_value: "250",
        strength_unit: "mg",
        strength_basis_amount: "1",
        strength_basis_unit: "ml",
        provenance: "catalogue",
      },
    ],
    strength_text: "250 mg per mL",
    dosage_form_text: "Suspension",
    release_type_text: "Immediate release",
    route_text: "Oral",
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    pack_size_text: "Bottle of 10 mL",
    product_status: "active",
    updated_at: "2026-11-04T09:00:00Z",
  },
];

export const SYNTHETIC_PACK_PRESETS: SyntheticPackPreset[] = [
  {
    id: "preset_calpol_500",
    title: "Calpol 500 Tablet (Clear Front Pack)",
    subtitle: "Single active ingredient · 500 mg per tablet · 4 catalogue records",
    badge: "Standard Flow",
    barcode: "8901148241015",
    requiresCloseup: false,
    requiresBackCapture: false,
    qualityPreset: "clear",
    frontOcrText: [
      "Calpol 500 Tablet",
      "Each uncoated tablet contains: Paracetamol IP 500 mg",
      "Immediate release",
      "For oral use",
      "Manufactured by: GlaxoSmithKline Pharmaceuticals Ltd",
    ].join("\n"),
    frontConfidence: 0.96,
    visualTheme: {
      stripBg: "#f8fafc",
      accentColor: "#0d9488",
      brandTitle: "Calpol 500 Tablet",
      rxLine: "Paracetamol Tablets IP 500 mg",
      compLines: [
        "Each uncoated tablet contains:",
        "Paracetamol IP 500 mg",
        "Dosage form: Tablet · Immediate release · Oral",
      ],
      mfgLine: "Manufactured by: GlaxoSmithKline Pharmaceuticals Ltd",
    },
  },
  {
    id: "preset_panadol_combo",
    title: "Panadol Extra Advance (2-Ingredient Small Text)",
    subtitle: "Triggers Stage B Composition Close-Up + Stage C Back Photo",
    badge: "Adaptive Multi-Photo",
    barcode: "8902200110012",
    requiresCloseup: true,
    requiresBackCapture: true,
    qualityPreset: "small_text",
    frontOcrText: ["Panadol Extra Advance Tablet", "Film coated tablets · Oral"].join(
      "\n",
    ),
    frontConfidence: 0.91,
    compositionCloseupText: [
      "Each film coated tablet contains:",
      "Paracetamol IP 500 mg + Caffeine IP 30 mg",
      "Excipients: Microcrystalline cellulose 10 mg",
      "Immediate release · For oral use",
    ].join("\n"),
    compositionConfidence: 0.95,
    backOcrText: "Manufactured by: Haleon Healthcare Ltd",
    backConfidence: 0.94,
    visualTheme: {
      stripBg: "#fff1f2",
      accentColor: "#e11d48",
      brandTitle: "Panadol Extra Advance Tablet",
      rxLine: "Paracetamol 500 mg + Caffeine 30 mg",
      compLines: [
        "Each film coated tablet contains:",
        "Paracetamol IP 500 mg + Caffeine IP 30 mg",
        "Excipients: Microcrystalline cellulose 10 mg",
      ],
      mfgLine: "Manufactured by: Haleon Healthcare Ltd",
    },
  },
  {
    id: "preset_zerodol_triple",
    title: "Zerodol-SP Tablet (3-Ingredient Combination)",
    subtitle: "Aceclofenac 100 mg + Paracetamol 325 mg + Serratiopeptidase 15 mg",
    badge: "3 Active Components",
    barcode: "8903300220011",
    requiresCloseup: false,
    requiresBackCapture: false,
    qualityPreset: "clear",
    frontOcrText: [
      "Zerodol-SP Tablet",
      "Each film coated tablet contains:",
      "Aceclofenac IP 100 mg + Paracetamol IP 325 mg + Serratiopeptidase IP 15 mg",
      "Immediate release · Oral",
      "Manufactured by: Ipca Laboratories Ltd",
    ].join("\n"),
    frontConfidence: 0.95,
    visualTheme: {
      stripBg: "#eff6ff",
      accentColor: "#2563eb",
      brandTitle: "Zerodol-SP Tablet",
      rxLine: "Aceclofenac, Paracetamol & Serratiopeptidase Tablets",
      compLines: [
        "Each film coated tablet contains:",
        "Aceclofenac IP 100 mg + Paracetamol IP 325 mg",
        "+ Serratiopeptidase IP 15 mg",
      ],
      mfgLine: "Manufactured by: Ipca Laboratories Ltd",
    },
  },
  {
    id: "preset_mox_syrup",
    title: "Mox 250 Oral Suspension (per 5 mL Basis)",
    subtitle: "Matches per 5 mL records; rejects 250 mg/mL drops & 250 mg tablets",
    badge: "Strength Basis Check",
    barcode: "8904400330019",
    requiresCloseup: false,
    requiresBackCapture: false,
    qualityPreset: "clear",
    frontOcrText: [
      "Mox 250 Rediuse Oral Suspension",
      "Each 5 ml contains: Amoxicillin IP 250 mg",
      "Oral suspension · Immediate release · For oral use",
      "Manufactured by: Sun Pharmaceutical Industries Ltd",
    ].join("\n"),
    frontConfidence: 0.96,
    visualTheme: {
      stripBg: "#fefce8",
      accentColor: "#d97706",
      brandTitle: "Mox 250 Rediuse Oral Suspension",
      rxLine: "Amoxicillin Oral Suspension IP 250 mg / 5 mL",
      compLines: [
        "Each 5 ml contains:",
        "Amoxicillin IP 250 mg",
        "Excipients q.s.",
      ],
      mfgLine: "Manufactured by: Sun Pharmaceutical Industries Ltd",
    },
  },
  {
    id: "preset_hindi_pack",
    title: "कालपोल 500 टैबलेट (Hindi / Mixed-Script Label)",
    subtitle: "Devanagari extraction + buyer canonical ingredient mapping",
    badge: "Hindi + English",
    barcode: "8901148241015",
    requiresCloseup: false,
    requiresBackCapture: false,
    qualityPreset: "clear",
    frontOcrText: [
      "कालपोल 500 टैबलेट",
      "प्रत्येक टैबलेट में: पैरासिटामोल 500 mg",
      "Immediate release · Oral",
      "निर्माता: GlaxoSmithKline Pharmaceuticals Ltd",
    ].join("\n"),
    frontConfidence: 0.94,
    visualTheme: {
      stripBg: "#f0fdf4",
      accentColor: "#16a34a",
      brandTitle: "कालपोल 500 टैबलेट",
      rxLine: "प्रत्येक टैबलेट में: पैरासिटामोल 500 mg",
      compLines: [
        "प्रत्येक टैबलेट में:",
        "पैरासिटामोल 500 mg",
        "सहायक घटक: स्टार्च 15 mg",
      ],
      mfgLine: "निर्माता: GlaxoSmithKline Pharmaceuticals Ltd",
    },
  },
  {
    id: "preset_blurry_retry",
    title: "Blurry Foil Strip (Quality Gate Rejection)",
    subtitle: "Demonstrates Screen S2 'Try again — image is blurred' & Retake replacement",
    badge: "Quality Gate Test",
    requiresCloseup: true,
    requiresBackCapture: false,
    qualityPreset: "blur",
    frontOcrText: [
      "Calpol 500 Tablet",
      "Composition: Paracetamol 500 mg",
    ].join("\n"),
    frontConfidence: 0.55,
    compositionCloseupText: [
      "Each uncoated tablet contains: Paracetamol IP 500 mg",
      "Immediate release · For oral use",
    ].join("\n"),
    compositionConfidence: 0.95,
    visualTheme: {
      stripBg: "#f1f5f9",
      accentColor: "#64748b",
      brandTitle: "Calpol 500 Tablet (Motion Blur)",
      rxLine: "Hold steady and tap Retake or take Composition Close-up",
      compLines: [
        "Composition: Paracetamol 500 mg",
        "(Ambiguous generic heading + low OCR confidence 0.55)",
      ],
      mfgLine: "Manufactured by: GlaxoSmithKline Pharmaceuticals Ltd",
    },
  },
];

export function querySyntheticBuyerCatalogue(params: {
  query?: string | null;
  barcode?: string | null;
  catalogue?: CatalogueProduct[];
}): CatalogueProduct[] {
  const list = params.catalogue ?? SYNTHETIC_BUYER_CATALOGUE;
  if (params.barcode) {
    const byBarcode = list.filter((p) => p.barcode === params.barcode);
    if (byBarcode.length > 0) return byBarcode;
  }
  if (!params.query) return [];
  const q = normaliseIngredient(params.query);
  if (!q) return [];
  return list.filter((p) => {
    const d = normaliseIngredient(p.display_name);
    const b = normaliseIngredient(p.brand_name || "");
    return d.includes(q) || q.includes(d) || (b && (b.includes(q) || q.includes(b)));
  });
}

export function searchSyntheticBuyerCatalogueByComposition(params: {
  components: CompositionComponent[];
  page: number;
  pageSize: number;
  canonicalMap?: Record<string, string>;
  catalogue?: CatalogueProduct[];
}): {
  items: CatalogueProduct[];
  page: number;
  page_size: number;
  has_more: boolean;
  next_cursor: string | null;
} {
  const list = params.catalogue ?? SYNTHETIC_BUYER_CATALOGUE;
  let targetSig: string | null = null;
  try {
    targetSig = JSON.stringify(
      componentSignature(params.components, {
        requireConfidence: false,
        canonicalMap: params.canonicalMap,
      }),
    );
  } catch {
    targetSig = null;
  }

  const matched = targetSig
    ? list.filter((product) => {
        try {
          const prodSig = JSON.stringify(
            componentSignature(product.composition_components, {
              requireConfidence: false,
              canonicalMap: params.canonicalMap,
            }),
          );
          return prodSig === targetSig;
        } catch {
          return false;
        }
      })
    : [];

  const start = Math.max(0, (params.page - 1) * params.pageSize);
  const end = start + params.pageSize;
  const pageItems = matched.slice(start, end);
  const hasMore = end < matched.length;

  return {
    items: pageItems,
    page: params.page,
    page_size: params.pageSize,
    has_more: hasMore,
    next_cursor: hasMore ? `page_${params.page + 1}` : null,
  };
}
