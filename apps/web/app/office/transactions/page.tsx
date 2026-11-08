"use client";
/**
 * Transactions: the ledger. Every row links to its source document, shows
 * its status and corroboration, and opens a detail drawer with line items,
 * provenance and the edit history. Corrections keep the original value.
 */
import { useEffect, useState } from "react";
import { FileSearch, History, Pencil } from "lucide-react";
import { backoffice, formatDate, formatMoney, formatNumber, type Period, periodLabel, type TransactionRow, type TxStatus } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, DefinitionRow } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, TRANSACTION_TONES } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";

const STATUSES: TxStatus[] = ["NEEDS_ATTENTION", "VERIFIED", "UNABLE_TO_VERIFY"];
type EditableField = "date" | "vendor" | "state" | "unitNumberRaw" | "receiptTotal" | "paymentMethod" | "cardLast4";

export default function TransactionsPage() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [status, setStatus] = useState<TxStatus | "ALL">("ALL");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const key = `${companyId}:${periodId}:${status}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    backoffice
      .periods(companyId)
      .then((ps) => {
        if (cancelled) return;
        setPeriods(ps);
        if (!periodId && ps[0]) setPeriodId(ps[0].id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const k = `${companyId}:${periodId}:${status}`;
    backoffice
      .transactions(companyId, { periodId: periodId || undefined, status: status === "ALL" ? undefined : status, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.transactions);
        setCursor(res.nextCursor);
        setError("");
        setLoadedKey(k);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(formatApiError(e, t("common.error")));
        setLoadedKey(k);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, periodId, status]);

  const loadMore = () => {
    if (!companyId || !cursor) return;
    backoffice.transactions(companyId, { periodId: periodId || undefined, status: status === "ALL" ? undefined : status, cursor, limit: 50 }).then((res) => {
      setRows((prev) => [...prev, ...res.transactions]);
      setCursor(res.nextCursor);
    });
  };

  const loading = loadedKey !== key;
  const gallons = (r: TransactionRow) => r.lines.filter((l) => l.category === "MOTOR_FUEL").reduce((a, l) => a + Number(l.quantity ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={t("transactions.title")}
        description={t("transactions.subtitle")}
        actions={
          periods.length > 0 ? (
            <Select aria-label={t("transactions.period")} value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="w-40">
              <option value="">{t("transactions.allPeriods")}</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{periodLabel(p)}</option>
              ))}
            </Select>
          ) : undefined
        }
      />
      <div className="mb-3">
        <Tabs ariaLabel={t("transactions.status")} value={status} onChange={setStatus} options={[{ value: "ALL" as const, label: t("inbox.filterAll") }, ...STATUSES.map((s) => ({ value: s, label: t(`txStatus.${s}`) }))]} />
      </div>
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileSearch size={20} />}
            title={t("transactions.emptyTitle")}
            description={periodId ? `${t("transactions.empty")} ${t("transactions.emptyPeriodHint")}` : t("transactions.empty")}
            action={periodId ? <Button variant="secondary" onClick={() => setPeriodId("")}>{t("transactions.allPeriods")}</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="thead">
                <tr>
                  <th className="px-4 py-2.5">{t("transactions.date")}</th>
                  <th className="px-4 py-2.5">{t("transactions.vendor")}</th>
                  <th className="px-4 py-2.5">{t("transactions.state")}</th>
                  <th className="px-4 py-2.5">{t("transactions.unit")}</th>
                  <th className="px-4 py-2.5 text-right">{t("transactions.gallons")}</th>
                  <th className="px-4 py-2.5 text-right">{t("transactions.total")}</th>
                  <th className="px-4 py-2.5">{t("transactions.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-line hover:bg-surface" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenId(r.id)}>
                    <td className="px-4 py-3 tnum">{formatDate(r.date, intl)}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{r.vendor ?? <span className="text-ink-3">—</span>}</td>
                    <td className="px-4 py-3">{r.state ?? <span className="text-warning">?</span>}</td>
                    <td className="px-4 py-3">{r.vehicle?.unitNumber ?? r.unitNumberRaw ?? <span className="text-warning">?</span>}</td>
                    <td className="px-4 py-3 text-right tnum">{r.lines.length ? formatNumber(gallons(r)) : "—"}</td>
                    <td className="px-4 py-3 text-right tnum">{formatMoney(r.receiptTotal, r.currency ?? "USD")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Pill label={t(`txStatus.${r.status}`)} tone={TRANSACTION_TONES[r.status] ?? "grey"} />
                        {!!r.openIssueCount && <span className="text-xs text-ink-3 tnum">{r.openIssueCount}</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {cursor && (
          <div className="border-t border-line p-2">
            <Button variant="ghost" className="w-full" onClick={loadMore}>{t("inbox.loadMore")}</Button>
          </div>
        )}
      </Card>

      {openId && companyId && <TransactionDrawer key={openId} companyId={companyId} id={openId} onClose={() => setOpenId(null)} onChanged={(tx) => setRows((prev) => prev.map((r) => (r.id === tx.id ? { ...r, ...tx } : r)))} />}
    </div>
  );
}

function TransactionDrawer({ companyId, id, onClose, onChanged }: { companyId: string; id: string; onClose: () => void; onChanged: (tx: TransactionRow) => void }) {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const [tx, setTx] = useState<TransactionRow | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    backoffice
      .transaction(companyId, id)
      .then((d) => !cancelled && setTx(d))
      .catch((e) => !cancelled && setError(formatApiError(e, t("common.error"))));
    return () => {
      cancelled = true;
    };
  }, [companyId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const updated = await backoffice.editField(companyId, id, { field: editing, newValue: value.trim() || null, reason: reason.trim() });
      setTx(updated);
      onChanged(updated);
      setEditing(null);
      setReason("");
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (field: EditableField) => {
    setEditing(field);
    setValue(String((tx as unknown as Record<string, unknown>)?.[field] ?? ""));
  };

  const row = (field: EditableField, label: string, display: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2.5 text-[13px] last:border-b-0">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="flex items-center gap-2 text-right text-ink">
        <span>{display}</span>
        <button onClick={() => startEdit(field)} aria-label={`${t("review.correct")}: ${label}`} className="text-ink-3 hover:text-accent">
          <Pencil size={14} />
        </button>
      </span>
    </div>
  );

  return (
    <Drawer title={t("transactions.detail")} onClose={onClose}>
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}
      {!tx && !error && <div className="sk h-64" aria-busy />}
      {tx && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill label={t(`txStatus.${tx.status}`)} tone={TRANSACTION_TONES[tx.status] ?? "grey"} />
            <Pill label={t(`corroboration.${tx.corroboration}`)} tone="grey" />
          </div>
          {editing ? (
            <form onSubmit={save} className="mb-4 flex flex-col gap-3 rounded-card bg-surface p-4">
              <div className="text-[13px] font-semibold text-ink">{t("review.correct")}: {t(`transactions.${editing}`)}</div>
              <Input label={t("review.newValue")} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              <Textarea label={t("review.reason")} required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" loading={busy}>{t("common.save")}</Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              </div>
              <p className="text-xs text-ink-3">{t("review.originalKept")}</p>
            </form>
          ) : null}
          {row("date", t("transactions.date"), formatDate(tx.date, intl))}
          {row("vendor", t("transactions.vendor"), tx.vendor ?? "—")}
          {row("state", t("transactions.state"), tx.state ? `${tx.state}${tx.stateSource ? ` (${tx.stateSource})` : ""}` : "—")}
          {row("unitNumberRaw", t("transactions.unit"), tx.vehicle?.unitNumber ?? tx.unitNumberRaw ?? "—")}
          {row("receiptTotal", t("transactions.total"), formatMoney(tx.receiptTotal, tx.currency ?? "USD"))}
          {row("paymentMethod", t("transactions.payment"), tx.paymentMethod ?? "—")}
          {row("cardLast4", t("transactions.cardLast4"), tx.cardLast4 ? `****${tx.cardLast4}` : "—")}
          <DefinitionRow label={t("transactions.source")} value={tx.document ? <a className="font-semibold text-accent hover:underline" href={`/office/inbox?document=${tx.document.id}`}>{tx.document.filename}</a> : "—"} />

          <div className="mt-5 mb-2 text-[13px] font-semibold text-ink">{t("transactions.lines")}</div>
          {tx.lines.length === 0 ? (
            <p className="text-[13px] text-ink-3">{t("transactions.noLines")}</p>
          ) : (
            <table className="w-full text-[13px]">
              <tbody>
                {tx.lines.map((l) => (
                  <tr key={l.id} className="row">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-ink">{l.descriptionRaw}</div>
                      <div className="text-xs text-ink-3">{t(`lineCategory.${l.category}`)}</div>
                    </td>
                    <td className="py-2 text-right tnum text-ink-2">{l.quantity ? `${formatNumber(l.quantity)} ${l.unit ?? ""}` : ""}</td>
                    <td className="py-2 text-right tnum text-ink">{formatMoney(l.amount, tx.currency ?? "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tx.provenance?.fields && (
            <>
              <div className="mt-5 mb-1 text-[13px] font-semibold text-ink">{t("provenance.title")}</div>
              <p className="mb-2 text-xs text-ink-3">{t("provenance.hint")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="thead">
                    <tr>
                      <th className="py-1 pr-2">{t("provenance.field")}</th>
                      <th className="py-1 pr-2">{t("provenance.passA")}</th>
                      <th className="py-1 pr-2">{t("provenance.passB")}</th>
                      <th className="py-1 pr-2">{t("provenance.final")}</th>
                      <th className="py-1">{t("provenance.source")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(tx.provenance.fields)
                      .filter(([, p]) => p.passA !== null || p.passB !== null)
                      .map(([field, p]) => (
                        <tr key={field} className={`border-t border-line ${!p.agree && p.passB !== null ? "bg-[#FFFBEB] dark:bg-[rgba(251,191,36,0.08)]" : ""}`}>
                          <td className="py-1.5 pr-2 font-medium text-ink">{t(`transactions.${field}`) === `transactions.${field}` ? field : t(`transactions.${field}`)}</td>
                          <td className="py-1.5 pr-2 tnum text-ink-2">{p.passA ?? "—"}</td>
                          <td className="py-1.5 pr-2 tnum text-ink-2">{p.passB ?? "—"}</td>
                          <td className="py-1.5 pr-2 tnum font-semibold text-ink">{p.final ?? "—"}</td>
                          <td className="py-1.5 text-ink-3">{p.finalSource ? t(`provenance.${p.finalSource}`) : t("provenance.disagree")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tx.issues && tx.issues.length > 0 && (
            <>
              <div className="mt-5 mb-2 text-[13px] font-semibold text-ink">{t("inbox.issues")}</div>
              {tx.issues.map((i) => (
                <Banner key={i.id} tone={i.severity === "ERROR" ? "danger" : i.severity === "WARNING" ? "warning" : "info"} className="mb-2">
                  <strong>{i.code}</strong> · {i.message} {i.status !== "OPEN" && <span className="text-xs">({t(`issueStatus.${i.status}`)})</span>}
                </Banner>
              ))}
            </>
          )}

          {tx.fieldEdits && tx.fieldEdits.length > 0 && (
            <>
              <div className="mt-5 mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
                <History size={14} /> {t("transactions.history")}
              </div>
              <ul className="text-[13px]">
                {tx.fieldEdits.map((e) => (
                  <li key={e.id} className="border-t border-line py-2">
                    <span className="font-semibold">{t(`transactions.${e.field}`) === `transactions.${e.field}` ? e.field : t(`transactions.${e.field}`)}</span>: <span className="text-ink-3 line-through">{e.oldValue ?? "—"}</span> → <span className="text-ink">{e.newValue ?? "—"}</span>
                    <div className="text-xs text-ink-3">{e.reason} · {formatDate(e.createdAt, intl)}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
