import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCode2,
  Flashlight,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  Upload,
  X,
} from "lucide-react";
import { MedicineEngineClient } from "../sdk/react-native/src/client";
import {
  type CameraPermissionState,
  type ScannerScreenId,
  determineNextGuidedStage,
  evaluateCaptureReviewBanner,
} from "../sdk/react-native/src/scanner";
import type {
  CaptureResponse,
  CaptureStep,
  CatalogueProduct,
  CatalogueResolveResponse,
  CompositionMatchResponse,
  ScanExtraction,
} from "../sdk/react-native/src/types";
import {
  SYNTHETIC_PACK_PRESETS,
  type SyntheticPackPreset,
} from "./engine/syntheticCatalogue";

type WorkspaceTab = "scanner" | "verifier" | "catalogue" | "admin";

interface AdminConfigResponse {
  config: {
    appName: string;
    environment: string;
    apiKeyConfigured: boolean;
    geminiKeyConfigured: boolean;
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
  };
  canonicalIngredientMap: Record<string, string>;
  catalogueCount: number;
  recentAuditEvents: Array<{
    id: string;
    timestamp: string;
    event: string;
    detail: string;
  }>;
}

const engineClient = new MedicineEngineClient({ baseUrl: "" });

async function renderSyntheticPackBlob(
  preset: SyntheticPackPreset,
  step: CaptureStep,
  overrideQuality?: "clear" | "blur" | "glare",
): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 680;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const qualityMode =
    overrideQuality || (step === "front" ? preset.qualityPreset : "clear");

  ctx.save();
  if (qualityMode === "blur") {
    ctx.filter = "blur(3.5px)";
  }

  // Outer pack card
  ctx.fillStyle = preset.visualTheme.stripBg;
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(70, 60, 820, 560, 20);
  ctx.fill();
  ctx.stroke();

  // Top accent bar
  ctx.fillStyle = preset.visualTheme.accentColor;
  ctx.fillRect(70, 60, 820, 68);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 22px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(
    step === "front"
      ? "FRONT PACK LABEL · STAGE A"
      : step === "composition"
        ? "COMPOSITION CLOSE-UP · STAGE B"
        : "BACK / MANUFACTURER LABEL · STAGE C",
    105,
    102,
  );

  // Main printed text
  ctx.fillStyle = "#0f172a";
  if (step === "front") {
    ctx.font = "700 38px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(preset.visualTheme.brandTitle, 105, 195);

    ctx.fillStyle = "#334155";
    ctx.font = "500 24px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(preset.visualTheme.rxLine, 105, 245);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(105, 275);
    ctx.lineTo(845, 275);
    ctx.stroke();

    const fontSize = preset.qualityPreset === "small_text" ? 13 : 22;
    ctx.font = `500 ${fontSize}px 'IBM Plex Mono', monospace`;
    ctx.fillStyle = "#1e293b";
    preset.visualTheme.compLines.forEach((line, idx) => {
      ctx.fillText(line, 105, 325 + idx * (fontSize + 14));
    });

    if (!preset.requiresBackCapture) {
      ctx.fillStyle = "#475569";
      ctx.font = "500 18px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(preset.visualTheme.mfgLine, 105, 535);
    }

    if (preset.barcode) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "500 15px 'IBM Plex Mono', monospace";
      ctx.fillText(`GTIN / Barcode: ${preset.barcode}`, 105, 575);
    }
  } else if (step === "composition") {
    ctx.font = "700 28px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("DETAILED COMPOSITION PANEL (MACRO FOCUS)", 105, 185);

    ctx.font = "600 25px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#0f172a";
    const lines = (
      preset.compositionCloseupText || preset.frontOcrText
    ).split("\n");
    lines.forEach((line, idx) => {
      ctx.fillText(line, 105, 255 + idx * 46);
    });
  } else {
    ctx.font = "700 28px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("MANUFACTURER & REGULATORY DETAILS", 105, 190);

    ctx.font = "500 24px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(preset.visualTheme.mfgLine, 105, 265);
    ctx.fillText("Store in a cool, dry place below 25°C.", 105, 320);
    if (preset.barcode) {
      ctx.fillText(`Barcode: ${preset.barcode}`, 105, 375);
    }
  }

  if (qualityMode === "glare") {
    const grad = ctx.createRadialGradient(480, 320, 20, 480, 320, 290);
    grad.addColorStop(0, "rgba(255,255,255,0.97)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.75)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(70, 60, 820, 560);
  }

  ctx.restore();

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  return { blob, dataUrl };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("scanner");

  // Guided Scanner State (Screens S0 -> S6)
  const [screen, setScreen] = useState<ScannerScreenId>("S0_ENTRY");
  const [cameraPermission, setCameraPermission] =
    useState<CameraPermissionState>("granted");
  const [selectedPreset, setSelectedPreset] = useState<SyntheticPackPreset>(
    SYNTHETIC_PACK_PRESETS[0],
  );
  const [currentStep, setCurrentStep] = useState<CaptureStep>("front");
  const [torchOn, setTorchOn] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [useLiveWebcam, setUseLiveWebcam] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active Scan Session Data
  const [scanId, setScanId] = useState<string | null>(null);
  const [captures, setCaptures] = useState<
    Array<{ record: CaptureResponse; previewUrl: string }>
  >([]);
  const [latestCapture, setLatestCapture] = useState<{
    record: CaptureResponse;
    previewUrl: string;
  } | null>(null);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ScanExtraction | null>(null);
  const [identityResult, setIdentityResult] =
    useState<CatalogueResolveResponse | null>(null);
  const [compositionResult, setCompositionResult] =
    useState<CompositionMatchResponse | null>(null);
  const [compositionPage, setCompositionPage] = useState(1);
  const [compositionPageSize, setCompositionPageSize] = useState(2);
  const [scannerHelpOpen, setScannerHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Catalogue & Admin State
  const [catalogueProducts, setCatalogueProducts] = useState<
    CatalogueProduct[]
  >([]);
  const [catalogueSearchQuery, setCatalogueSearchQuery] = useState("");
  const [adminData, setAdminData] = useState<AdminConfigResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<{
    health: string;
    ready: string;
    externalTransfer: boolean;
  }>({ health: "ok", ready: "ready", externalTransfer: false });

  // Custom Verifier Sandbox State
  const [customOcrText, setCustomOcrText] = useState(
    "Panadol Extra Advance Tablet\nEach film coated tablet contains: Paracetamol IP 500 mg + Caffeine IP 30 mg\nExcipients: Starch 15 mg\nImmediate release · Oral\nManufactured by: Haleon Healthcare Ltd",
  );
  const [sandboxExtraction, setSandboxExtraction] =
    useState<ScanExtraction | null>(null);
  const [sandboxMatches, setSandboxMatches] =
    useState<CompositionMatchResponse | null>(null);

  useEffect(() => {
    refreshAdminAndCatalogue();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (
      useLiveWebcam &&
      (screen === "S1_FRONT_CAMERA" ||
        screen === "S3_COMPOSITION_CLOSEUP" ||
        screen === "S4_BACK_CAMERA")
    ) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          setUseLiveWebcam(false);
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [useLiveWebcam, screen]);

  async function refreshAdminAndCatalogue() {
    try {
      const [cfgRes, prodRes, readyRes] = await Promise.all([
        fetch("/v1/admin/config").then((r) => r.json()),
        fetch("/v1/buyer-mock/products").then((r) => r.json()),
        fetch("/v1/ready").then((r) => r.json()),
      ]);
      setAdminData(cfgRes);
      setCatalogueProducts(prodRes.items || []);
      setHealthStatus({
        health: "ok",
        ready: readyRes.status || "ready",
        externalTransfer: Boolean(readyRes.details?.external_image_transfer),
      });
    } catch {
      // ignore initial fetch error
    }
  }

  async function handleStartNewScan() {
    setActiveTab("scanner");
    setProcessingError(null);
    setExtraction(null);
    setIdentityResult(null);
    setCompositionResult(null);
    setCaptures([]);
    setLatestCapture(null);
    setCurrentStep("front");
    setScreen("S0_ENTRY");
  }

  async function handleBeginCameraFromEntry() {
    if (cameraPermission === "denied") {
      return;
    }
    setBusy(true);
    setProcessingError(null);
    try {
      const session = await engineClient.createScanSession();
      setScanId(session.scan_id);
      setCurrentStep("front");
      setScreen("S1_FRONT_CAMERA");
      await refreshAdminAndCatalogue();
    } catch (err) {
      setProcessingError(
        err instanceof Error ? err.message : "Could not start scan session.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCapturePhoto(
    step: CaptureStep,
    overrideQuality?: "clear" | "blur" | "glare",
  ) {
    if (!scanId) return;
    setBusy(true);
    setProcessingError(null);
    try {
      let blob: Blob;
      let dataUrl: string;

      if (useLiveWebcam && videoRef.current && videoRef.current.videoWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(videoRef.current, 0, 0);
        dataUrl = canvas.toDataURL("image/png");
        blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png"),
        );
      } else {
        const rendered = await renderSyntheticPackBlob(
          selectedPreset,
          step,
          overrideQuality,
        );
        blob = rendered.blob;
        dataUrl = rendered.dataUrl;
      }

      const hint =
        overrideQuality === "clear"
          ? `${selectedPreset.id}_clear`
          : selectedPreset.id;

      const uploaded = await engineClient.uploadMedicineImage(
        scanId,
        step,
        blob,
        "image/png",
        step === "front" && overrideQuality === "clear"
          ? "preset_calpol_500"
          : hint,
      );

      const item = { record: uploaded, previewUrl: dataUrl };
      setLatestCapture(item);
      setCaptures((prev) => [...prev.filter((c) => c.record.step !== step), item]);
      setScreen("S2_CAPTURE_REVIEW");
    } catch (err) {
      setProcessingError(
        err instanceof Error ? err.message : "Failed to upload capture.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setProcessingError(null);
    try {
      let activeScanId = scanId;
      if (!activeScanId) {
        const session = await engineClient.createScanSession();
        activeScanId = session.scan_id;
        setScanId(activeScanId);
      }
      const previewUrl = URL.createObjectURL(file);
      const uploaded = await engineClient.uploadMedicineImage(
        activeScanId,
        currentStep,
        file,
        (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/png",
        selectedPreset.id,
      );
      const item = { record: uploaded, previewUrl };
      setLatestCapture(item);
      setCaptures((prev) => [
        ...prev.filter((c) => c.record.step !== currentStep),
        item,
      ]);
      setScreen("S2_CAPTURE_REVIEW");
    } catch (err) {
      setProcessingError(
        err instanceof Error ? err.message : "Failed to upload selected image.",
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleRetakeCapture() {
    if (!scanId || !latestCapture) return;
    setBusy(true);
    try {
      await engineClient.removeCapture(scanId, latestCapture.record.capture_id);
      setCaptures((prev) =>
        prev.filter(
          (c) => c.record.capture_id !== latestCapture.record.capture_id,
        ),
      );
      const step = latestCapture.record.step;
      setLatestCapture(null);
      if (step === "composition") {
        setScreen("S3_COMPOSITION_CLOSEUP");
      } else if (step === "back") {
        setScreen("S4_BACK_CAMERA");
      } else {
        setScreen("S1_FRONT_CAMERA");
      }
    } catch (err) {
      setProcessingError(
        err instanceof Error ? err.message : "Failed to remove capture.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptCaptureAndAdvance() {
    if (!scanId || !latestCapture) return;
    const completedSteps = captures.map((c) => c.record.step);
    const config = {
      allowGalleryImport: adminData?.config.allowGalleryImport ?? true,
      maxUploadBytes: adminData?.config.maxUploadBytes ?? 10485760,
      privacyNotice: adminData?.config.privacyNotice ?? "",
      externalAiEnabled: healthStatus.externalTransfer,
      requireBackCaptureForMissingManufacturer:
        adminData?.config.requireBackCaptureForMissingManufacturer ?? true,
    };

    if (
      !completedSteps.includes("composition") &&
      selectedPreset.requiresCloseup
    ) {
      setCurrentStep("composition");
      setScreen("S3_COMPOSITION_CLOSEUP");
      return;
    }

    if (
      config.requireBackCaptureForMissingManufacturer &&
      !completedSteps.includes("back") &&
      selectedPreset.requiresBackCapture
    ) {
      setCurrentStep("back");
      setScreen("S4_BACK_CAMERA");
      return;
    }

    const decision = determineNextGuidedStage({
      completedSteps,
      latestCapture: latestCapture.record,
      config,
    });

    if (decision.nextScreen === "S3_COMPOSITION_CLOSEUP") {
      setCurrentStep("composition");
      setScreen("S3_COMPOSITION_CLOSEUP");
      return;
    }
    if (decision.nextScreen === "S4_BACK_CAMERA") {
      setCurrentStep("back");
      setScreen("S4_BACK_CAMERA");
      return;
    }

    await runFullRecognitionPipeline(scanId, 1, compositionPageSize);
  }

  async function runFullRecognitionPipeline(
    activeScanId: string,
    page = 1,
    pageSize = compositionPageSize,
  ) {
    setScreen("S5_PROCESSING");
    setProcessingError(null);
    setProcessingStageIndex(0);

    try {
      setProcessingStageIndex(1);
      await new Promise((r) => setTimeout(r, 180));
      const ext = await engineClient.recogniseMedicine(activeScanId);
      setExtraction(ext);

      setProcessingStageIndex(2);
      await new Promise((r) => setTimeout(r, 180));
      const resolved = await engineClient.resolveProductIdentity(
        activeScanId,
        selectedPreset.barcode,
      );
      setIdentityResult(resolved);

      setProcessingStageIndex(3);
      await new Promise((r) => setTimeout(r, 180));
      const compMatches = await engineClient.findCompositionMatches(
        activeScanId,
        page,
        pageSize,
      );
      setCompositionResult(compMatches);
      setCompositionPage(page);

      setProcessingStageIndex(4);
      await new Promise((r) => setTimeout(r, 140));
      setScreen("S6_RESULTS");
      await refreshAdminAndCatalogue();
    } catch (err) {
      setProcessingError(
        err instanceof Error ? err.message : "Recognition pipeline failed.",
      );
    }
  }

  async function handleChangeCompositionPage(nextPage: number) {
    if (!scanId || nextPage < 1) return;
    setBusy(true);
    try {
      const compMatches = await engineClient.findCompositionMatches(
        scanId,
        nextPage,
        compositionPageSize,
      );
      setCompositionResult(compMatches);
      setCompositionPage(nextPage);
    } finally {
      setBusy(false);
    }
  }

  async function handleRunSandboxVerifier() {
    setBusy(true);
    try {
      const session = await engineClient.createScanSession();
      const rendered = await renderSyntheticPackBlob(
        SYNTHETIC_PACK_PRESETS[0],
        "front",
        "clear",
      );
      await engineClient.uploadMedicineImage(
        session.scan_id,
        "front",
        rendered.blob,
        "image/png",
      );
      const extRes = await fetch(
        `/v1/scans/${encodeURIComponent(session.scan_id)}/recognise`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ocr_override_text: customOcrText }),
        },
      ).then((r) => r.json());
      setSandboxExtraction(extRes);

      const matchRes = await engineClient.findCompositionMatches(
        session.scan_id,
        1,
        20,
      );
      setSandboxMatches(matchRes);
      await refreshAdminAndCatalogue();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateAdminSetting(
    patch: Partial<AdminConfigResponse["config"]>,
  ) {
    const res = await fetch("/v1/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => r.json());
    if (res.config) {
      await refreshAdminAndCatalogue();
    }
  }

  const filteredCatalogue = catalogueProducts.filter((item) => {
    if (!catalogueSearchQuery.trim()) return true;
    const q = catalogueSearchQuery.toLowerCase();
    return (
      item.display_name.toLowerCase().includes(q) ||
      item.product_id.toLowerCase().includes(q) ||
      (item.composition_text || "").toLowerCase().includes(q) ||
      (item.manufacturer || "").toLowerCase().includes(q)
    );
  });

  const reviewBanner = latestCapture
    ? evaluateCaptureReviewBanner(latestCapture.record.quality)
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 1-line Brand Wordmark | 4 Single-Line Nav Links | 1 Primary Action */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab("scanner");
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Medicine Photo Intelligence Engine
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("scanner")}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === "scanner"
                ? "text-slate-900 border-b-2 border-teal-700 font-semibold"
                : ""
            }`}
          >
            Guided Scanner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("verifier")}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === "verifier"
                ? "text-slate-900 border-b-2 border-teal-700 font-semibold"
                : ""
            }`}
          >
            Composition Verifier
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalogue")}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === "catalogue"
                ? "text-slate-900 border-b-2 border-teal-700 font-semibold"
                : ""
            }`}
          >
            Buyer Catalogue
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === "admin"
                ? "text-slate-900 border-b-2 border-teal-700 font-semibold"
                : ""
            }`}
          >
            Operational Config
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleStartNewScan}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            New Medicine Scan
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center gap-1 px-4 py-2 bg-white border-b border-slate-200 overflow-x-auto">
        {(
          [
            ["scanner", "Guided Scanner"],
            ["verifier", "Composition Verifier"],
            ["catalogue", "Buyer Catalogue"],
            ["admin", "Operational Config"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeTab === id
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8">
        {activeTab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Embedded Guided Scanner Reference Device (Screens S0 - S6) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Scanner Top Bar */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
                <div className="flex items-center gap-3">
                  {screen !== "S0_ENTRY" && (
                    <button
                      type="button"
                      onClick={handleStartNewScan}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      aria-label="Reset scan"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <span className="text-sm font-semibold tracking-tight">
                    Scan medicine pack
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300 font-mono tabular-nums">
                  {screen === "S1_FRONT_CAMERA" && (
                    <span>
                      Photo 1 of{" "}
                      {selectedPreset.requiresCloseup ||
                      selectedPreset.requiresBackCapture
                        ? "2"
                        : "1"}
                    </span>
                  )}
                  {screen === "S3_COMPOSITION_CLOSEUP" && (
                    <span>Photo 2 of 2 · Close-up</span>
                  )}
                  {screen === "S4_BACK_CAMERA" && (
                    <span>Back / Side Details</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setScannerHelpOpen((v) => !v)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label="Scanner guidance help"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {scannerHelpOpen && (
                <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between gap-4">
                  <span>
                    Keep the medicine strip or carton flat inside the guide.
                    Avoid strong overhead reflections on foil packaging.
                  </span>
                  <button
                    type="button"
                    onClick={() => setScannerHelpOpen(false)}
                    className="text-slate-900 font-semibold whitespace-nowrap shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Screen S0 — Scanner Entry */}
              {screen === "S0_ENTRY" && (
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">
                      <span>Self-Hosted B2B Scanner SDK</span>
                      <span aria-hidden="true"> · </span>
                      <span>Screen S0 (Entry)</span>
                      <span aria-hidden="true"> · </span>
                      <span>Read-Only Buyer Catalogue</span>
                    </div>
                    <h1
                      className="text-2xl font-bold text-slate-900"
                      style={{ textWrap: "balance" }}
                    >
                      Scan medicine pack
                    </h1>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                      Keep the pack inside the frame. We will guide you if
                      another photo is needed.
                    </p>
                  </div>

                  {/* Camera Permission Control & Preview Stage */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-semibold text-slate-700">
                        Camera Permission State
                      </span>
                      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                        {(["granted", "prompt", "denied"] as const).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setCameraPermission(st)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                                cameraPermission === st
                                  ? "bg-white text-slate-900 shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              {st === "granted"
                                ? "Permission Allowed"
                                : st === "prompt"
                                  ? "Ask on Start"
                                  : "Permission Denied"}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {cameraPermission === "denied" ? (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1.5">
                        <p className="font-semibold">
                          Camera access is currently disabled in device
                          settings.
                        </p>
                        <p>
                          To scan a medicine pack, open your device Settings →
                          App Permissions → Camera and allow access, or return
                          safely to the host app.
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600">
                        Selected test pack:{" "}
                        <span className="font-semibold text-slate-900">
                          {selectedPreset.title}
                        </span>{" "}
                        · {selectedPreset.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Buyer-Controlled Privacy Notice */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <div className="text-xs font-semibold text-slate-800">
                      Buyer-Configured Privacy & Data Processing Notice
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {adminData?.config.privacyNotice ||
                        "Images are processed within this buyer-hosted instance for printed text extraction and read-only catalogue lookup."}
                    </p>
                    <div className="text-xs text-slate-500 pt-1">
                      <span>
                        External AI Image Transfer:{" "}
                        <strong className="text-slate-800">
                          {healthStatus.externalTransfer
                            ? "Enabled (Buyer-configured Gemini Vision)"
                            : "Disabled (Local OCR only — image bytes remain on buyer server)"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {processingError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                      {processingError}
                    </div>
                  )}

                  {/* Entry Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={busy || cameraPermission === "denied"}
                      onClick={handleBeginCameraFromEntry}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Start scan</span>
                    </button>

                    {(adminData?.config.allowGalleryImport ?? true) && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Choose photo</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Screens S1, S3, S4 — Live Guided Camera Viewfinder */}
              {(screen === "S1_FRONT_CAMERA" ||
                screen === "S3_COMPOSITION_CLOSEUP" ||
                screen === "S4_BACK_CAMERA") && (
                <div className="bg-slate-950 text-white">
                  {/* Dynamic Step Prompt Banner */}
                  <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs text-teal-400 font-medium">
                        {screen === "S1_FRONT_CAMERA"
                          ? "Stage A — Full Front View"
                          : screen === "S3_COMPOSITION_CLOSEUP"
                            ? "Stage B — Targeted Composition Close-up"
                            : "Stage C — Back or Side Label"}
                      </div>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {screen === "S1_FRONT_CAMERA"
                          ? "Show the full front of the pack."
                          : screen === "S3_COMPOSITION_CLOSEUP"
                            ? "Bring the printed composition details closer. Keep all lines inside the frame."
                            : "Turn the pack over and show the printed details."}
                      </p>
                    </div>
                    <span className="text-xs text-slate-300 font-mono whitespace-nowrap shrink-0">
                      {focusPoint ? "Focus locked" : "Camera ready"}
                    </span>
                  </div>

                  {/* Camera Viewfinder Canvas */}
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setFocusPoint({
                        x: Math.round(e.clientX - rect.left),
                        y: Math.round(e.clientY - rect.top),
                      });
                    }}
                    className="relative h-[380px] flex items-center justify-center overflow-hidden cursor-crosshair select-none"
                    style={{
                      background: torchOn
                        ? "radial-gradient(circle at center, #1e293b 0%, #090d16 100%)"
                        : "#090d16",
                    }}
                  >
                    {useLiveWebcam ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      /* Interactive Synthetic Medicine Pack Preview inside Viewfinder */
                      <div
                        className={`w-[82%] max-w-[480px] rounded-xl p-5 border border-slate-300 text-slate-900 shadow-lg transition-transform duration-150 ${
                          screen === "S1_FRONT_CAMERA" &&
                          selectedPreset.qualityPreset === "blur"
                            ? "blur-[2px]"
                            : ""
                        }`}
                        style={{
                          backgroundColor: selectedPreset.visualTheme.stripBg,
                        }}
                      >
                        <div
                          className="px-3 py-1.5 rounded-md text-white text-xs font-semibold mb-3 flex items-center justify-between"
                          style={{
                            backgroundColor:
                              selectedPreset.visualTheme.accentColor,
                          }}
                        >
                          <span>
                            {screen === "S1_FRONT_CAMERA"
                              ? "Rx MEDICINE PACK"
                              : screen === "S3_COMPOSITION_CLOSEUP"
                                ? "COMPOSITION MACRO REGION"
                                : "BACK LABEL DETAILS"}
                          </span>
                          <span className="font-mono">
                            {selectedPreset.barcode || "NO-GTIN"}
                          </span>
                        </div>

                        {screen === "S1_FRONT_CAMERA" && (
                          <div className="space-y-2">
                            <div className="text-lg font-bold text-slate-900">
                              {selectedPreset.visualTheme.brandTitle}
                            </div>
                            <div className="text-xs font-medium text-slate-600">
                              {selectedPreset.visualTheme.rxLine}
                            </div>
                            <div
                              className={`pt-2 border-t border-slate-200 font-mono text-slate-800 space-y-1 ${
                                selectedPreset.qualityPreset === "small_text"
                                  ? "text-[9px] leading-tight opacity-75"
                                  : "text-xs"
                              }`}
                            >
                              {selectedPreset.visualTheme.compLines.map(
                                (line, i) => (
                                  <div key={i}>{line}</div>
                                ),
                              )}
                            </div>
                            {!selectedPreset.requiresBackCapture && (
                              <div className="pt-2 text-[11px] text-slate-500">
                                {selectedPreset.visualTheme.mfgLine}
                              </div>
                            )}
                          </div>
                        )}

                        {screen === "S3_COMPOSITION_CLOSEUP" && (
                          <div className="space-y-2 py-2">
                            <div className="text-xs font-semibold text-teal-800">
                              Enlarged Composition Text Inside Frame:
                            </div>
                            <pre className="text-xs font-mono text-slate-900 whitespace-pre-wrap leading-relaxed bg-white/80 p-3 rounded border border-slate-200">
                              {selectedPreset.compositionCloseupText ||
                                selectedPreset.frontOcrText}
                            </pre>
                          </div>
                        )}

                        {screen === "S4_BACK_CAMERA" && (
                          <div className="space-y-2 py-2">
                            <div className="text-xs font-semibold text-slate-700">
                              Back / Side Manufacturer & Batch Details:
                            </div>
                            <div className="text-sm font-mono text-slate-900 bg-white/80 p-3 rounded border border-slate-200">
                              {selectedPreset.visualTheme.mfgLine}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Alignment Guide Overlay Frame */}
                    <div
                      className={`pointer-events-none border-2 border-teal-400/90 rounded-2xl transition-all ${
                        screen === "S3_COMPOSITION_CLOSEUP"
                          ? "w-[86%] h-[190px]"
                          : "w-[88%] h-[310px]"
                      }`}
                    />

                    {focusPoint && (
                      <div
                        style={{
                          left: focusPoint.x - 20,
                          top: focusPoint.y - 20,
                        }}
                        className="pointer-events-none absolute w-10 h-10 border-2 border-amber-400 rounded-md"
                      />
                    )}
                  </div>

                  {/* Camera Bottom Controls Row */}
                  <div className="px-5 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTorchOn((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          torchOn
                            ? "bg-amber-400 text-slate-950 font-semibold"
                            : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                        }`}
                      >
                        <Flashlight className="w-3.5 h-3.5" />
                        <span>{torchOn ? "Torch On" : "Torch"}</span>
                      </button>

                      {(adminData?.config.allowGalleryImport ?? true) && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Gallery</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleCapturePhoto(
                            screen === "S3_COMPOSITION_CLOSEUP"
                              ? "composition"
                              : screen === "S4_BACK_CAMERA"
                                ? "back"
                                : "front",
                          )
                        }
                        className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        {busy ? "Capturing..." : "Capture Photo"}
                      </button>

                      {selectedPreset.qualityPreset === "blur" &&
                        screen === "S1_FRONT_CAMERA" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleCapturePhoto("front", "clear")}
                            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-300 font-medium text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Capture Steady
                          </button>
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setUseLiveWebcam((v) => !v)}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      {useLiveWebcam ? "Use Synthetic Pack" : "Live Camera"}
                    </button>
                  </div>
                </div>
              )}

              {/* Screen S2 — Capture Review */}
              {screen === "S2_CAPTURE_REVIEW" &&
                latestCapture &&
                reviewBanner && (
                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-500">
                          <span>Screen S2 — Capture Review</span>
                          <span aria-hidden="true"> · </span>
                          <span>Step: {latestCapture.record.step}</span>
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                          {reviewBanner.headline}
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {reviewBanner.detail}
                        </p>
                      </div>

                      <div className="text-right font-mono tabular-nums text-xs text-slate-600">
                        <div>
                          {latestCapture.record.quality.width} ×{" "}
                          {latestCapture.record.quality.height}px
                        </div>
                        <div>
                          Edge score:{" "}
                          {latestCapture.record.quality.edge_detail_score}
                        </div>
                        <div>
                          Brightness:{" "}
                          {latestCapture.record.quality.brightness_mean}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center max-h-[300px]">
                      <img
                        src={latestCapture.previewUrl}
                        alt="Captured medicine packaging preview"
                        referrerPolicy="no-referrer"
                        className="max-h-[290px] w-auto object-contain"
                      />
                    </div>

                    {latestCapture.record.quality.issues.length > 0 && (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                        <span className="font-semibold">
                          Detected quality flags:{" "}
                        </span>
                        <span className="font-mono">
                          {latestCapture.record.quality.issues.join(", ")}
                        </span>
                        {latestCapture.record.quality.recommended_action && (
                          <span>
                            {" "}
                            · Recommended:{" "}
                            <strong className="font-mono">
                              {latestCapture.record.quality.recommended_action}
                            </strong>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleRetakeCapture}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retake (Replace Capture)</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {latestCapture.record.step === "front" &&
                          latestCapture.record.quality.status ===
                            "retry_required" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleCapturePhoto("front", "clear")
                              }
                              className="px-4 py-2.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
                            >
                              Retake Steady Photo
                            </button>
                          )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleAcceptCaptureAndAdvance}
                          className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Use photo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Screen S5 — Processing */}
              {screen === "S5_PROCESSING" && (
                <div className="p-8 space-y-6">
                  <div>
                    <div className="text-xs text-slate-500">
                      Screen S5 — Processing Captures
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      Analysing packaging & querying buyer catalogue
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {[
                      "1. Checking photo quality",
                      "2. Reading printed text",
                      "3. Identifying product",
                      "4. Searching buyer catalogue",
                      "5. Preparing results",
                    ].map((label, idx) => {
                      const done = processingStageIndex > idx;
                      const current = processingStageIndex === idx;
                      return (
                        <div
                          key={label}
                          className={`flex items-center justify-between px-4 py-3 rounded-lg border text-xs font-medium ${
                            done
                              ? "bg-teal-50/60 border-teal-200 text-teal-900"
                              : current
                                ? "bg-slate-900 border-slate-900 text-white"
                                : "bg-slate-50 border-slate-200 text-slate-400"
                          }`}
                        >
                          <span>{label}</span>
                          <span className="font-mono">
                            {done ? "Complete" : current ? "Running..." : "Queued"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {processingError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-3">
                      <div>{processingError}</div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            scanId &&
                            runFullRecognitionPipeline(
                              scanId,
                              1,
                              compositionPageSize,
                            )
                          }
                          className="px-3.5 py-1.5 bg-red-700 text-white font-semibold rounded-md"
                        >
                          Retry without losing captures
                        </button>
                        <button
                          type="button"
                          onClick={handleStartNewScan}
                          className="px-3.5 py-1.5 bg-white border border-red-300 text-red-800 font-medium rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleStartNewScan}
                      className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Cancel scan
                    </button>
                  </div>
                </div>
              )}

              {/* Screen S6 — Results */}
              {screen === "S6_RESULTS" && extraction && (
                <div className="p-6 space-y-6">
                  {/* Persistent Non-Clinical Notice */}
                  <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-lg text-xs text-amber-950 leading-relaxed">
                    <span className="font-bold">Notice: </span>
                    {compositionResult?.informational_notice ||
                      "Catalogue composition matches are informational. They do not determine whether a medicine is suitable for an individual. Ask a qualified pharmacist or prescriber before making any treatment change."}
                  </div>

                  {/* Extracted Printed Evidence Summary */}
                  <div className="space-y-2 pb-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        Extracted Printed Label Fields
                      </h3>
                      <span className="text-xs text-slate-500 font-mono">
                        Provenance: {extraction.ocr_provenance || "tesseract"} ·
                        Parse: {extraction.composition_parse_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-slate-500">
                          Printed Product Name
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {extraction.printed_product_name.value ||
                            "Not clearly visible"}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-slate-500">
                          Formulation / Route / Manufacturer
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {[
                            extraction.dosage_form_text.value,
                            extraction.release_type_text.value,
                            extraction.route_text.value,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Formulation not printed"}{" "}
                          ·{" "}
                          {extraction.manufacturer_text.value ||
                            "Manufacturer missing"}
                        </div>
                      </div>
                    </div>

                    {/* Structured Composition Components Table */}
                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-3 font-medium">
                              Printed Ingredient
                            </th>
                            <th className="py-2 px-3 font-medium">Role</th>
                            <th className="py-2 px-3 font-medium text-right">
                              Strength
                            </th>
                            <th className="py-2 px-3 font-medium">Basis</th>
                            <th className="py-2 pl-3 font-medium text-right">
                              Confidence
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                          {extraction.composition_components.map((comp, i) => (
                            <tr key={i}>
                              <td className="py-2 pr-3 font-sans font-medium text-slate-900">
                                {comp.ingredient_name}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {comp.ingredient_role}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-900">
                                {comp.strength_value} {comp.strength_unit}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {comp.strength_basis_unit
                                  ? `per ${comp.strength_basis_amount || "1"} ${comp.strength_basis_unit}`
                                  : "—"}
                              </td>
                              <td className="py-2 pl-3 text-right text-slate-600">
                                {comp.confidence !== null &&
                                comp.confidence !== undefined
                                  ? `${Math.round(comp.confidence * 100)}%`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section A: Exact Product Identity */}
                  <div className="space-y-3 pb-5 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        Section A — Exact Product Identity (Photographed Pack)
                      </h3>
                      <span className="text-xs font-mono text-slate-600">
                        {identityResult?.status || "not_resolved"}
                      </span>
                    </div>

                    {identityResult?.result?.product ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-bold text-slate-900">
                            {identityResult.result.product.display_name}
                          </div>
                          <span className="font-mono text-slate-500">
                            ID: {identityResult.result.product.product_id}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          {identityResult.result.evidence.explanation}
                        </div>
                        <div className="text-slate-500 pt-1">
                          <span>
                            Matched fields:{" "}
                            <strong className="font-mono text-slate-800">
                              {identityResult.result.evidence.matched_fields.join(
                                ", ",
                              ) || "none"}
                            </strong>
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            Missing fields:{" "}
                            <strong className="font-mono text-slate-800">
                              {identityResult.result.evidence.missing_fields.join(
                                ", ",
                              ) || "none"}
                            </strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                        {identityResult?.message ||
                          "Exact identity could not be established from the buyer's catalogue."}
                      </div>
                    )}
                  </div>

                  {/* Section B: Same Recorded Active Composition in Buyer's Catalogue */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Section B — Same Recorded Active Composition in
                          Buyer&apos;s Catalogue
                        </h3>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                          Status: {compositionResult?.status} · Verified on page{" "}
                          {compositionResult?.page}:{" "}
                          {compositionResult?.matches_in_page ?? 0} · Mapping:{" "}
                          {compositionResult?.mapping_version}
                        </div>
                      </div>

                      {/* Pagination Controls */}
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          disabled={busy || compositionPage <= 1}
                          onClick={() =>
                            handleChangeCompositionPage(compositionPage - 1)
                          }
                          className="px-2.5 py-1 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-100 font-medium"
                        >
                          Prev Page
                        </button>
                        <span className="font-mono tabular-nums text-slate-700">
                          Page {compositionPage}
                        </span>
                        <button
                          type="button"
                          disabled={busy || !compositionResult?.has_more}
                          onClick={() =>
                            handleChangeCompositionPage(compositionPage + 1)
                          }
                          className="px-2.5 py-1 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-100 font-medium"
                        >
                          Next Page
                        </button>
                      </div>
                    </div>

                    {compositionResult?.status === "unable_to_compare" && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2">
                        <div className="font-bold">
                          Composition could not be compared
                        </div>
                        <p>{compositionResult.message}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentStep("composition");
                            setScreen("S3_COMPOSITION_CLOSEUP");
                          }}
                          className="px-3.5 py-1.5 bg-amber-900 text-white rounded-md font-semibold"
                        >
                          Take Targeted Composition Close-up
                        </button>
                      </div>
                    )}

                    {compositionResult &&
                      compositionResult.matches.length > 0 && (
                        <div className="space-y-3">
                          {compositionResult.matches.map((candidate) => (
                            <div
                              key={candidate.product.product_id}
                              className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-bold text-sm text-slate-900">
                                  {candidate.product.display_name}
                                </div>
                                <div className="text-slate-500 font-mono">
                                  <span>
                                    Brand category (buyer metadata):{" "}
                                    <strong className="text-slate-900">
                                      {candidate.product.brand_category}
                                    </strong>
                                  </span>
                                  <span aria-hidden="true"> · </span>
                                  <span>ID: {candidate.product.product_id}</span>
                                </div>
                              </div>

                              <div className="font-medium text-teal-900">
                                Comparison: {candidate.comparison_label}
                              </div>

                              <div className="text-slate-600 font-mono">
                                Matched active components:{" "}
                                {candidate.matched_components.join(" + ")}
                              </div>

                              <div className="text-slate-600">
                                <span>
                                  Dosage form:{" "}
                                  <strong>
                                    {candidate.product.dosage_form_text ||
                                      "Missing"}
                                  </strong>
                                </span>
                                <span aria-hidden="true"> · </span>
                                <span>
                                  Release:{" "}
                                  <strong>
                                    {candidate.product.release_type_text ||
                                      "Missing"}
                                  </strong>
                                </span>
                                <span aria-hidden="true"> · </span>
                                <span>
                                  Route:{" "}
                                  <strong>
                                    {candidate.product.route_text || "Missing"}
                                  </strong>
                                </span>
                                <span aria-hidden="true"> · </span>
                                <span>
                                  Manufacturer:{" "}
                                  <strong>
                                    {candidate.product.manufacturer || "Missing"}
                                  </strong>
                                </span>
                              </div>

                              {candidate.different_fields.length > 0 && (
                                <div className="text-amber-900 font-medium">
                                  Formulation differences:{" "}
                                  <span className="font-mono">
                                    {candidate.different_fields.join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                    {compositionResult?.status === "no_matches" && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                        {compositionResult.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Synthetic Test Pack Presets & Guided Flow Inspector */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Representative Medicine Pack Test Scenarios
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Select any synthetic pack preset below to test single-photo
                    scans, small-text close-ups, 3-ingredient combinations,
                    syrup strength bases (per 5 mL), Hindi labels, or blurry
                    retakes.
                  </p>
                </div>

                <div className="space-y-2">
                  {SYNTHETIC_PACK_PRESETS.map((preset) => {
                    const isSelected = selectedPreset.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset);
                          if (screen === "S6_RESULTS") {
                            setScreen("S0_ENTRY");
                          }
                        }}
                        className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-teal-50/50 border-teal-700"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {preset.title}
                          </span>
                          <span className="text-[11px] font-mono text-teal-800 whitespace-nowrap shrink-0">
                            {preset.badge}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          {preset.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>Pagination Page Size (for testing Page 1 / Page 2)</span>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md font-mono">
                    {[2, 5, 50].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setCompositionPageSize(size)}
                        className={`px-2.5 py-1 rounded text-xs ${
                          compositionPageSize === size
                            ? "bg-white text-slate-900 font-semibold shadow-xs"
                            : "text-slate-600"
                        }`}
                      >
                        {size}/page
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active Session Traceability Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    Session & Capture Traceability
                  </span>
                  <span className="font-mono text-slate-500">
                    {scanId ? `scan_${scanId.slice(0, 8)}` : "No active session"}
                  </span>
                </div>

                {captures.length === 0 ? (
                  <p className="text-slate-500">
                    No captures stored yet. Retaking a photo invokes{" "}
                    <code className="font-mono">
                      DELETE /v1/scans/&#123;id&#125;/captures/&#123;cid&#125;
                    </code>{" "}
                    so rejected photos never accumulate.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {captures.map((c) => (
                      <div
                        key={c.record.capture_id}
                        className="flex items-center justify-between py-2 border-b border-slate-100 font-mono"
                      >
                        <span>
                          {c.record.step.toUpperCase()} ·{" "}
                          {c.record.capture_id.slice(0, 8)}
                        </span>
                        <span className="text-slate-600">
                          {c.record.quality.status} (
                          {c.record.quality.width}×{c.record.quality.height})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Interactive Composition Verifier & Extraction Sandbox */}
        {activeTab === "verifier" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  OCR / Vision Label Extraction & Signature Verifier
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Test how the deterministic parser handles multi-ingredient
                  lines, strength bases (per tablet, per 5 mL, % w/w, IU),
                  excipient stops, and generic Composition headings.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: "2-Component (g to mg)",
                    text: "Metacin Plus Tablet\nEach tablet contains: Caffeine 30 mg + Paracetamol 0.5 g\nExcipients: Starch 10 mg",
                  },
                  {
                    label: "Syrup (per 5 mL)",
                    text: "Mox 250 Suspension\nEach 5 ml contains: Amoxicillin IP 250 mg\nOral suspension",
                  },
                  {
                    label: "Ambiguous Generic Heading",
                    text: "Unknown Pack\nComposition: Paracetamol 500 mg",
                  },
                  {
                    label: "Hindi Devanagari",
                    text: "कालपोल 500 टैबलेट\nप्रत्येक टैबलेट में: पैरासिटामोल 500 mg\nनिर्माता: GSK",
                  },
                ].map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setCustomOcrText(sample.text)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={6}
                value={customOcrText}
                onChange={(e) => setCustomOcrText(e.target.value)}
                className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />

              <button
                type="button"
                disabled={busy}
                onClick={handleRunSandboxVerifier}
                className="w-full py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                {busy
                  ? "Running Extraction & Catalogue Verification..."
                  : "Parse Components & Verify Against Buyer Catalogue"}
              </button>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <h3 className="text-base font-bold text-slate-900">
                Structured Component Output & Catalogue Match Result
              </h3>

              {!sandboxExtraction ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  Click &ldquo;Parse Components &amp; Verify Against Buyer
                  Catalogue&rdquo; to inspect the structured component array and
                  SHA-256 active-composition signature.
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg font-mono space-y-1">
                    <div>
                      Parse Status:{" "}
                      <strong>
                        {sandboxExtraction.composition_parse_status}
                      </strong>
                    </div>
                    <div>
                      Signature Hash:{" "}
                      <span className="break-all">
                        {sandboxMatches?.composition_signature ||
                          "None (Unable to compare)"}
                      </span>
                    </div>
                    <div>
                      Match Status:{" "}
                      <strong>{sandboxMatches?.status || "—"}</strong> (
                      {sandboxMatches?.matches_in_page ?? 0} verified records)
                    </div>
                  </div>

                  {sandboxMatches?.message && (
                    <div className="p-3.5 bg-slate-100 rounded-lg text-slate-800">
                      {sandboxMatches.message}
                    </div>
                  )}

                  {sandboxMatches && sandboxMatches.matches.length > 0 && (
                    <div className="space-y-2">
                      {sandboxMatches.matches.map((m) => (
                        <div
                          key={m.product.product_id}
                          className="p-3.5 border border-slate-200 rounded-lg flex items-center justify-between gap-4"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {m.product.display_name}
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              {m.comparison_label}
                            </div>
                          </div>
                          <div className="text-right font-mono text-slate-500">
                            <div>Brand: {m.product.brand_category}</div>
                            <div>{m.product.product_id}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Buyer Catalogue Adapter Explorer */}
        {activeTab === "catalogue" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Authorised Buyer Catalogue (Read-Only Adapter View)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  The engine does not maintain a shared global medicine
                  database. It queries the buyer&apos;s own catalogue via
                  read-only endpoints and verifies every candidate locally.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={catalogueSearchQuery}
                  onChange={(e) => setCatalogueSearchQuery(e.target.value)}
                  placeholder="Filter buyer catalogue records..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-medium">Product ID</th>
                    <th className="py-2.5 px-3 font-medium">Display Name</th>
                    <th className="py-2.5 px-3 font-medium">Brand Metadata</th>
                    <th className="py-2.5 px-3 font-medium">
                      Structured Active Components
                    </th>
                    <th className="py-2.5 px-3 font-medium">
                      Dosage / Release / Route
                    </th>
                    <th className="py-2.5 pl-3 font-medium">Manufacturer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCatalogue.map((item) => (
                    <tr
                      key={item.product_id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 pr-3 font-mono text-slate-600 whitespace-nowrap">
                        {item.product_id}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {item.display_name}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {item.brand_category}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800">
                        {item.composition_components
                          .filter((c) => c.ingredient_role === "active")
                          .map(
                            (c) =>
                              `${c.ingredient_name} ${c.strength_value} ${c.strength_unit}${
                                c.strength_basis_unit
                                  ? ` / ${c.strength_basis_amount || "1"} ${c.strength_basis_unit}`
                                  : ""
                              }`,
                          )
                          .join(" + ")}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {[
                          item.dosage_form_text,
                          item.release_type_text,
                          item.route_text,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td className="py-3 pl-3 text-slate-600">
                        {item.manufacturer || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Buyer Operational Configuration Panel */}
        {activeTab === "admin" && adminData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Operational Configuration Panel (Buyer Self-Hosted Instance)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Configure OCR/Vision providers, canonical ingredient mappings,
                  gallery import policy, and temporary capture retention without
                  editing source code.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Buyer Catalogue Adapter Mode
                    </div>
                    <div className="text-slate-500">
                      Choose between the synthetic buyer REST catalogue or an
                      empty unconfigured adapter.
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(["synthetic", "none"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          handleUpdateAdminSetting({ catalogueMode: mode })
                        }
                        className={`px-3 py-1.5 rounded-md font-medium ${
                          adminData.config.catalogueMode === mode
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600"
                        }`}
                      >
                        {mode === "synthetic"
                          ? "Buyer REST Adapter"
                          : "Empty Adapter"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Buyer-Approved Canonical Ingredient Mapping
                    </div>
                    <div className="text-slate-500">
                      Enables versioned cross-script &amp; approved canonical
                      ingredient key mapping ({adminData.config.mappingVersion}
                      ).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateAdminSetting({
                        enableCanonicalIngredientMapping:
                          !adminData.config.enableCanonicalIngredientMapping,
                      })
                    }
                    className={`px-3.5 py-1.5 rounded-lg font-semibold ${
                      adminData.config.enableCanonicalIngredientMapping
                        ? "bg-teal-700 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {adminData.config.enableCanonicalIngredientMapping
                      ? "Enabled"
                      : "Strict Literal Only"}
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Scanner Gallery Import (Screen S0 &amp; S1)
                    </div>
                    <div className="text-slate-500">
                      Allow users to import an existing packaging photo from
                      their device gallery.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateAdminSetting({
                        allowGalleryImport:
                          !adminData.config.allowGalleryImport,
                      })
                    }
                    className={`px-3.5 py-1.5 rounded-lg font-semibold ${
                      adminData.config.allowGalleryImport
                        ? "bg-teal-700 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {adminData.config.allowGalleryImport
                      ? "Allowed"
                      : "Camera Only"}
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Vision Provider Mode
                    </div>
                    <div className="text-slate-500">
                      Server-side Gemini Vision ({adminData.config.geminiModel})
                      with automatic local OCR fallback.
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(["disabled", "gemini"] as const).map((vp) => (
                      <button
                        key={vp}
                        type="button"
                        onClick={() =>
                          handleUpdateAdminSetting({ visionProvider: vp })
                        }
                        className={`px-3 py-1.5 rounded-md font-medium ${
                          adminData.config.visionProvider === vp
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600"
                        }`}
                      >
                        {vp === "disabled" ? "Local OCR Only" : "Gemini Vision"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Recent Operational Audit Events
                  </h3>
                  <a
                    href="/v1/openapi.json"
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 font-semibold hover:underline"
                  >
                    OpenAPI 3.1 JSON
                  </a>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto font-mono">
                  {adminData.recentAuditEvents.length === 0 ? (
                    <div className="text-slate-500">No events recorded yet.</div>
                  ) : (
                    adminData.recentAuditEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-md"
                      >
                        <div className="text-slate-900 font-semibold">
                          {ev.event}
                        </div>
                        <div className="text-slate-600 mt-0.5">{ev.detail}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div>
          Medicine Photo Intelligence Engine · Self-Hosted B2B Package ·
          Non-Clinical Catalogue Verification Only
        </div>
        <div className="font-mono">
          API v1 (/v1/scans · /v1/catalogue/resolve ·
          /v1/catalogue/composition-matches)
        </div>
      </footer>
    </div>
  );
}
