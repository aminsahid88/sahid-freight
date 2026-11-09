"use client";
/**
 * Control room (platform admins only). Five tabs: platform overview, every
 * company (with a logged break-glass entry), the job queue with retry, the
 * audit log across companies, and the official IFTA rate tables.
 * Nothing here reads a company's documents; entering a company goes through
 * the normal screens with the reason on every request (lib/company.ts).
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, FileText, RefreshCw, ScrollText, ShieldAlert } from "lucide-react";
import { type AdminAuditEntry, type AdminCompany, type AdminJob, type AdminOverview, backoffice, type CompanySummary, formatDate, formatDateTime, type JobStatus } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useAuthStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { RateTableCard } from "@/components/office/RateTableCard";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";

type Tab = "overview" | "companies" | "jobs" | "audit" | "rates";
const TABS: Tab[] = ["overview", "companies", "jobs", "audit", "rates"];
const JOB_TONES: Record<JobStatus, PillTone> = { QUEUED: "blue", RUNNING: "amber", DONE: "green", FAILED: "red" };
const AUDIT_ACTIONS = ["login", "login_failed", "logout", "upload", "view_document", "edit", "approve", "export", "delete_request", "break_glass", "company_created", "member_added", "member_removed", "review_claim", "review_release", "approval_requested", "approval_decided", "reprocess"];

const companyName = (c: { legalName: string; dba: string | null } | null | undefined, fallback: string) => (c ? c.dba || c.legalName : fallback);

export default function AdminPage() {
  const { t } = useT();
  const { user } = useAuthStore();
  // The office layout renders pages client-side only, so reading the URL here cannot mismatch server HTML.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "overview";
    const wanted = new URLSearchParams(window.location.search).get("tab");
    return wanted && (TABS as string[]).includes(wanted) ? (wanted as Tab) : "overview";
  });

  if (user && user.role !== "ADMIN") {
    return (
      <div>
        <PageHeader title={t("admin.title")} />
        <EmptyState icon={<ShieldAlert size={20} />} title={t("admin.adminsOnly")} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow={t("nav.groupPlatform")} title={t("admin.title")} description={t("admin.subtitle")} />
      <div className="mb-5">
        <Tabs
          ariaLabel={t("admin.title")}
          value={tab}
          onChange={(v) => {
            setTab(v);
            window.history.replaceState(null, "", `/office/admin?tab=${v}`);
          }}
          options={TABS.map((v) => ({ value: v, label: t(`admin.tab${v[0]!.toUpperCase()}${v.slice(1)}`) }))}
        />
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "companies" && <CompaniesTab />}
      {tab === "jobs" && <JobsTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "rates" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RateTableCard />
          <Card>
            <CardHeader title={t("admin.tabRates")} description={t("admin.ratesHint")} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    backoffice.adminOverview().then(setData).catch((e) => setError(formatApiError(e, t("common.error"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <Banner tone="danger">{error}</Banner>;
  if (!data) return <SkeletonRows rows={4} height="h-24" />;
  const spend = Number(data.spend.monthUsd);
  const budget = Number(data.spend.budgetUsd);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Building2 size={14} />} label={t("admin.companies")} value={data.companies} detail={t("admin.usersDetail", { count: data.users })} />
        <Stat icon={<FileText size={14} />} label={t("admin.documents")} value={data.documents.total} detail={`${data.documents.byStatus.PROCESSED} ${t("docStatus.PROCESSED").toLowerCase()} · ${data.documents.byStatus.FAILED} ${t("docStatus.FAILED").toLowerCase()} · ${data.documents.byStatus.UNREADABLE} ${t("docStatus.UNREADABLE").toLowerCase()}`} />
        <Stat icon={<AlertTriangle size={14} />} label={t("admin.openErrors")} value={data.openErrorIssues} tone={data.openErrorIssues ? "warning" : "default"} detail={`${data.transactions.byStatus.VERIFIED} / ${data.transactions.total} ${t("txStatus.VERIFIED").toLowerCase()}`} />
        <Stat icon={<RefreshCw size={14} />} label={t("admin.failedJobs")} value={data.jobs.FAILED} tone={data.jobs.FAILED ? "danger" : "default"} detail={`${data.jobs.QUEUED} ${t("admin.queued").toLowerCase()} · ${data.jobs.RUNNING} ${t("admin.running").toLowerCase()} · ${data.jobs.DONE} ${t("admin.done").toLowerCase()}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("admin.spend")} description={t("admin.spendDetail")} />
          <CardBody>
            <div className="flex items-baseline gap-2">
              <span className="text-[30px] font-semibold leading-none tnum display text-ink">${spend.toFixed(2)}</span>
              <span className="text-[13px] text-ink-2">{t("admin.spendOf", { budget: `$${budget.toFixed(2)}` })}</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface2">
              <div className={`h-full rounded-full ${spend >= budget ? "bg-danger" : spend >= budget * 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${budget > 0 ? Math.min(100, (spend / budget) * 100) : 0}%` }} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("admin.recentBreakGlass")} />
          <CardBody>
            {data.breakGlass.length === 0 ? (
              <div className="text-[13px] text-ink-3">{t("admin.noBreakGlass")}</div>
            ) : (
              <ul>
                {data.breakGlass.map((e) => (
                  <li key={e.id} className="border-t border-line py-2.5 text-[13px] first:border-t-0">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-ink">{e.user?.fullName ?? "—"}</span>
                      <span className="text-ink-3">→</span>
                      <span className="text-ink">{companyName(e.company, e.companyId ?? "—")}</span>
                      <span className="ml-auto text-ink-3 tnum">{formatDateTime(e.createdAt, intl)}</span>
                    </div>
                    <div className="mt-0.5 text-ink-2">{String((e.meta as { reason?: string } | null)?.reason ?? "")}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ── Companies ─────────────────────────────────────────────────────────────────

function CompaniesTab() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const router = useRouter();
  const { list, enterBreakGlass, select } = useCompanyStore();
  const [rows, setRows] = useState<AdminCompany[] | null>(null);
  const [error, setError] = useState("");
  const [entering, setEntering] = useState<AdminCompany | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    backoffice.adminCompanies().then(setRows).catch((e) => setError(formatApiError(e, t("common.error"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberOf = useMemo(() => new Set(list.filter((c) => !c.breakGlass).map((c) => c.company.id)), [list]);

  const open = (c: AdminCompany) => {
    if (memberOf.has(c.id)) {
      select(c.id);
      router.push("/office");
      return;
    }
    setReason("");
    setEntering(c);
  };

  const confirmEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entering || reason.trim().length < 10) return;
    const summary: CompanySummary = { id: entering.id, legalName: entering.legalName, dba: entering.dba, usdot: entering.usdot, language: entering.language, timezone: entering.timezone, isDemo: entering.isDemo };
    enterBreakGlass(summary, reason.trim());
    setEntering(null);
    router.push("/office");
  };

  if (error) return <Banner tone="danger">{error}</Banner>;
  return (
    <>
    <Card>
      {!rows ? (
        <CardBody>
          <SkeletonRows rows={4} />
        </CardBody>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Building2 size={20} />} title={t("common.empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="thead">
              <tr>
                <th className="px-4 py-2.5">{t("admin.colCompany")}</th>
                <th className="px-4 py-2.5">{t("admin.colUsdot")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.colMembers")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.colTrucks")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.colDocs")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.colTx")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.colErrors")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.colFailed")}</th>
                <th className="px-4 py-2.5">{t("admin.colLast")}</th>
                <th className="px-4 py-2.5">{t("admin.colCreated")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-surface">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{c.dba || c.legalName}</div>
                    <div className="text-xs text-ink-3">
                      {c.dba ? `${c.legalName} · ` : ""}
                      {c.isDemo && <span>{t("app.demo")} · </span>}
                      <span className="font-mono">{c.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tnum">{c.usdot ?? "—"}</td>
                  <td className="px-4 py-3 text-right tnum">{c.counts.members}</td>
                  <td className="px-4 py-3 text-right tnum">{c.counts.vehicles}</td>
                  <td className="px-4 py-3 text-right tnum">{c.counts.documents}</td>
                  <td className="px-4 py-3 text-right tnum">{c.counts.transactions}</td>
                  <td className={`px-4 py-3 text-right tnum ${c.counts.openErrorIssues ? "font-semibold text-warning" : ""}`}>{c.counts.openErrorIssues}</td>
                  <td className={`px-4 py-3 text-right tnum ${c.counts.failedJobs ? "font-semibold text-danger" : ""}`}>{c.counts.failedJobs}</td>
                  <td className="px-4 py-3 tnum">{c.lastDocumentAt ? formatDate(c.lastDocumentAt, intl) : "—"}</td>
                  <td className="px-4 py-3 tnum">{formatDate(c.createdAt, intl)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant={memberOf.has(c.id) ? "secondary" : "ghost"} icon={memberOf.has(c.id) ? undefined : <ShieldAlert size={13} />} onClick={() => open(c)}>
                      {memberOf.has(c.id) ? t("admin.open") : t("admin.enter")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
      {entering && (
        <Drawer title={t("admin.enterTitle", { company: entering.dba || entering.legalName })} onClose={() => setEntering(null)} width={480}>
          <form onSubmit={confirmEnter} className="grid gap-4">
            <Banner tone="warning">{t("admin.enterHint")}</Banner>
            <Textarea label={t("admin.reason")} required minLength={10} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.reasonPlaceholder")} />
            <div className="flex gap-2">
              <Button type="submit" icon={<ShieldAlert size={14} />} disabled={reason.trim().length < 10}>{t("admin.enterConfirm")}</Button>
              <Button type="button" variant="secondary" onClick={() => setEntering(null)}>{t("common.cancel")}</Button>
            </div>
          </form>
        </Drawer>
      )}
    </>
  );
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

function JobsTab() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const [status, setStatus] = useState<JobStatus | "ALL">("FAILED");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  // Rows are keyed by the filter they were loaded for; a filter change shows the skeleton until its rows arrive.
  const key = `${status}|${companyId}`;
  const [data, setData] = useState<{ key: string; jobs: AdminJob[]; counts: Record<JobStatus, number> } | null>(null);
  const jobs = data?.key === key ? data.jobs : null;
  const counts = data?.counts ?? null;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await backoffice.adminJobs({ ...(status !== "ALL" ? { status } : {}), ...(companyId ? { companyId } : {}), limit: 100 });
      setData({ key, jobs: r.jobs, counts: r.counts });
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    }
  };

  useEffect(() => {
    backoffice.adminCompanies().then(setCompanies).catch(() => undefined);
  }, []);
  useEffect(() => {
    backoffice
      .adminJobs({ ...(status !== "ALL" ? { status } : {}), ...(companyId ? { companyId } : {}), limit: 100 })
      .then((r) => setData({ key, jobs: r.jobs, counts: r.counts }))
      .catch((e) => setError(formatApiError(e, t("common.error"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = async (id: string) => {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      await backoffice.adminRetryJob(id);
      setNotice(t("admin.retried"));
      await load();
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const retryAll = async () => {
    setBusy("all");
    setError("");
    setNotice("");
    try {
      const n = await backoffice.adminRetryFailed(companyId || undefined);
      setNotice(t("admin.retriedAll", { count: n }));
      await load();
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const statusOptions: Array<{ value: JobStatus | "ALL"; label: string; count?: number }> = [
    { value: "ALL", label: t("admin.allStatuses"), count: counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined },
    ...(["FAILED", "QUEUED", "RUNNING", "DONE"] as JobStatus[]).map((s) => ({ value: s, label: t(`jobStatus.${s}`), count: counts?.[s] })),
  ];

  return (
    <div className="grid gap-4">
      <Banner tone="info">{t("admin.jobsHint")}</Banner>
      <div className="flex flex-wrap items-end gap-3">
        <Tabs ariaLabel={t("admin.colStatus")} value={status} onChange={setStatus} options={statusOptions} />
        <Select label={t("admin.colCompany")} value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="min-w-56">
          <option value="">{t("admin.allCompanies")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.dba || c.legalName}</option>
          ))}
        </Select>
        <div className="ml-auto">
          <Button variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "all"} disabled={!counts?.FAILED} onClick={retryAll}>
            {t("admin.retryAll")} {counts?.FAILED ? `(${counts.FAILED})` : ""}
          </Button>
        </div>
      </div>
      {error && <Banner tone="danger">{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}
      <Card>
        {!jobs ? (
          <CardBody>
            <SkeletonRows rows={4} />
          </CardBody>
        ) : jobs.length === 0 ? (
          <EmptyState icon={<RefreshCw size={20} />} title={t("admin.noJobs")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="thead">
                <tr>
                  <th className="px-4 py-2.5">{t("admin.colUpdated")}</th>
                  <th className="px-4 py-2.5">{t("admin.colStep")}</th>
                  <th className="px-4 py-2.5">{t("admin.colCompany")}</th>
                  <th className="px-4 py-2.5">{t("admin.colDocument")}</th>
                  <th className="px-4 py-2.5">{t("admin.colStatus")}</th>
                  <th className="px-4 py-2.5 text-right">{t("admin.colAttempts")}</th>
                  <th className="px-4 py-2.5">{t("admin.colError")}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-line align-top hover:bg-surface">
                    <td className="px-4 py-3 tnum whitespace-nowrap">{formatDateTime(j.updatedAt, intl)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{j.step}</td>
                    <td className="px-4 py-3">{companyName(j.company, j.companyId ? j.companyId.slice(0, 8) : "—")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-2">{j.documentId ? j.documentId.slice(0, 8) : "—"}</td>
                    <td className="px-4 py-3"><Pill label={t(`jobStatus.${j.status}`)} tone={JOB_TONES[j.status]} /></td>
                    <td className="px-4 py-3 text-right tnum">{j.attempts} / {j.maxAttempts}</td>
                    <td className="max-w-[360px] px-4 py-3 text-xs text-ink-2 break-words">{j.error ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {j.status === "FAILED" && (
                        <Button size="sm" variant="secondary" loading={busy === j.id} onClick={() => retry(j.id)}>{t("admin.retry")}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────────

function AuditTab() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ companyId: "", action: "", q: "" });
  const key = `${applied.companyId}|${applied.action}|${applied.q}`;
  const [data, setData] = useState<{ key: string; entries: AdminAuditEntry[]; nextBefore: string | null } | null>(null);
  const entries = data?.key === key ? data.entries : null;
  const nextBefore = data?.key === key ? data.nextBefore : null;
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    backoffice.adminCompanies().then(setCompanies).catch(() => undefined);
  }, []);

  useEffect(() => {
    backoffice
      .adminAudit({ ...(applied.companyId ? { companyId: applied.companyId } : {}), ...(applied.action ? { action: applied.action } : {}), ...(applied.q ? { q: applied.q } : {}), limit: 50 })
      .then((r) => setData({ key, entries: r.entries, nextBefore: r.nextBefore }))
      .catch((e) => setError(formatApiError(e, t("common.error"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const more = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const r = await backoffice.adminAudit({ ...(applied.companyId ? { companyId: applied.companyId } : {}), ...(applied.action ? { action: applied.action } : {}), ...(applied.q ? { q: applied.q } : {}), before: nextBefore, limit: 50 });
      setData((prev) => (prev && prev.key === key ? { key, entries: [...prev.entries, ...r.entries], nextBefore: r.nextBefore } : prev));
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setLoadingMore(false);
    }
  };

  const describe = (e: AdminAuditEntry): string => {
    const m = (e.meta ?? {}) as Record<string, unknown>;
    if (typeof m.reason === "string") return m.reason;
    if (typeof m.requeued === "number") return `${m.requeued} requeued`;
    if (typeof m.rows === "number") return `${m.rows} rows`;
    if (typeof m.step === "string") return String(m.step);
    const keys = Object.keys(m).slice(0, 3);
    return keys.map((k) => `${k}: ${typeof m[k] === "object" ? JSON.stringify(m[k]) : String(m[k])}`).join(" · ");
  };

  return (
    <div className="grid gap-4">
      <Banner tone="info">{t("admin.auditHint")}</Banner>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ companyId, action, q: q.trim() });
        }}
      >
        <Select label={t("admin.colCompany")} value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="min-w-56">
          <option value="">{t("admin.allCompanies")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.dba || c.legalName}</option>
          ))}
        </Select>
        <Select label={t("admin.colAction")} value={action} onChange={(e) => setAction(e.target.value)} className="min-w-48">
          <option value="">{t("admin.allActions")}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
        <Input label={t("admin.colTarget")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.search")} className="min-w-64" />
        <Button type="submit" variant="secondary">{t("admin.apply")}</Button>
      </form>
      {error && <Banner tone="danger">{error}</Banner>}
      <Card>
        {!entries ? (
          <CardBody>
            <SkeletonRows rows={5} />
          </CardBody>
        ) : entries.length === 0 ? (
          <EmptyState icon={<ScrollText size={20} />} title={t("admin.noAudit")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="thead">
                <tr>
                  <th className="px-4 py-2.5">{t("admin.colWhen")}</th>
                  <th className="px-4 py-2.5">{t("admin.colWho")}</th>
                  <th className="px-4 py-2.5">{t("admin.colCompany")}</th>
                  <th className="px-4 py-2.5">{t("admin.colAction")}</th>
                  <th className="px-4 py-2.5">{t("admin.colTarget")}</th>
                  <th className="px-4 py-2.5">{t("admin.colDetails")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-line align-top hover:bg-surface">
                    <td className="px-4 py-3 tnum whitespace-nowrap">{formatDateTime(e.createdAt, intl)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{e.user?.fullName ?? "—"}</div>
                      {e.user?.email && <div className="text-xs text-ink-3">{e.user.email}</div>}
                    </td>
                    <td className="px-4 py-3">{e.company ? e.company.dba || e.company.legalName : <span className="text-ink-3">{t("admin.platform")}</span>}</td>
                    <td className="px-4 py-3"><Pill label={e.action} tone={e.action === "break_glass" ? "red" : e.action === "login_failed" ? "amber" : "grey"} /></td>
                    <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-ink-2" title={e.target ?? ""}>{e.target ?? "—"}</td>
                    <td className="max-w-[360px] px-4 py-3 text-xs text-ink-2 break-words">{describe(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextBefore && (
          <div className="border-t border-line p-2 text-center">
            <Button variant="ghost" size="sm" loading={loadingMore} onClick={more}>{t("admin.loadMore")}</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
