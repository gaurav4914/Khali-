import type {
  CaptureResponse,
  CaptureStep,
  CatalogueProduct,
  CatalogueResolveResponse,
  CompositionMatchResponse,
  CreateScanResponse,
  ScanExtraction,
} from "./types";

export interface MedicineEngineClientOptions {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  fetcher?: typeof fetch;
}

export class MedicineEngineError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "MedicineEngineError";
  }
}

export class MedicineEngineClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly accessToken?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: MedicineEngineClientOptions) {
    if (!options.baseUrl) throw new Error("Medicine Engine baseUrl is required.");
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.fetcher = options.fetcher ?? fetch;
  }

  private headers(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.apiKey) {
      out["X-API-Key"] = this.apiKey;
    }
    if (this.accessToken) {
      out["Authorization"] = `Bearer ${this.accessToken}`;
    }
    return out;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (response.status === 204) {
      return undefined as T;
    }

    if (!response.ok) {
      let message = `Medicine Engine request failed (${response.status}).`;
      let code: string | undefined;
      try {
        const payload = await response.json();
        const detail = payload?.detail ?? payload;
        message = detail?.message ?? message;
        code = detail?.code;
      } catch {
        // Keep the stable fallback message if the server did not return JSON.
      }
      throw new MedicineEngineError(message, response.status, code);
    }
    return (await response.json()) as T;
  }

  createScanSession(): Promise<CreateScanResponse> {
    return this.request("/v1/scans", { method: "POST" });
  }

  async uploadMedicineImage(
    scanId: string,
    step: CaptureStep,
    imageUriOrBlob: string | Blob,
    contentType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
    hintKey?: string,
  ): Promise<CaptureResponse> {
    const extension =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "jpg";
    const form = new FormData();
    form.append("step", step);
    if (hintKey) {
      form.append("pack_preset", hintKey);
    }
    if (typeof imageUriOrBlob === "string") {
      form.append(
        "image",
        {
          uri: imageUriOrBlob,
          name: `${step}.${extension}`,
          type: contentType,
        } as unknown as Blob,
      );
    } else {
      form.append("image", imageUriOrBlob, `${step}.${extension}`);
    }

    return this.request(`/v1/scans/${encodeURIComponent(scanId)}/captures`, {
      method: "POST",
      body: form,
    });
  }

  checkImageQuality(
    scanId: string,
    captureId: string,
  ): Promise<CaptureResponse["quality"]> {
    return this.request(
      `/v1/scans/${encodeURIComponent(scanId)}/quality-check?capture_id=${encodeURIComponent(captureId)}`,
      { method: "POST" },
    );
  }

  recogniseMedicine(scanId: string): Promise<ScanExtraction> {
    return this.request(`/v1/scans/${encodeURIComponent(scanId)}/recognise`, {
      method: "POST",
    });
  }

  resolveProductIdentity(
    scanId: string,
    barcode?: string,
  ): Promise<CatalogueResolveResponse> {
    return this.request("/v1/catalogue/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_id: scanId, barcode }),
    });
  }

  findCompositionMatches(
    scanId: string,
    page = 1,
    pageSize = 50,
  ): Promise<CompositionMatchResponse> {
    return this.request("/v1/catalogue/composition-matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_id: scanId, page, page_size: pageSize }),
    });
  }

  getCatalogueProduct(productId: string): Promise<CatalogueProduct> {
    return this.request(
      `/v1/catalogue/products/${encodeURIComponent(productId)}`,
    );
  }

  removeCapture(scanId: string, captureId: string): Promise<void> {
    return this.request(
      `/v1/scans/${encodeURIComponent(scanId)}/captures/${encodeURIComponent(captureId)}`,
      { method: "DELETE" },
    );
  }

  getScanResult(scanId: string): Promise<unknown> {
    return this.request(`/v1/scans/${encodeURIComponent(scanId)}`);
  }
}
