/**
 * Typed client for the back-office API (apps/api `/companies/...`).
 * Uses the shared axios instance so the bearer token and refresh flow apply.
 */
import api from "@/lib/api";

export type CompanyRole = "OWNER" | "STAFF" | "DRIVER" | "REVIEWER" | "PARTNER" | "ADMIN";
export type DocumentStatus = "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED" | "UNREADABLE";
export type TxStatus = "VERIFIED" | "NEEDS_ATTENTION" | "UNABLE_TO_VERIFY";
export type Severity = "ERROR" | "WARNING" | "INFO";
export type IssueStatus = "OPEN" | "RESOLVED" | "ACCEPTED";
export type ReportType = "TRANSACTIONS_CSV" | "IFTA_WORKSHEET";
export type ReportStatus = "PRELIMINARY" | "REVIEWED";

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
  id: string;
  code: string;
  severity: Severity;
  message: string;
  status: IssueStatus;
  fields?: string[];
  evidence?: unknown;
  createdAt?: string;
  resolutionNote?: string | null;
  transaction?: { id: string; vendor: string | null; date: string | null; receiptTotal: string | null } | null;
  document?: { id: string; filename: string } | null;
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
  issues: Pick<Issue, "code" | "severity" | "message">[];
  regions?: DocumentRegion[];
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

export interface Period {
  id: string;
  type: "MONTH" | "QUARTER" | "YEAR";
  startDate: string;
  endDate: string;
  status: "OPEN" | "IN_REVIEW" | "APPROVED" | "LOCKED";
}

export interface TransactionLine {
  id: string;
  descriptionRaw: string;
  category: "MOTOR_FUEL" | "REEFER_FUEL" | "DEF" | "NON_FUEL" | "TAX" | "FEE" | "DISCOUNT" | "CREDIT";
  fuelType: string | null;
  quantity: string | null;
  unit: string | null;
  unitPrice: string | null;
  amount: string | null;
}

export interface TransactionRow {
  id: string;
  type: string;
  date: string | null;
  time: string | null;
  vendor: string | null;
  sellerAddress: string | null;
  state: string | null;
  stateSource: string | null;
  unitNumberRaw: string | null;
  receiptTotal: string | null;
  currency: string | null;
  status: TxStatus;
  corroboration: string;
  paymentMethod: string | null;
  cardLast4: string | null;
  vehicle: { id: string; unitNumber: string } | null;
  lines: TransactionLine[];
  openIssueCount?: number;
  document: { id: string; filename: string } | null;
  issues?: Issue[];
  provenance?: {
    fields?: Record<string, FieldProvenance>;
    disagreements?: Array<{ field: string; passA: string | null; passB: string | null; material: boolean }>;
    passA?: { model: string; promptVersion: string } | null;
    passB?: { model: string; promptVersion: string } | null;
  };
  fieldEdits?: Array<{ id: string; field: string; oldValue: string | null; newValue: string | null; reason: string; createdAt: string; userId?: string; user?: { id: string; fullName: string } }>;
}

export interface FieldProvenance {
  rawText: string | null;
  passA: string | null;
  passB: string | null;
  final: string | null;
  finalSource: "pass_a" | "pass_b" | "both" | "human" | "card" | "lookup" | null;
  agree: boolean;
}

export interface ExtractionRun {
  pass: "A" | "B";
  modelId: string;
  promptVersion: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  costUsd: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
}

export interface DocumentRegion {
  id: string;
  page: number;
  runs: ExtractionRun[];
  transaction: { id: string; status: TxStatus; vendor: string | null; receiptTotal: string | null } | null;
}

export interface PeriodSummary {
  period: Period;
  documents: { total: number; byStatus: Record<string, number> };
  transactions: { total: number; byStatus: Record<string, number>; verifiedPercent: string };
  openIssues: Record<Severity, number>;
  fuelByState: Array<{ state: string; motorFuelGallons: string; motorFuelAmount: string; reeferGallons: string; defGallons: string }>;
  unassigned: number;
}

export interface MileageRecord {
  id: string;
  jurisdiction: string;
  totalMiles: string;
  taxableMiles: string;
  vehicle: { id: string; unitNumber: string };
}

export interface WorksheetRow {
  jurisdiction: string;
  totalMiles: string;
  taxableMiles: string;
  gallonsConsumed: string | null;
  taxPaidGallons: string;
  netTaxableGallons: string | null;
  rate: string | null;
  surcharge: string | null;
  taxDue: string | null;
}

