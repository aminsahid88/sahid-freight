"use client";
/**
 * Review: the queue of flagged records across every company the user may
 * review, sorted by SLA deadline, and the side-by-side workspace (source
 * image with the selected field's region highlighted, both reads, one-click
 * decisions, flags, history, reviewer time). Owners also get an Approvals tab
 * for reviewer corrections to material fields.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ClipboardCheck, Clock, Eye, EyeOff, Minus, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import {
  type ApprovalRow,
  backoffice,
  type CompanyRole,
  type FieldAction,
  formatDate,
  formatDateTime,
  formatMoney,
  type Issue,
  type ReviewQueue,
  type Severity,
  type TransactionRow,
} from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, SEVERITY_TONES, TRANSACTION_TONES } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";

const APPROVER_ROLES: CompanyRole[] = ["OWNER", "ADMIN"];

/** Transaction-level fields in review order: contract name, Transaction column, provenance key. */
const SCALAR_FIELDS: Array<{ contract: string; column: string; prov: string }> = [
  { contract: "transaction_date", column: "date", prov: "date" },
  { contract: "vendor", column: "vendor", prov: "vendor" },
  { contract: "state", column: "state", prov: "state" },
  { contract: "unit_number", column: "unitNumberRaw", prov: "unitNumber" },
  { contract: "receipt_total", column: "receiptTotal", prov: "receiptTotal" },
  { contract: "currency", column: "currency", prov: "currency" },
  { contract: "time", column: "time", prov: "time" },
  { contract: "seller_address", column: "sellerAddress", prov: "sellerAddress" },
  { contract: "odometer", column: "odometer", prov: "odometer" },
  { contract: "payment_method", column: "paymentMethod", prov: "paymentMethod" },
  { contract: "card_last4", column: "cardLast4", prov: "cardLast4" },
];
const LINE_FIELDS: Array<{ suffix: "quantity" | "unit_price" | "amount"; column: "quantity" | "unitPrice" | "amount" }> = [
  { suffix: "quantity", column: "quantity" },
  { suffix: "unit_price", column: "unitPrice" },
  { suffix: "amount", column: "amount" },
];

