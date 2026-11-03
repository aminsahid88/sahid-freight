"use client";
/**
 * Review queue: open issues sorted by severity. Each item links to its
 * transaction or document and is closed with a note (resolve = fixed,
 * accept = known and fine). Every action is audited.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { backoffice, formatDate, formatMoney, type Issue, type IssueStatus, type Severity } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { ISSUE_TONES, Pill, SEVERITY_TONES } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";

const ORDER: Record<Severity, number> = { ERROR: 0, WARNING: 1, INFO: 2 };

export default function ReviewPage() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const [status, setStatus] = useState<IssueStatus>("OPEN");
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [issues, setIssues] = useState<Issue[]>([]);
  const key = `${companyId}:${status}:${severity}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Issue | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const k = `${companyId}:${status}:${severity}`;
    backoffice
      .issues(companyId, { status, severity: severity === "ALL" ? undefined : severity, limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setIssues([...res.issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]));
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
  }, [companyId, status, severity]);

  const loading = loadedKey !== key;
  const counts = { ERROR: issues.filter((i) => i.severity === "ERROR").length, WARNING: issues.filter((i) => i.severity === "WARNING").length, INFO: issues.filter((i) => i.severity === "INFO").length };

  return (
    <div>
      <PageHeader title={t("review.title")} description={t("review.subtitle")} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs ariaLabel={t("review.severity")} value={severity} onChange={setSeverity} options={[{ value: "ALL" as const, label: t("inbox.filterAll"), count: issues.length }, { value: "ERROR" as const, label: t("severity.ERROR"), count: counts.ERROR }, { value: "WARNING" as const, label: t("severity.WARNING"), count: counts.WARNING }, { value: "INFO" as const, label: t("severity.INFO"), count: counts.INFO }]} />
        <Tabs ariaLabel={t("review.status")} value={status} onChange={setStatus} options={[{ value: "OPEN" as const, label: t("issueStatus.OPEN") }, { value: "RESOLVED" as const, label: t("issueStatus.RESOLVED") }, { value: "ACCEPTED" as const, label: t("issueStatus.ACCEPTED") }]} />
      </div>
      {error && <Banner tone="danger" className="mb-3">{error}</Banner>}

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : issues.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={20} />} title={status === "OPEN" ? t("review.allClear") : t("review.none")} description={status === "OPEN" ? t("review.allClearHint") : undefined} />
        ) : (
          <ul>
            {issues.map((i) => (
              <li key={i.id} className="border-b border-line last:border-b-0">
                <button onClick={() => setOpen(i)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface">
                  <Pill label={t(`severity.${i.severity}`)} tone={SEVERITY_TONES[i.severity]} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      <code className="mr-1.5 text-xs text-ink-3">{i.code}</code>
                      {i.message}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {i.transaction ? `${i.transaction.vendor ?? "—"} · ${formatDate(i.transaction.date, intl)} · ${formatMoney(i.transaction.receiptTotal)}` : i.document ? i.document.filename : ""}
                    </span>
                  </span>
                  {i.status !== "OPEN" && <Pill label={t(`issueStatus.${i.status}`)} tone={ISSUE_TONES[i.status]} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && companyId && (
        <IssueDrawer
          key={open.id}
          companyId={companyId}
          issue={open}
          onClose={() => setOpen(null)}
          onDone={(updated) => {
            setIssues((prev) => prev.filter((x) => x.id !== updated.id));
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function IssueDrawer({ companyId, issue, onClose, onDone }: { companyId: string; issue: Issue; onClose: () => void; onDone: (i: Issue) => void }) {
  const { t } = useT();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"resolve" | "accept" | null>(null);
  const [error, setError] = useState("");

  const act = async (accept: boolean) => {
    setBusy(accept ? "accept" : "resolve");
    setError("");
    try {
      const updated = await backoffice.resolveIssue(companyId, issue.id, note.trim(), accept);
      onDone(updated);
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer title={`${issue.code} · ${t(`severity.${issue.severity}`)}`} onClose={onClose}>
      <p className="text-sm text-ink">{issue.message}</p>
      {issue.fields && issue.fields.length > 0 && <p className="mt-2 text-xs text-ink-3">{t("review.fields")}: {issue.fields.join(", ")}</p>}
      {issue.evidence ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-control border border-line bg-surface p-3 font-mono text-xs text-ink-2">{JSON.stringify(issue.evidence, null, 2)}</pre>
      ) : null}
      {issue.transaction && (
        <a href={`/office/transactions?open=${issue.transaction.id}`} className="mt-3 inline-flex text-[13px] font-semibold text-accent hover:underline">
          {t("review.openTransaction")}
        </a>
      )}
      {issue.document && (
        <a href={`/office/inbox?document=${issue.document.id}`} className="mt-3 ml-4 inline-flex text-[13px] font-semibold text-accent hover:underline">
          {t("review.source")}
        </a>
      )}
      {issue.status === "OPEN" ? (
        <div className="mt-6 flex flex-col gap-3">
          {error && <Banner tone="danger">{error}</Banner>}
          <Textarea label={t("review.reason")} required minLength={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("review.notePlaceholder")} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act(false)} loading={busy === "resolve"} disabled={note.trim().length < 3} icon={<CheckCircle2 size={16} />}>{t("review.resolve")}</Button>
            <Button variant="secondary" onClick={() => act(true)} loading={busy === "accept"} disabled={note.trim().length < 3} icon={<ClipboardCheck size={16} />}>{t("review.accept")}</Button>
          </div>
          <p className="text-xs text-ink-3">{t("review.actionHint")}</p>
        </div>
      ) : (
        <Banner tone="success" className="mt-6">{t(`issueStatus.${issue.status}`)}{issue.resolutionNote ? ` · ${issue.resolutionNote}` : ""}</Banner>
      )}
    </Drawer>
  );
}