export interface Worksheet {
  status: ReportStatus;
  openErrorIssues: number;
  unassignedTransactions: number;
  worksheet: {
    totals: { totalMiles: string; totalTaxableMiles: string; totalTaxableGallons: string; totalGallonsConsumed: string | null; totalTaxDue: string | null };
    fleetMpg: string | null;
    mpgDecimals: number;
    rows: WorksheetRow[];
    roundingNotes: string[];
    ratesMissing: boolean;
    missingRateJurisdictions: string[];
  };
  rateSource: { quarter: string; fuelType: string; sourceUrl: string; importedAt: string; jurisdictions: number } | null;
  disclaimer: string;
}

export interface Report {
  id: string;
  type: ReportType;
  status: ReportStatus;
  snapshotHash: string;
  periodId: string;
  createdAt: string;
  generatedBy: string;
}

export type FuelCardProvider = "comdata" | "wex_efs" | "atob" | "tcs" | "generic";
export const FUEL_CARD_PROVIDERS: FuelCardProvider[] = ["comdata", "wex_efs", "atob", "tcs", "generic"];
export type FuelCardField = "date" | "location" | "state" | "unitNumber" | "cardLast4" | "fuelType" | "gallons" | "amount";
export const FUEL_CARD_FIELDS: FuelCardField[] = ["date", "location", "state", "unitNumber", "cardLast4", "fuelType", "gallons", "amount"];
export type FuelCardMapping = Partial<Record<FuelCardField, string>>;

export interface FuelCardPreview {
  headers: string[];
  sampleRows: string[][];
  detectedMapping: FuelCardMapping;
  missing: FuelCardField[];
  savedMapping: FuelCardMapping | null;
}

export interface FuelCardImport {
  id: string;
  provider: FuelCardProvider;
  mappingVersion: string;
  importedAt: string;
  rows: number;
  matched?: number;
  duplicates?: number;
}

export type MileageProvider = "motive" | "samsara" | "geotab" | "omnitracs" | "generic";
export const MILEAGE_PROVIDERS: MileageProvider[] = ["motive", "samsara", "geotab", "omnitracs", "generic"];
export type MileageField = "unit" | "jurisdiction" | "totalMiles" | "taxableMiles" | "periodStart" | "periodEnd";
export const MILEAGE_FIELDS: MileageField[] = ["unit", "jurisdiction", "totalMiles", "taxableMiles", "periodStart", "periodEnd"];
export type MileageLayout = "long" | "wide";
export type DistanceUnit = "mi" | "km";
export type MileageMapping = Partial<Record<MileageField, string>>;

export interface MileagePreview {
  headers: string[];
  sampleRows: string[][];
  layout: MileageLayout;
  detectedMapping: MileageMapping;
  mapping: MileageMapping;
  missing: MileageField[];
  savedMapping: { layout: MileageLayout; distanceUnit: DistanceUnit; mapping: MileageMapping } | null;
  distanceUnit: DistanceUnit;
  jurisdictionColumns: string[];
  parse: {
    records: Array<{ unit: string; jurisdiction: string; totalMiles: string; taxableMiles: string; sourceRows: number[] }>;
    errors: Array<{ row: number; field: string; message: string }>;
    skipped: number;
    unknownUnits: string[];
    unitsSeen: string[];
  };
}

export interface MileageImportRow {
  id: string;
  provider: MileageProvider | string;
  filename: string | null;
  layout: MileageLayout | null;
  distanceUnit: DistanceUnit | null;
  mappingVersion: string | null;
  importedAt: string;
  rows: number;
  activeRows: number;
  rowsSkipped: number;
}

export interface MileageRulesSummary {
  transactionsChecked: number;
  fleetMpg: string | null;
  opened: { M001: number; M002: number; M003: number };
  resolved: number;
}

export interface MileageImportResult {
  mileageImport: { id: string; provider: string; layout: MileageLayout; distanceUnit: DistanceUnit; mappingVersion: string; importedAt: string; rows: number; skipped: number };
  superseded: { records: number; imports: number };
  rules: MileageRulesSummary;
}

export interface MileageView {
  records: MileageRecord[];
  byVehicle: Array<{ vehicleId: string; unitNumber: string; jurisdictions: string[]; totalMiles: string; taxableMiles: string }>;
  byJurisdiction: Array<{ jurisdiction: string; totalMiles: string; taxableMiles: string }>;
  totals: { totalMiles: string; taxableMiles: string };
}

export interface MileageChoices {
  provider: MileageProvider;
  layout?: MileageLayout;
  distanceUnit?: DistanceUnit;
  mapping?: MileageMapping;
}

export interface MatchSummary {
  receiptsConsidered: number;
  cardRowsConsidered: number;
  matched: number;
  newMatches: number;
  unmatchedReceipts: number;
  unmatchedCardRows: number;
}

export interface Member {
  id: string;
  role: CompanyRole;
  createdAt: string;
  user: { id: string; fullName: string; email: string | null };
}

export interface UploadResult {
  batchId: string;
  uploaded: Array<{ id: string; filename: string; sha256: string; status: DocumentStatus; isExactDuplicateOf: string | null }>;
  rejected: Array<{ filename: string; reason: "unsupported_type" | "content_mismatch" | "empty" }>;
}

export interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
}

const c = (companyId: string) => `/companies/${companyId}`;

function mileageForm(file: File, choices: MileageChoices): FormData {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("provider", choices.provider);
  if (choices.layout) form.append("layout", choices.layout);
  if (choices.distanceUnit) form.append("distanceUnit", choices.distanceUnit);
  if (choices.mapping) form.append("mapping", JSON.stringify(choices.mapping));
  return form;
}

export const backoffice = {
  // ── Companies ──
  async myCompanies() {
    const { data } = await api.get<{ companies: Array<{ company: CompanySummary; roles: CompanyRole[] }> }>("/companies");
    return data.companies;
  },
  async createCompany(input: { legalName: string; dba?: string; usdot?: string; mcNumber?: string; iftaBaseJurisdiction?: string; timezone?: string; language?: "EN" | "SO" }) {
    const { data } = await api.post<{ company: CompanySummary; role: CompanyRole }>("/companies", input);
    return data;
  },
  async company(id: string) {
    const { data } = await api.get<{ company: CompanyDetail; role: CompanyRole }>(c(id));
    return data;
  },
  async periods(companyId: string) {
    const { data } = await api.get<{ periods: Period[] }>(`${c(companyId)}/periods`);
    return data.periods;
  },
  async audit(companyId: string, limit = 50) {
    const { data } = await api.get<{ entries: AuditEntry[] }>(`${c(companyId)}/audit`, { params: { limit } });
    return data.entries;
  },

  // ── Documents ──
  async documents(companyId: string, params: { status?: DocumentStatus; cursor?: string; limit?: number } = {}) {
    const { data } = await api.get<{ documents: DocumentRow[]; nextCursor: string | null }>(`${c(companyId)}/documents`, { params });
    return data;
  },
  async document(companyId: string, id: string) {
    const { data } = await api.get<{ document: DocumentRow; signedUrl: string | null; signedUrlExpiresInSeconds: number }>(`${c(companyId)}/documents/${id}`);
    return data;
  },
  async upload(companyId: string, files: File[], onProgress?: (percent: number) => void) {
    const form = new FormData();
    for (const f of files) form.append("files", f, f.name);
    const { data } = await api.post<UploadResult>(`${c(companyId)}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data;
  },
  async requestDeletion(companyId: string, documentId: string, reason: string) {
    const { data } = await api.post<{ message: string }>(`${c(companyId)}/documents/${documentId}/deletion-requests`, { reason });
    return data;
  },

  // ── Fleet ──
  async vehicles(companyId: string) {
    const { data } = await api.get<{ vehicles: Vehicle[] }>(`${c(companyId)}/vehicles`);
    return data.vehicles;
  },
  async addVehicle(companyId: string, input: Record<string, unknown>) {
    const { data } = await api.post<{ vehicle: Vehicle }>(`${c(companyId)}/vehicles`, input);
    return data.vehicle;
  },
  async updateVehicle(companyId: string, id: string, input: Record<string, unknown>) {
    const { data } = await api.patch<{ vehicle: Vehicle }>(`${c(companyId)}/vehicles/${id}`, input);
    return data.vehicle;
  },
  async drivers(companyId: string) {
    const { data } = await api.get<{ drivers: Driver[] }>(`${c(companyId)}/drivers`);
    return data.drivers;
  },
  async addDriver(companyId: string, input: { name: string; phone?: string; defaultVehicleId?: string; language?: "EN" | "SO" }) {
    const { data } = await api.post<{ driver: Driver }>(`${c(companyId)}/drivers`, input);
    return data.driver;
  },
  async updateDriver(companyId: string, id: string, input: Record<string, unknown>) {
    const { data } = await api.patch<{ driver: Driver }>(`${c(companyId)}/drivers/${id}`, input);
    return data.driver;
  },

  // ── Transactions & review ──
  async transactions(companyId: string, params: { status?: TxStatus; periodId?: string; cursor?: string; limit?: number } = {}) {
    const { data } = await api.get<{ transactions: TransactionRow[]; nextCursor: string | null }>(`${c(companyId)}/transactions`, { params });
    return data;
  },
  async transaction(companyId: string, id: string) {
    const { data } = await api.get<{ transaction: TransactionRow }>(`${c(companyId)}/transactions/${id}`);
    return data.transaction;
  },
  async editField(companyId: string, id: string, input: { field: string; newValue: string | null; reason: string }) {
    const { data } = await api.patch<{ transaction: TransactionRow }>(`${c(companyId)}/transactions/${id}/fields`, input);
    return data.transaction;
  },
  async issues(companyId: string, params: { status?: IssueStatus; severity?: Severity; cursor?: string; limit?: number } = {}) {
    const { data } = await api.get<{ issues: Issue[]; nextCursor: string | null }>(`${c(companyId)}/issues`, { params });
    return data;
  },
  async resolveIssue(companyId: string, id: string, note: string, accept = false) {
    const { data } = await api.post<{ issue: Issue }>(`${c(companyId)}/issues/${id}/${accept ? "accept" : "resolve"}`, { note });
    return data.issue;
  },

  // ── Fuel & IFTA ──
  async periodSummary(companyId: string, periodId: string) {
    const { data } = await api.get<PeriodSummary>(`${c(companyId)}/periods/${periodId}/summary`);
    return data;
  },
  async mileage(companyId: string, periodId: string) {
    const { data } = await api.get<MileageView>(`${c(companyId)}/periods/${periodId}/mileage`);
    return data;
  },
  async mileagePreview(companyId: string, periodId: string, file: File, choices: MileageChoices) {
    const { data } = await api.post<MileagePreview>(`${c(companyId)}/periods/${periodId}/mileage-imports/preview`, mileageForm(file, choices), { headers: { "Content-Type": "multipart/form-data" } });
    return data;
  },
  async importMileage(companyId: string, periodId: string, file: File, choices: MileageChoices, saveMapping: boolean) {
    const form = mileageForm(file, choices);
    form.append("saveMapping", saveMapping ? "true" : "false");
    const { data } = await api.post<MileageImportResult>(`${c(companyId)}/periods/${periodId}/mileage-imports`, form, { headers: { "Content-Type": "multipart/form-data" } });
    return data;
  },
  async mileageImports(companyId: string, periodId: string) {
    const { data } = await api.get<{ imports: MileageImportRow[] }>(`${c(companyId)}/periods/${periodId}/mileage-imports`);
    return data.imports;
  },
  async worksheet(companyId: string, periodId: string) {
    const { data } = await api.get<Worksheet>(`${c(companyId)}/periods/${periodId}/ifta-worksheet`);
    return data;
  },

  // ── Reports ──
  async reports(companyId: string) {
    const { data } = await api.get<{ reports: Report[] }>(`${c(companyId)}/reports`);
    return data.reports;
  },
  async generateReport(companyId: string, input: { type: ReportType; periodId: string }) {
    const { data } = await api.post<{ report: Report }>(`${c(companyId)}/reports`, input);
    return data.report;
  },
  async report(companyId: string, id: string) {
    const { data } = await api.get<{ report: Report; signedUrl: string }>(`${c(companyId)}/reports/${id}`);
    return data;
  },

  // ── Fuel cards ──
  async fuelCardPreview(companyId: string, file: File, provider: FuelCardProvider) {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("provider", provider);
    const { data } = await api.post<FuelCardPreview>(`${c(companyId)}/fuel-card-imports/preview`, form, { headers: { "Content-Type": "multipart/form-data" } });
    return data;
  },
  async fuelCardImport(companyId: string, file: File, provider: FuelCardProvider, mapping: FuelCardMapping, saveMapping: boolean) {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("provider", provider);
    form.append("mapping", JSON.stringify(mapping));
    form.append("saveMapping", saveMapping ? "true" : "false");
    const { data } = await api.post<{ fuelCardImport: FuelCardImport; matching: MatchSummary }>(`${c(companyId)}/fuel-card-imports`, form, { headers: { "Content-Type": "multipart/form-data" } });
    return data;
  },
  async fuelCardImports(companyId: string) {
    const { data } = await api.get<{ imports: FuelCardImport[] }>(`${c(companyId)}/fuel-card-imports`);
    return data.imports;
  },
  async runMatching(companyId: string, periodId: string) {
    const { data } = await api.post<MatchSummary>(`${c(companyId)}/periods/${periodId}/match`);
    return data;
  },

  // ── Members ──
  async members(companyId: string) {
    const { data } = await api.get<{ members: Member[] }>(`${c(companyId)}/members`);
    return data.members;
  },
  async addMember(companyId: string, input: { email: string; role: CompanyRole }) {
    const { data } = await api.post<{ member: Member }>(`${c(companyId)}/members`, input);
    return data.member;
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

/** Money as "$1,234.56"; values arrive as decimal strings from the API. */
export function formatMoney(value: string | number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export function formatNumber(value: string | number | null | undefined, places = 3): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: places, maximumFractionDigits: places }).format(n);
}

export function formatDate(value: string | null | undefined, locale = "en-US"): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: value.length === 10 ? "UTC" : undefined });
}

export function formatDateTime(value: string | null | undefined, locale = "en-US"): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function periodLabel(p: Pick<Period, "type" | "startDate">): string {
  const d = new Date(p.startDate);
  if (p.type === "QUARTER") return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  if (p.type === "MONTH") return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return String(d.getUTCFullYear());
}
