/** Typed calls the capture app needs. Same API as the web. */
import api from "./api";

export type CompanyRole = "OWNER" | "STAFF" | "DRIVER" | "REVIEWER" | "PARTNER" | "ADMIN";
export type DocumentStatus = "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED" | "UNREADABLE";
export type TxStatus = "VERIFIED" | "NEEDS_ATTENTION" | "UNABLE_TO_VERIFY";

export interface CompanySummary {
  id: string;
  legalName: string;
  dba: string | null;
  isDemo: boolean;
}

export interface Vehicle {
  id: string;
  unitNumber: string;
  plate: string | null;
  activeTo: string | null;
}

export interface DocumentRow {
  id: string;
  filename: string;
  mimeType: string;
  status: DocumentStatus;
  receivedAt: string;
  sha256: string;
  isExactDuplicateOf: string | null;
  issues: Array<{ code: string; severity: "ERROR" | "WARNING" | "INFO"; message: string }>;
  regions?: Array<{ id: string; page: number; transaction: { id: string; status: TxStatus; vendor: string | null; receiptTotal: string | null } | null }>;
}

export interface TransactionRow {
  id: string;
  vendor: string | null;
  date: string | null;
  state: string | null;
  receiptTotal: string | null;
  status: TxStatus;
  vehicle: { id: string; unitNumber: string } | null;
  document: { id: string; filename: string } | null;
  openIssueCount?: number;
}

export interface IssueRow {
  id: string;
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
  transaction: { id: string; vendor: string | null; date: string | null; receiptTotal: string | null } | null;
  document: { id: string; filename: string } | null;
}

const c = (id: string) => `/companies/${id}`;

export const backoffice = {
  async myCompanies() {
    const { data } = await api.get<{ companies: Array<{ company: CompanySummary; roles: CompanyRole[] }> }>("/companies");
    return data.companies;
  },
  async vehicles(companyId: string) {
    const { data } = await api.get<{ vehicles: Vehicle[] }>(`${c(companyId)}/vehicles`);
    return data.vehicles.filter((v) => !v.activeTo);
  },
  async documents(companyId: string, limit = 50) {
    const { data } = await api.get<{ documents: DocumentRow[]; nextCursor: string | null }>(`${c(companyId)}/documents`, { params: { limit } });
    return data.documents;
  },
  async document(companyId: string, id: string) {
    const { data } = await api.get<{ document: DocumentRow; signedUrl: string | null }>(`${c(companyId)}/documents/${id}`);
    return data;
  },
  /** Issues asking "which truck?" (S001) on receipts this user can answer. */
  async whichTruckIssues(companyId: string) {
    const { data } = await api.get<{ issues: IssueRow[] }>(`${c(companyId)}/issues`, { params: { status: "OPEN", limit: 100 } });
    return data.issues.filter((i) => i.code === "S001" && i.transaction);
  },
  async setTruck(companyId: string, transactionId: string, vehicleId: string) {
    const { data } = await api.patch<{ transaction: TransactionRow }>(`${c(companyId)}/transactions/${transactionId}/fields`, { field: "vehicleId", newValue: vehicleId, reason: "Driver chose the truck in the app" });
    return data.transaction;
  },
  async resolveIssue(companyId: string, issueId: string, note: string) {
    await api.post(`${c(companyId)}/issues/${issueId}/resolve`, { note });
  },
};

export function formatMoney(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  return Number.isNaN(n) ? value : `$${n.toFixed(2)}`;
}
