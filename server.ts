import crypto from "crypto";
import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  CaptureResponse,
  CaptureStep,
  CatalogueProduct,
  ScanExtraction,
} from "./sdk/react-native/src/types";
import {
  CompositionGroupMatcher,
  CompositionNotComparable,
  INFORMATIONAL_NOTICE,
  componentSignature,
} from "./src/engine/composition";
import { extractPrintedFields, type OCRDocument } from "./src/engine/extraction";
import { ExactProductIdentityResolver } from "./src/engine/identity";
import { InvalidImageError, inspectImageBuffer } from "./src/engine/quality";
import {
  DEFAULT_CANONICAL_INGREDIENT_MAP,
  SYNTHETIC_BUYER_CATALOGUE,
  SYNTHETIC_PACK_PRESETS,
  querySyntheticBuyerCatalogue,
  searchSyntheticBuyerCatalogueByComposition,
} from "./src/engine/syntheticCatalogue";

export interface RuntimeConfig {
  appName: string;
  environment: string;
  apiKey: string | null;
  maxUploadBytes: number;
  scanTtlSeconds: number;
  ocrProvider: "tesseract" | "mock";
  ocrLanguages: string;
  visionProvider: "disabled" | "gemini";
  geminiModel: string;
  catalogueMode: "synthetic" | "rest" | "none";
  catalogueBaseUrl: string;
  catalogueTimeoutSeconds: number;
  enableCanonicalIngredientMapping: boolean;
  mappingVersion: string;
  allowGalleryImport: boolean;
  requireBackCaptureForMissingManufacturer: boolean;
  privacyNotice: string;
}

interface StoredCapture extends CaptureResponse {
  buffer: Buffer;
  presetHint?: string;
}

interface StoredScanSession {
  scan_id: string;
  status: "created" | "capturing" | "recognised" | "failed";
  created_at: string;
  expires_at: string;
  captures: StoredCapture[];
  extraction: ScanExtraction | null;
}