export default function ReviewPage() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const { selected } = useCompanyStore();
  const [tab, setTab] = useState<"queue" | "approvals">("queue");
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [mine, setMine] = useState(false);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [open, setOpen] = useState<{ companyId: string; id: string; role: CompanyRole } | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRow[] | null>(null);

  const key = `${companyFilter}:${mine}`;
  const load = useCallback(() => {
    const k = `${companyFilter}:${mine}`;
    return backoffice
      .reviewQueue({ companyId: companyFilter || undefined, mine })
      .then((q) => {
        setQueue(q);
        setError("");
        setLoadedKey(k);
      })
      .catch((e) => {
        setError(formatApiError(e, t("common.error")));
        setLoadedKey(k);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter, mine]);

  useEffect(() => {
    void load();
  }, [load]);

  const canApprove = useMemo(() => (queue?.companies ?? []).some((c) => APPROVER_ROLES.includes(c.role)), [queue]);
  const loadApprovals = useCallback(() => backoffice.allPendingApprovals().then(setApprovals).catch((e) => setError(formatApiError(e, t("common.error")))), [t]);
  useEffect(() => {
    if (tab === "approvals") void loadApprovals();
  }, [tab, loadApprovals]);

  const loading = loadedKey !== key;
  const items = (queue?.items ?? []).filter((i) => severity === "ALL" || i.worstSeverity === severity);
  const counts = { ERROR: 0, WARNING: 0, INFO: 0 } as Record<Severity, number>;
  for (const i of queue?.items ?? []) counts[i.worstSeverity] += 1;
  const multiCompany = (queue?.companies.length ?? 0) > 1;
  const companyName = (c: { legalName: string; dba: string | null }) => c.dba ?? c.legalName;

  return (
    <div>
      <PageHeader
        title={t("review.title")}
        description={t("review.slaHint")}
        actions={
          canApprove ? (
            <Tabs ariaLabel={t("review.title")} value={tab} onChange={setTab} options={[{ value: "queue" as const, label: t("review.queue"), count: queue?.total }, { value: "approvals" as const, label: t("review.approvals"), count: approvals?.length }]} />
          ) : undefined
        }
      />
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}

      {tab === "approvals" ? (
        <ApprovalsList approvals={approvals} onChanged={() => { void loadApprovals(); void load(); }} onOpen={(a) => a.company && a.payload?.transactionId && setOpen({ companyId: a.company.id, id: a.payload.transactionId, role: "OWNER" })} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Tabs ariaLabel={t("review.severity")} value={severity} onChange={setSeverity} options={[{ value: "ALL" as const, label: t("inbox.filterAll"), count: queue?.items.length }, { value: "ERROR" as const, label: t("severity.ERROR"), count: counts.ERROR }, { value: "WARNING" as const, label: t("severity.WARNING"), count: counts.WARNING }, { value: "INFO" as const, label: t("severity.INFO"), count: counts.INFO }]} />
            <div className="flex flex-wrap items-center gap-3">
              {multiCompany && (
                <Select aria-label={t("review.company")} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-48">
                  <option value="">{t("review.allCompanies")}</option>
                  {queue!.companies.map((c) => (
                    <option key={c.id} value={c.id}>{companyName(c)}</option>
                  ))}
                </Select>
              )}
              <Checkbox label={t("review.mine")} checked={mine} onChange={(e) => setMine(e.target.checked)} />
            </div>
          </div>

          <Card className="overflow-hidden">
            {loading ? (
              <SkeletonRows rows={4} />
            ) : items.length === 0 ? (
              <EmptyState icon={<ShieldCheck size={20} />} title={t("review.noQueue")} description={t("review.noQueueHint")} />
            ) : (
              <ul>
                {items.map((i) => (
                  <li key={i.id} className="border-b border-line last:border-b-0">
                    <button onClick={() => setOpen({ companyId: i.company.id, id: i.id, role: i.role })} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface">
                      <Pill label={t(`severity.${i.worstSeverity}`)} tone={SEVERITY_TONES[i.worstSeverity]} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">
                          {multiCompany && <span className="mr-2 text-ink-3">{companyName(i.company)} ·</span>}
                          {i.vendor ?? "—"} · {formatDate(i.date, intl)} · {formatMoney(i.receiptTotal, i.currency ?? "USD")}
                          {i.unitNumber && <span className="ml-2 text-ink-3">#{i.unitNumber}</span>}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                          {i.openIssues.map((o, n) => (
                            <code key={`${o.code}-${n}`} className="rounded bg-surface2 px-1 text-[11px] text-ink-2">{o.code}</code>
                          ))}
                          <span>· {t(`txStatus.${i.status}`)}</span>
                          {i.claimedBy && <span>· {i.claimedByMe ? t("review.claimedByMe") : t("review.claimedBy", { name: i.claimedByName ?? "" })}</span>}
                        </span>
                      </span>
                      <Pill label={i.overdue ? t("review.overdue") : t("review.due", { date: formatDate(i.deadline, intl) })} tone={i.overdue ? "red" : "grey"} className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {open && (
        <ReviewWorkspace
          key={open.id}
          companyId={open.companyId}
          id={open.id}
          role={open.role}
          onClose={() => {
            setOpen(null);
            void load();
            if (tab === "approvals") void loadApprovals();
          }}
        />
      )}
      {!selected && null}
    </div>
  );
}

// ── Approvals ────────────────────────────────────────────────────────────────

function ApprovalsList({ approvals, onChanged, onOpen }: { approvals: ApprovalRow[] | null; onChanged: () => void; onOpen: (a: ApprovalRow) => void }) {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const decide = async (a: ApprovalRow, decision: "approve" | "reject") => {
    if (!a.company) return;
    setBusy(`${a.id}:${decision}`);
    setError("");
    try {
      await backoffice.decideApproval(a.company.id, a.id, decision, notes[a.id]?.trim() || undefined);
      onChanged();
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className="overflow-hidden">
      {error && <Banner tone="danger" className="m-3">{error}</Banner>}
      {approvals === null ? (
        <SkeletonRows rows={3} />
      ) : approvals.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={20} />} title={t("review.noApprovals")} description={t("review.noApprovalsHint")} />
      ) : (
        <ul>
          {approvals.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-ink">
                  <span className="font-semibold">{t("review.correctionBy", { name: a.user.fullName, field: a.payload?.field ? t(`reviewField.${a.payload.field.replace(/^line_items\.\d+\./, "")}`) : "" })}</span>
                  {a.company && <span className="ml-2 text-ink-3">{a.company.dba ?? a.company.legalName}</span>}
                  <div className="text-xs text-ink-3">{t("review.fromTo", { from: a.payload?.oldValue ?? "—", to: a.payload?.newValue ?? "—" })} · {formatDateTime(a.createdAt, intl)}</div>
                </div>
                <button onClick={() => onOpen(a)} className="text-[13px] font-semibold text-accent hover:underline">{t("review.openTransaction")}</button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Input label={t("review.approveNote")} value={notes[a.id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} className="min-w-64 flex-1" />
                <Button size="sm" icon={<Check size={14} />} loading={busy === `${a.id}:approve`} onClick={() => decide(a, "approve")}>{t("review.approve")}</Button>
                <Button size="sm" variant="danger" icon={<X size={14} />} loading={busy === `${a.id}:reject`} disabled={(notes[a.id] ?? "").trim().length < 3} onClick={() => decide(a, "reject")}>{t("review.reject")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Workspace ────────────────────────────────────────────────────────────────

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** bbox as the contract reports it: [x, y, w, h] as fractions of the page, or pixels of the natural image. */
function toBox(bbox: unknown, natural: { w: number; h: number } | null): Box | null {
  if (!Array.isArray(bbox) || bbox.length < 4 || bbox.some((n) => typeof n !== "number")) return null;
  const [x, y, w, h] = bbox as number[];
  const fractional = Math.max(x, y, w, h) <= 1;
  if (fractional) return { left: x * 100, top: y * 100, width: w * 100, height: h * 100 };
  if (!natural) return null;
  return { left: (x / natural.w) * 100, top: (y / natural.h) * 100, width: (w / natural.w) * 100, height: (h / natural.h) * 100 };
}

function ReviewWorkspace({ companyId, id, role, onClose }: { companyId: string; id: string; role: CompanyRole; onClose: () => void }) {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const [tx, setTx] = useState<TransactionRow | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [entering, setEntering] = useState<{ field: string; label: string } | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [issueNote, setIssueNote] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const released = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        try {
          await backoffice.claim(companyId, id);
        } catch (e) {
          const data = (e as { response?: { status?: number; data?: { message?: string } } }).response;
          if (data?.status === 409) setNotice(data.data?.message ?? "");
          else throw e;
        }
        const detail = await backoffice.transaction(companyId, id);
        if (cancelled) return;
        setTx(detail);
        if (detail.document) {
          const doc = await backoffice.document(companyId, detail.document.id);
          if (cancelled) return;
          setSignedUrl(doc.signedUrl);
          setMime(doc.document.mimeType);
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, t("common.error")));
      }
    })();
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (!released.current) {
        released.current = true;
        void backoffice.release(companyId, id).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, id]);

  const close = async () => {
    if (!released.current) {
      released.current = true;
      await backoffice.release(companyId, id).catch(() => undefined);
    }
    onClose();
  };

  const act = async (field: string, action: FieldAction, extra: { value?: string; reason?: string } = {}) => {
    setBusy(`${field}:${action}`);
    setError("");
    try {
      const res = await backoffice.fieldAction(companyId, id, { field, action, ...extra });
      setTx(res.transaction);
      setEntering(null);
      setValue("");
      setReason("");
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const decideIssue = async (issue: Issue, accept: boolean) => {
    setBusy(`issue:${issue.id}`);
    setError("");
    try {
      await backoffice.resolveIssue(companyId, issue.id, (issueNote[issue.id] ?? "").trim(), accept);
      setTx(await backoffice.transaction(companyId, id));
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const decideApproval = async (approvalId: string, decision: "approve" | "reject") => {
    setBusy(`approval:${approvalId}`);
    setError("");
    try {
      await backoffice.decideApproval(companyId, approvalId, decision, decision === "reject" ? (issueNote[approvalId] ?? "").trim() : undefined);
      setTx(await backoffice.transaction(companyId, id));
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const prov = tx?.provenance?.fields ?? {};
  const edits = tx?.fieldEdits ?? [];
  const editedColumns = new Set(edits.filter((e) => !e.entity || e.entity === "Transaction").map((e) => e.field));
  const editedLines = new Set(edits.filter((e) => e.entity === "TransactionLine").map((e) => `${e.entityId}:${e.field}`));
  const seconds = (tx?.review?.seconds ?? 0) + elapsed;
  const box = selected ? toBox(tx?.fieldBoxes?.[selected]?.bbox, natural) : null;
  const isImage = mime.startsWith("image/");
  const canDecideApprovals = APPROVER_ROLES.includes(role);
  const labelFor = (contract: string) => t(`reviewField.${contract.replace(/^line_items\.\d+\./, "")}`);

  const fieldRow = (contract: string, label: string, current: string | null | undefined, p: { passA: string | null; passB: string | null } | undefined, human: boolean) => {
    const sel = selected === contract;
    return (
      <tr key={contract} className={`border-t border-line ${sel ? "bg-accent/5" : ""}`} onClick={() => setSelected(contract)}>
        <td className="py-2 pr-2 text-ink-3">{label}{tx?.fieldBoxes?.[contract] && <Eye size={12} className="ml-1 inline text-ink-3" />}</td>
        <td className="py-2 pr-2 text-ink-2">{p?.passA ?? <span className="text-ink-3">—</span>}</td>
        <td className="py-2 pr-2 text-ink-2">{p?.passB ?? <span className="text-ink-3">—</span>}</td>
        <td className="py-2 pr-2 font-semibold text-ink">
          {current ?? <span className="font-normal text-ink-3">—</span>}
          {human && <Pill label={t("review.person")} tone="blue" className="ml-1.5" />}
        </td>
        <td className="py-2 text-right whitespace-nowrap">
          <span className="inline-flex gap-1">
            <button title={t("review.acceptA")} disabled={p?.passA == null || busy !== null} onClick={(e) => { e.stopPropagation(); void act(contract, "accept_a"); }} className="rounded-control border border-line px-1.5 py-0.5 text-[11px] font-semibold text-ink hover:border-accent disabled:opacity-40">1</button>
            <button title={t("review.acceptB")} disabled={p?.passB == null || busy !== null} onClick={(e) => { e.stopPropagation(); void act(contract, "accept_b"); }} className="rounded-control border border-line px-1.5 py-0.5 text-[11px] font-semibold text-ink hover:border-accent disabled:opacity-40">2</button>
            <button title={t("review.enter")} onClick={(e) => { e.stopPropagation(); setSelected(contract); setEntering({ field: contract, label }); setValue(current ?? ""); }} className="rounded-control border border-line p-1 text-ink hover:border-accent"><Pencil size={12} /></button>
            <button title={t("review.markUnreadable")} disabled={busy !== null} onClick={(e) => { e.stopPropagation(); if (window.confirm(t("review.confirmUnreadable", { field: label }))) void act(contract, "unreadable"); }} className="rounded-control border border-line p-1 text-ink-3 hover:border-danger hover:text-danger disabled:opacity-40"><EyeOff size={12} /></button>
          </span>
        </td>
      </tr>
    );
  };

  return (
    <Drawer
      title={tx ? `${t("review.workspace")} · ${tx.vendor ?? "—"} · ${formatDate(tx.date, intl)}` : t("review.workspace")}
      onClose={close}
      width={1120}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><Clock size={12} /> {t("review.time")}: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
          <Button variant="secondary" onClick={close}>{t("review.release")}</Button>
        </div>
      }
    >
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}
      {notice && <Banner tone="warning" className="mb-3">{notice}</Banner>}
      {!tx && !error && <div className="sk h-64" aria-busy />}
      {tx && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">{t("review.sourceImage")}</span>
              {isImage && (
                <span className="inline-flex gap-1">
                  <button aria-label={t("review.zoomOut")} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded-control border border-line p-1 text-ink"><Minus size={12} /></button>
                  <span className="px-1 text-xs text-ink-3 tnum">{Math.round(zoom * 100)}%</span>
                  <button aria-label={t("review.zoomIn")} onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded-control border border-line p-1 text-ink"><Plus size={12} /></button>
                </span>
              )}
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-card bg-surface">
              {!signedUrl ? (
                <p className="p-4 text-[13px] text-ink-3">{t("review.noSource")}</p>
              ) : isImage ? (
                <div className="relative inline-block" style={{ width: `${zoom * 100}%` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signedUrl} alt={tx.document?.filename ?? ""} className="block w-full" onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                  {box && <div className="pointer-events-none absolute rounded-sm border-2 border-accent bg-accent/15" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }} />}
                </div>
              ) : (
                <div className="p-4">
                  <iframe src={signedUrl} title={tx.document?.filename ?? "source"} className="h-[60vh] w-full rounded-control border border-line bg-white" />
                  <a href={signedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] font-semibold text-accent hover:underline">{t("review.openPdf")}</a>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Pill label={t(`txStatus.${tx.status}`)} tone={TRANSACTION_TONES[tx.status] ?? "grey"} />
              <Pill label={t(`corroboration.${tx.corroboration}`)} tone="grey" />
              {tx.review?.claimedBy && tx.review.claimedByName && <Pill label={t("review.claimedBy", { name: tx.review.claimedByName })} tone="blue" />}
            </div>

            {entering && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(entering.field, "enter", { value: value.trim(), reason: reason.trim() });
                }}
                className="mb-3 flex flex-col gap-2 rounded-card bg-surface p-3"
              >
                <div className="text-[13px] font-semibold text-ink">{t("review.enterValue", { field: entering.label })}</div>
                <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
                <Textarea label={t("review.reason")} required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" loading={busy === `${entering.field}:enter`} disabled={value.trim() === "" || reason.trim().length < 3}>{t("common.save")}</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEntering(null)}>{t("common.cancel")}</Button>
                </div>
                <p className="text-xs text-ink-3">{t("review.originalKept")}</p>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="thead">
                  <tr>
                    <th className="py-1.5 pr-2">{t("review.field")}</th>
                    <th className="py-1.5 pr-2">{t("review.read1")}</th>
                    <th className="py-1.5 pr-2">{t("review.read2")}</th>
                    <th className="py-1.5 pr-2">{t("review.final")}</th>
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {SCALAR_FIELDS.map((f) => {
                    const current = (tx as unknown as Record<string, unknown>)[f.column];
                    const text = current == null ? null : f.column === "date" ? formatDate(String(current), intl) : String(current);
                    return fieldRow(f.contract, labelFor(f.contract), text, prov[f.prov], editedColumns.has(f.column));
                  })}
                  {tx.lines.map((line, n) => (
                    <Fragment key={line.id}>
                      <tr className="row bg-surface">
                        <td colSpan={5} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("review.lineItem", { n: n + 1 })} · {line.descriptionRaw} · {t(`lineCategory.${line.category}`)}</td>
                      </tr>
                      {LINE_FIELDS.map((lf) => {
                        const contract = `line_items.${n}.${lf.suffix}`;
                        const current = (line as unknown as Record<string, unknown>)[lf.column];
                        return fieldRow(contract, labelFor(contract), current == null ? null : String(current), prov[`line_items.${n}.${lf.column}`], editedLines.has(`${line.id}:${lf.column}`));
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {tx.review && tx.review.pendingApprovals.length > 0 && (
              <div className="mt-4 rounded-card border border-warning/40 bg-warning/5 p-3">
                <div className="mb-1 text-[13px] font-semibold text-ink">{t("review.pending")}</div>
                <ul className="flex flex-col gap-2 text-[13px]">
                  {tx.review.pendingApprovals.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{a.payload?.field ? labelFor(a.payload.field) : ""}: {t("review.fromTo", { from: a.payload?.oldValue ?? "—", to: a.payload?.newValue ?? "—" })}</span>
                      {canDecideApprovals && (
                        <span className="flex flex-wrap items-center gap-2">
                          <Input placeholder={t("review.rejectNote")} value={issueNote[a.id] ?? ""} onChange={(e) => setIssueNote({ ...issueNote, [a.id]: e.target.value })} className="w-56" />
                          <Button size="sm" icon={<Check size={14} />} loading={busy === `approval:${a.id}`} onClick={() => decideApproval(a.id, "approve")}>{t("review.approve")}</Button>
                          <Button size="sm" variant="danger" disabled={(issueNote[a.id] ?? "").trim().length < 3} onClick={() => decideApproval(a.id, "reject")}>{t("review.reject")}</Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 mb-1 text-[13px] font-semibold text-ink">{t("review.issues")}</div>
            {(tx.issues ?? []).filter((i) => i.status === "OPEN").length === 0 ? (
              <p className="text-[13px] text-ink-3">{t("review.noIssues")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(tx.issues ?? [])
                  .filter((i) => i.status === "OPEN")
                  .map((i) => (
                    <li key={i.id} className="rounded-card bg-canvas shadow-card p-3 text-[13px]">
                      <div className="flex items-start gap-2">
                        <Pill label={t(`severity.${i.severity}`)} tone={SEVERITY_TONES[i.severity]} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1 text-ink"><code className="mr-1.5 text-xs text-ink-3">{i.code}</code>{i.message}</span>
                      </div>
                      {i.code !== "R001" && (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <Input placeholder={t("review.notePlaceholder")} value={issueNote[i.id] ?? ""} onChange={(e) => setIssueNote({ ...issueNote, [i.id]: e.target.value })} className="min-w-56 flex-1" />
                          <Button size="sm" icon={<CheckCircle2 size={14} />} loading={busy === `issue:${i.id}`} disabled={(issueNote[i.id] ?? "").trim().length < 3} onClick={() => decideIssue(i, false)}>{t("review.resolve")}</Button>
                          <Button size="sm" variant="secondary" icon={<ClipboardCheck size={14} />} disabled={(issueNote[i.id] ?? "").trim().length < 3} onClick={() => decideIssue(i, true)}>{t("review.accept")}</Button>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            )}

            <div className="mt-4 mb-1 text-[13px] font-semibold text-ink">{t("review.history")}</div>
            {edits.length === 0 ? (
              <p className="text-[13px] text-ink-3">{t("review.noHistory")}</p>
            ) : (
              <ul className="text-xs text-ink-2">
                {edits.map((e) => (
                  <li key={e.id} className="border-t border-line py-1.5">
                    <span className="font-semibold text-ink">{e.field}</span>: {e.oldValue ?? "—"} → {e.newValue ?? "—"} · {e.reason} · {e.user?.fullName ?? ""} · {formatDateTime(e.createdAt, intl)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
