/**
 * Typed client for the back-office API (apps/api `/companies/...`).
 * Uses the existing axios instance so the bearer token and refresh flow apply.
 */
import api from "@/lib/api";

export type CompanyRole = "OWNER" | "STAFF" | "DRIVER" | "REVIEWER" | "PARTNER" | "ADMIN";
export type DocumentStatus = "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED" | "UNREADABLE";

export interface CompanySummary {
  id: string;
  legalName: string;
  dba: string | null;
  usdot: string | null;
  language: "EN" | "SO" | "AM";
  timezone: string;
  isDemo: boolean;
}

export interface CompanyDetail extends CompanySummary {
  mcNumber: string | null;
  iftaBaseJurisdiction: string | null;
  inboundEmailSlug: string;
  createdAt: string;
  _count: { vehicles: number; drivers: number; documents: number };
}

export interface Issue {
  id?: string;
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
  status?: string;
}

export interface DocumentRow {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: DocumentStatus;
  channel: string;
  receivedAt: string;
  retentionUntil: string;
  isExactDuplicateOf: string | null;
  deletedAt: string | null;
  uploadedBy: { id: string; fullName: string } | null;
  issues: Issue[];
}

export interface Vehicle {
  id: string;
  unitNumber: string;
  vin: string | null;
  plate: string | null;
  axles: number | null;
  iftaQualified: boolean;
  tankCapacityGal: string | null;
  eldProvider: string | null;
  activeTo: string | null;
}

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  language: "EN" | "SO" | "AM";
  active: boolean;
  defaultVehicle: { id: string; unitNumber: string } | null;
}

export interface UploadResult {
  batchId: string;
  uploaded: Array<{ id: string; filename: string; sha256: string; status: DocumentStatus; isExactDuplicateOf: string | null }>;
  rejected: Array<{ filename: string; reason: "unsupported_type" | "content_mismatch" | "empty" }>;
}

export const backoffice = {
  async myCompanies() {
    const { data } = await api.get<{ companies: Array<{ company: CompanySummary; roles: CompanyRole[] }> }>("/companies");
    return data.companies;
  },
  async createCompany(input: { legalName: string; dba?: string; usdot?: string; mcNumber?: string; iftaBaseJurisdiction?: string; timezone?: string; language?: "EN" | "SO" }) {
    const { data } = await api.post<{ company: CompanySummary; role: CompanyRole }>("/companies", input);
    return data;
  },
  async company(id: string) {
    const { data } = await api.get<{ company: CompanyDetail; role: CompanyRole }>(`/companies/${id}`);
    return data;
  },
  async documents(companyId: string, params: { status?: DocumentStatus; cursor?: string; limit?: number } = {}) {
    const { data } = await api.get<{ documents: DocumentRow[]; nextCursor: string | null }>(`/companies/${companyId}/documents`, { params });
    return data;
  },
  async document(companyId: string, id: string) {
    const { data } = await api.get<{ document: DocumentRow; signedUrl: string | null; signedUrlExpiresInSeconds: number }>(`/companies/${companyId}/documents/${id}`);
    return data;
  },
  async upload(companyId: string, files: File[], onProgress?: (percent: number) => void) {
    const form = new FormData();
    for (const f of files) form.append("files", f, f.name);
    const { data } = await api.post<UploadResult>(`/companies/${companyId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data;
  },
  async vehicles(companyId: string) {
    const { data } = await api.get<{ vehicles: Vehicle[] }>(`/companies/${companyId}/vehicles`);
    return data.vehicles;
  },
  async addVehicle(companyId: string, input: Partial<Vehicle> & { unitNumber: string }) {
    const { data } = await api.post<{ vehicle: Vehicle }>(`/companies/${companyId}/vehicles`, input);
    return data.vehicle;
  },
  async drivers(companyId: string) {
    const { data } = await api.get<{ drivers: Driver[] }>(`/companies/${companyId}/drivers`);
    return data.drivers;
  },
  async addDriver(companyId: string, input: { name: string; phone?: string; defaultVehicleId?: string; language?: "EN" | "SO" }) {
    const { data } = await api.post<{ driver: Driver }>(`/companies/${companyId}/drivers`, input);
    return data.driver;
  },
};

export function shortHash(sha256: string): string {
  return `${sha256.slice(0, 8)}…${sha256.slice(-4)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