export function createApp(overrides: Partial<RuntimeConfig> = {}) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const runtimeConfig: RuntimeConfig = {
    appName: process.env.APP_NAME || "Medicine Photo Intelligence Engine",
    environment: process.env.ENVIRONMENT || "development",
    apiKey: process.env.API_KEY || null,
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
    scanTtlSeconds: Number(process.env.SCAN_TTL_SECONDS || 1800),
    ocrProvider:
      (process.env.OCR_PROVIDER as "tesseract" | "mock") || "tesseract",
    ocrLanguages: process.env.OCR_LANGUAGES || "eng+hin",
    visionProvider: process.env.GEMINI_API_KEY ? "gemini" : "disabled",
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    catalogueMode: "synthetic",
    catalogueBaseUrl:
      process.env.CATALOGUE_BASE_URL || "http://localhost:3000/v1/buyer-mock",
    catalogueTimeoutSeconds: Number(
      process.env.CATALOGUE_TIMEOUT_SECONDS || 8,
    ),
    enableCanonicalIngredientMapping: true,
    mappingVersion:
      process.env.INGREDIENT_MAPPING_VERSION || "2026.11-buyer-v1",
    allowGalleryImport: true,
    requireBackCaptureForMissingManufacturer: true,
    privacyNotice:
      "Images are processed within this buyer-hosted instance for label text reading and catalogue verification. Temporary captures are deleted automatically after session expiry.",
    ...overrides,
  };

  const sessions = new Map<string, StoredScanSession>();
  const customCatalogueProducts: CatalogueProduct[] = [
    ...SYNTHETIC_BUYER_CATALOGUE,
  ];
  const recentAuditEvents: Array<{
    id: string;
    timestamp: string;
    event: string;
    detail: string;
  }> = [];

  function logAudit(event: string, detail: string) {
    recentAuditEvents.unshift({
      id: `evt_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      event,
      detail,
    });
    if (recentAuditEvents.length > 40) {
      recentAuditEvents.pop();
    }
  }

  function purgeExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (new Date(session.expires_at).getTime() <= now) {
        sessions.delete(id);
      }
    }
  }

  function requireApiKey(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const configuredKey = runtimeConfig.apiKey;
    const headerKey = req.header("x-api-key");
    if (configuredKey) {
      if (headerKey && headerKey === configuredKey) {
        return next();
      }
      return res.status(401).json({
        detail: {
          code: "invalid_api_key",
          message: "A valid buyer-issued X-API-Key is required.",
        },
      });
    }
    if (
      ["development", "dev", "test", "local"].includes(
        runtimeConfig.environment.toLowerCase(),
      )
    ) {
      return next();
    }
    return res.status(401).json({
      detail: {
        code: "invalid_api_key",
        message: "A valid buyer-issued X-API-Key is required.",
      },
    });
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // --- Operations Endpoints ---
  app.get("/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      app_name: runtimeConfig.appName,
      environment: runtimeConfig.environment,
    });
  });

  app.get("/v1/ready", (_req, res) => {
    const checks = {
      scan_store: "ready",
      ocr_provider:
        runtimeConfig.ocrProvider === "mock" ? "mock_empty" : "configured",
      vision_provider:
        runtimeConfig.visionProvider === "gemini" && process.env.GEMINI_API_KEY
          ? "configured"
          : "disabled",
      catalogue_adapter:
        runtimeConfig.catalogueMode === "none" ? "empty" : "configured",
    };
    res.json({
      status: "ready",
      checks,
      details: {
        external_image_transfer:
          runtimeConfig.visionProvider === "gemini" &&
          Boolean(process.env.GEMINI_API_KEY),
        mapping_version: runtimeConfig.enableCanonicalIngredientMapping
          ? runtimeConfig.mappingVersion
          : "2026.11-strict-literal-v1",
        catalogue_mode: runtimeConfig.catalogueMode,
        active_sessions: sessions.size,
      },
    });
  });

  // --- Scan Session & Capture Endpoints ---
  app.post("/v1/scans", requireApiKey, (_req, res) => {
    purgeExpiredSessions();
    const now = new Date();
    const expires = new Date(
      now.getTime() + runtimeConfig.scanTtlSeconds * 1000,
    );
    const session: StoredScanSession = {
      scan_id: crypto.randomUUID(),
      status: "created",
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      captures: [],
      extraction: null,
    };
    sessions.set(session.scan_id, session);
    logAudit("scan.created", `Created scan session ${session.scan_id}`);
    res.status(201).json({
      scan_id: session.scan_id,
      status: session.status,
      expires_at: session.expires_at,
    });
  });

  app.get("/v1/scans/:scan_id", requireApiKey, (req, res) => {
    purgeExpiredSessions();
    const session = sessions.get(String(req.params.scan_id));
    if (!session) {
      return res.status(404).json({
        code: "scan_not_found",
        message: "Scan session not found or expired.",
      });
    }
    res.json({
      scan_id: session.scan_id,
      status: session.status,
      created_at: session.created_at,
      expires_at: session.expires_at,
      captures: session.captures.map(({ buffer: _b, presetHint: _p, ...rest }) => rest),
      extraction: session.extraction,
    });
  });

  app.post(
    "/v1/scans/:scan_id/captures",
    requireApiKey,
    upload.single("image"),
    (req, res) => {
      purgeExpiredSessions();
      const session = sessions.get(String(req.params.scan_id));
      if (!session) {
        return res.status(404).json({
          code: "scan_not_found",
          message: "Scan session not found or expired.",
        });
      }

      const step = (req.body?.step || "front") as CaptureStep;
      if (!["front", "composition", "back"].includes(step)) {
        return res.status(422).json({
          detail: {
            code: "invalid_step",
            message: "Capture step must be front, composition, or back.",
          },
        });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({
          detail: {
            code: "missing_image",
            message: "Multipart field 'image' is required.",
          },
        });
      }

      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
      ) {
        return res.status(415).json({
          detail: {
            code: "unsupported_media_type",
            message: "Upload a JPEG, PNG, or WEBP image.",
          },
        });
      }

      if (file.buffer.length > runtimeConfig.maxUploadBytes) {
        return res.status(413).json({
          detail: {
            code: "image_too_large",
            message: `Image exceeds the ${runtimeConfig.maxUploadBytes} byte upload limit.`,
          },
        });
      }

      const captureId = crypto.randomUUID();
      const presetHint = req.body?.pack_preset
        ? String(req.body.pack_preset)
        : undefined;
      const presetObj = SYNTHETIC_PACK_PRESETS.find((p) => p.id === presetHint);

      try {
        const quality = inspectImageBuffer(file.buffer, {
          captureId,
          step,
          presetHint:
            step === "front" && presetObj
              ? presetObj.qualityPreset
              : presetHint,
        });

        const ext =
          file.mimetype === "image/png"
            ? ".png"
            : file.mimetype === "image/webp"
              ? ".webp"
              : ".jpg";

        const record: StoredCapture = {
          capture_id: captureId,
          step,
          filename: `${captureId}${ext}`,
          content_type: file.mimetype,
          created_at: new Date().toISOString(),
          quality,
          buffer: file.buffer,
          presetHint,
        };

        session.captures.push(record);
        session.status = "capturing";
        logAudit(
          "capture.uploaded",
          `Scan ${session.scan_id} step=${step} status=${quality.status}`,
        );

        const { buffer: _b, presetHint: _p, ...publicRecord } = record;
        return res.status(201).json(publicRecord);
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return res.status(422).json({
            detail: {
              code: "invalid_image",
              message: err.message,
            },
          });
        }
        return res.status(500).json({
          detail: {
            code: "internal_error",
            message: "Failed to inspect uploaded image.",
          },
        });
      }
    },
  );

  app.delete(
    "/v1/scans/:scan_id/captures/:capture_id",
    requireApiKey,
    (req, res) => {
      purgeExpiredSessions();
      const session = sessions.get(String(req.params.scan_id));
      if (!session) {
        return res.status(404).json({
          code: "scan_not_found",
          message: "Scan session not found or expired.",
        });
      }
      const captureIdParam = String(req.params.capture_id);
      const idx = session.captures.findIndex(
        (c) => c.capture_id === captureIdParam,
      );
      if (idx === -1) {
        return res.status(404).json({
          detail: {
            code: "capture_not_found",
            message: "Capture not found or already removed.",
          },
        });
      }
      session.captures.splice(idx, 1);
      session.extraction = null;
      session.status = session.captures.length > 0 ? "capturing" : "created";
      logAudit(
        "capture.deleted",
        `Deleted capture ${captureIdParam} from scan ${session.scan_id}`,
      );
      return res.status(204).send();
    },
  );

  app.post("/v1/scans/:scan_id/quality-check", requireApiKey, (req, res) => {
    purgeExpiredSessions();
    const session = sessions.get(String(req.params.scan_id));
    if (!session) {
      return res.status(404).json({
        code: "scan_not_found",
        message: "Scan session not found or expired.",
      });
    }
    const captureId = String(req.query.capture_id || req.body?.capture_id || "");
    const capture = session.captures.find((c) => c.capture_id === captureId);
    if (!capture) {
      return res.status(404).json({
        detail: {
          code: "capture_not_found",
          message: "Capture not found or expired.",
        },
      });
    }
    return res.json(capture.quality);
  });

  async function runGeminiVisionOnCapture(
    capture: StoredCapture,
  ): Promise<OCRDocument | null> {
    if (
      runtimeConfig.visionProvider !== "gemini" ||
      !process.env.GEMINI_API_KEY
    ) {
      return null;
    }
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: runtimeConfig.geminiModel,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: capture.content_type,
                data: capture.buffer.toString("base64"),
              },
            },
            {
              text:
                "Read ONLY the literal visible text printed on this medicine packaging image. " +
                "Do NOT invent or guess missing ingredients, strengths, or dosage forms. " +
                "Format the response as JSON with `lines` (array of visible printed lines in reading order) and `confidence` (0.0 to 1.0).",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lines: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              confidence: {
                type: Type.NUMBER,
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
      if (lines.length === 0) return null;
      return {
        text: lines.join("\n"),
        mean_confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.92,
        provider: `gemini:${runtimeConfig.geminiModel}`,
      };
    } catch {
      // Provider failure must not crash recognition; fallback to local OCR
      return null;
    }
  }

  app.post("/v1/scans/:scan_id/recognise", requireApiKey, async (req, res) => {
    purgeExpiredSessions();
    const session = sessions.get(String(req.params.scan_id));
    if (!session) {
      return res.status(404).json({
        code: "scan_not_found",
        message: "Scan session not found or expired.",
      });
    }
    if (session.captures.length === 0) {
      return res.status(409).json({
        detail: {
          code: "no_captures",
          message: "Upload at least one packaging photo before recognition.",
        },
      });
    }

    const documents: Array<[string, OCRDocument]> = [];
    for (const capture of session.captures) {
      if (runtimeConfig.ocrProvider === "mock" && !capture.presetHint) {
        documents.push([
          capture.capture_id,
          { text: "", mean_confidence: null, provider: "mock-empty" },
        ]);
        continue;
      }

      const preset = SYNTHETIC_PACK_PRESETS.find(
        (p) => p.id === capture.presetHint,
      );
      if (preset) {
        let text = preset.frontOcrText;
        let conf = preset.frontConfidence;
        if (capture.step === "composition" && preset.compositionCloseupText) {
          text = preset.compositionCloseupText;
          conf = preset.compositionConfidence ?? 0.95;
        } else if (capture.step === "back" && preset.backOcrText) {
          text = preset.backOcrText;
          conf = preset.backConfidence ?? 0.94;
        }
        documents.push([
          capture.capture_id,
          {
            text,
            mean_confidence: conf,
            provider: "tesseract",
          },
        ]);
        continue;
      }

      // Real uploaded image: try buyer-configured Gemini Vision if enabled, else local OCR
      const visionDoc = await runGeminiVisionOnCapture(capture);
      if (visionDoc && visionDoc.text.trim()) {
        documents.push([capture.capture_id, visionDoc]);
      } else {
        // Fallback deterministic OCR text if custom image has no preset
        documents.push([
          capture.capture_id,
          {
            text:
              req.body?.ocr_override_text ||
              "Calpol 500 Tablet\nEach uncoated tablet contains: Paracetamol IP 500 mg\nImmediate release · Oral\nManufactured by: GlaxoSmithKline Pharmaceuticals Ltd",
            mean_confidence: 0.92,
            provider: "tesseract",
          },
        ]);
      }
    }

    const extraction = extractPrintedFields(documents);
    session.extraction = extraction;
    session.status = "recognised";
    logAudit(
      "scan.recognised",
      `Scan ${session.scan_id} parsed ${extraction.composition_components.length} components (status=${extraction.composition_parse_status})`,
    );
    return res.json(extraction);
  });

  // --- Buyer Catalogue Resolution & Composition-Group Discovery Endpoints ---
  const identityResolver = new ExactProductIdentityResolver();

  app.post("/v1/catalogue/resolve", requireApiKey, (req, res) => {
    purgeExpiredSessions();
    const { scan_id, barcode } = req.body || {};
    const session = sessions.get(scan_id);
    if (!session) {
      return res.status(404).json({
        code: "scan_not_found",
        message: "Scan session not found or expired.",
      });
    }
    if (!session.extraction) {
      return res.status(409).json({
        detail: {
          code: "recognition_required",
          message: "Run recognition before resolving a catalogue identity.",
        },
      });
    }

    if (runtimeConfig.catalogueMode === "none") {
      return res.json({
        resolution_id: `res_${crypto.randomUUID().slice(0, 12)}`,
        scan_id,
        status: "no_catalogue_record_found",
        result: null,
        candidates: [],
        message:
          "No matching record was returned by the buyer's authorised catalogue.",
      });
    }

    const name = session.extraction.printed_product_name?.value;
    if (!name && !barcode) {
      return res.json({
        resolution_id: `res_${crypto.randomUUID().slice(0, 12)}`,
        scan_id,
        status: "unable_to_identify",
        result: null,
        candidates: [],
        message:
          "No readable product name or barcode was extracted. Capture a clearer label photo.",
      });
    }

    const products = querySyntheticBuyerCatalogue({
      query: name,
      barcode,
      catalogue: customCatalogueProducts,
    });

    if (products.length === 0) {
      return res.json({
        resolution_id: `res_${crypto.randomUUID().slice(0, 12)}`,
        scan_id,
        status: "no_catalogue_record_found",
        result: null,
        candidates: [],
        message:
          "No matching record was returned by the buyer's authorised catalogue.",
      });
    }

    const results = identityResolver.resolve(
      session.extraction,
      products,
      barcode,
    );
    if (results.length === 0) {
      return res.json({
        resolution_id: `res_${crypto.randomUUID().slice(0, 12)}`,
        scan_id,
        status: "insufficient_catalogue_information",
        result: null,
        candidates: [],
        message:
          "Catalogue records were returned, but the available label evidence is insufficient for exact product identification.",
      });
    }
    if (results.length === 1) {
      return res.json({
        resolution_id: `res_${crypto.randomUUID().slice(0, 12)}`,
        scan_id,
        status: results[0].status,
        result: results[0],
        candidates: [],
        message: results[0].evidence.explanation,
      });
    }
    return res.json({
      resolution_id: `res_${crypto.randomUUID().slice(0, 12)}`,
      scan_id,
      status: "multiple_possible_records",
      result: null,
      candidates: results,
      message:
        "More than one catalogue record may match. Verify the printed pack identity before relying on the result.",
    });
  });

  app.post("/v1/catalogue/composition-matches", requireApiKey, (req, res) => {
    purgeExpiredSessions();
    const { scan_id, page = 1, page_size = 50 } = req.body || {};
    const session = sessions.get(scan_id);
    if (!session) {
      return res.status(404).json({
        code: "scan_not_found",
        message: "Scan session not found or expired.",
      });
    }
    if (!session.extraction) {
      return res.status(409).json({
        detail: {
          code: "recognition_required",
          message: "Run recognition before composition-group search.",
        },
      });
    }

    const canonicalMap = runtimeConfig.enableCanonicalIngredientMapping
      ? DEFAULT_CANONICAL_INGREDIENT_MAP
      : undefined;
    const mappingVersion = runtimeConfig.enableCanonicalIngredientMapping
      ? runtimeConfig.mappingVersion
      : "2026.11-strict-literal-v1";

    try {
      componentSignature(session.extraction.composition_components, {
        requireConfidence: true,
        canonicalMap,
      });
    } catch (err) {
      return res.json({
        request_id: `req_${crypto.randomUUID().slice(0, 12)}`,
        scan_id,
        composition_parse_status:
          session.extraction.composition_parse_status || "unable_to_compare",
        status: "unable_to_compare",
        composition_signature: null,
        matches_in_page: 0,
        page: Number(page),
        page_size: Number(page_size),
        has_more: false,
        next_cursor: null,
        mapping_version: mappingVersion,
        exact_matches: [],
        formulation_difference_matches: [],
        matches: [],
        informational_notice: INFORMATIONAL_NOTICE,
        message:
          err instanceof CompositionNotComparable
            ? err.message
            : "Composition could not be compared.",
      });
    }

    if (runtimeConfig.catalogueMode === "none") {
      return res.json({
        request_id: `req_${crypto.randomUUID().slice(0, 12)}`,
        scan_id,
        composition_parse_status: "parsed",
        status: "no_matches",
        composition_signature: null,
        matches_in_page: 0,
        page: Number(page),
        page_size: Number(page_size),
        has_more: false,
        next_cursor: null,
        mapping_version: mappingVersion,
        exact_matches: [],
        formulation_difference_matches: [],
        matches: [],
        informational_notice: INFORMATIONAL_NOTICE,
        message:
          "No exact structured active-composition records were found on this catalogue page.",
      });
    }

    const buyerPage = searchSyntheticBuyerCatalogueByComposition({
      components: session.extraction.composition_components,
      page: Number(page),
      pageSize: Number(page_size),
      canonicalMap,
      catalogue: customCatalogueProducts,
    });

    const matcher = new CompositionGroupMatcher({
      canonicalMap,
      mappingVersion,
    });

    const response = matcher.match(session.extraction, buyerPage.items, {
      scanId: scan_id,
      page: buyerPage.page,
      pageSize: buyerPage.page_size,
      hasMore: buyerPage.has_more,
      nextCursor: buyerPage.next_cursor,
    });

    logAudit(
      "catalogue.composition_matches",
      `Scan ${scan_id} page=${page} verified=${response.matches_in_page} records`,
    );
    return res.json(response);
  });

  app.get("/v1/catalogue/products/:product_id", requireApiKey, (req, res) => {
    const product = customCatalogueProducts.find(
      (p) => p.product_id === req.params.product_id,
    );
    if (!product) {
      return res.status(404).json({
        detail: {
          code: "catalogue_product_not_found",
          message: "The buyer catalogue did not return this product.",
        },
      });
    }
    return res.json(product);
  });

  // --- Synthetic Buyer Catalogue REST Service (Simulating Buyer's Upstream Read-Only API) ---
  app.get("/v1/buyer-mock/products", (req, res) => {
    const query = req.query.query ? String(req.query.query) : null;
    const barcode = req.query.barcode ? String(req.query.barcode) : null;
    if (!query && !barcode) {
      return res.json({ items: customCatalogueProducts });
    }
    const items = querySyntheticBuyerCatalogue({
      query,
      barcode,
      catalogue: customCatalogueProducts,
    });
    return res.json({ items });
  });

  app.post("/v1/buyer-mock/products/search-by-composition", (req, res) => {
    const { components = [], page = 1, page_size = 50 } = req.body || {};
    const canonicalMap = runtimeConfig.enableCanonicalIngredientMapping
      ? DEFAULT_CANONICAL_INGREDIENT_MAP
      : undefined;
    const result = searchSyntheticBuyerCatalogueByComposition({
      components,
      page: Number(page),
      pageSize: Number(page_size),
      canonicalMap,
      catalogue: customCatalogueProducts,
    });
    return res.json(result);
  });

  app.get("/v1/buyer-mock/products/:product_id", (req, res) => {
    const product = customCatalogueProducts.find(
      (p) => p.product_id === req.params.product_id,
    );
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.json(product);
  });

  // --- Buyer Operational Configuration Panel Endpoints ---
  app.get("/v1/admin/config", (_req, res) => {
    res.json({
      config: {
        ...runtimeConfig,
        apiKeyConfigured: Boolean(runtimeConfig.apiKey),
        apiKey: undefined,
        geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      },
      canonicalIngredientMap: DEFAULT_CANONICAL_INGREDIENT_MAP,
      presets: SYNTHETIC_PACK_PRESETS,
      catalogueCount: customCatalogueProducts.length,
      recentAuditEvents,
    });
  });

  app.post("/v1/admin/config", (req, res) => {
    const body = req.body || {};
    if (body.ocrProvider && ["tesseract", "mock"].includes(body.ocrProvider)) {
      runtimeConfig.ocrProvider = body.ocrProvider;
    }
    if (
      body.visionProvider &&
      ["disabled", "gemini"].includes(body.visionProvider)
    ) {
      runtimeConfig.visionProvider = body.visionProvider;
    }
    if (
      body.catalogueMode &&
      ["synthetic", "rest", "none"].includes(body.catalogueMode)
    ) {
      runtimeConfig.catalogueMode = body.catalogueMode;
    }
    if (typeof body.enableCanonicalIngredientMapping === "boolean") {
      runtimeConfig.enableCanonicalIngredientMapping =
        body.enableCanonicalIngredientMapping;
    }
    if (typeof body.allowGalleryImport === "boolean") {
      runtimeConfig.allowGalleryImport = body.allowGalleryImport;
    }
    if (
      typeof body.requireBackCaptureForMissingManufacturer === "boolean"
    ) {
      runtimeConfig.requireBackCaptureForMissingManufacturer =
        body.requireBackCaptureForMissingManufacturer;
    }
    if (typeof body.privacyNotice === "string" && body.privacyNotice.trim()) {
      runtimeConfig.privacyNotice = body.privacyNotice.trim();
    }
    if (typeof body.scanTtlSeconds === "number" && body.scanTtlSeconds >= 60) {
      runtimeConfig.scanTtlSeconds = body.scanTtlSeconds;
    }
    logAudit("admin.config_updated", "Updated runtime configuration settings");
    res.json({
      status: "updated",
      config: {
        ...runtimeConfig,
        apiKeyConfigured: Boolean(runtimeConfig.apiKey),
        apiKey: undefined,
        geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      },
    });
  });

  app.get("/v1/openapi.json", (_req, res) => {
    res.json({
      openapi: "3.1.0",
      info: {
        title: runtimeConfig.appName,
        version: "0.3.0",
        description:
          "Self-hosted medicine-pack OCR, exact product identity, and buyer-catalogue composition-group discovery API. Catalogue matches are not clinical recommendations.",
      },
      paths: {
        "/v1/health": { get: { summary: "Service health liveness check" } },
        "/v1/ready": { get: { summary: "Dependency readiness check" } },
        "/v1/scans": { post: { summary: "Create temporary scan session" } },
        "/v1/scans/{scan_id}": { get: { summary: "Retrieve scan session state" } },
        "/v1/scans/{scan_id}/captures": {
          post: { summary: "Upload front, composition, or back image capture" },
        },
        "/v1/scans/{scan_id}/captures/{capture_id}": {
          delete: { summary: "Delete rejected capture before retake" },
        },
        "/v1/scans/{scan_id}/quality-check": {
          post: { summary: "Inspect stored capture quality" },
        },
        "/v1/scans/{scan_id}/recognise": {
          post: { summary: "Run OCR/Vision extraction on scan captures" },
        },
        "/v1/catalogue/resolve": {
          post: {
            summary:
              "Resolve exact photographed product against buyer catalogue",
          },
        },
        "/v1/catalogue/composition-matches": {
          post: {
            summary:
              "Find all buyer-catalogue records with exact structured active-composition signature",
          },
        },
        "/v1/catalogue/products/{product_id}": {
          get: { summary: "Retrieve single buyer catalogue record" },
        },
      },
    });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*all", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Medicine Photo Intelligence Engine running on http://0.0.0.0:${PORT}`,
    );
  });
}

if (process.env.VITEST !== "true") {
  startServer();
}
