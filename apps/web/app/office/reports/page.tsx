"use client";
/**
 * Reports: generate and download deliverables. Every file records the data
 * snapshot it was built from (hash), so it can be regenerated identically.
 */
import { useEffect, useState } from "react";
import { Download, FileBarChart, FileSpreadsheet } from "lucide-react";
import { backoffice, formatDateTime, type Period, periodLabel, type Report, type ReportType, shortHash } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, REPORT_TONES } from "@/components/ui/Pill";

const TYPES: Array<{ type: ReportType; icon: React.ReactNode }> = [
  { type: "TRANSACTIONS_CSV", icon: <FileSpreadsheet size={18} /> },
  { type: "IFTA_WORKSHEET", icon: <FileBarChart size={18} /> },
];

export default function ReportsPage() {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<ReportType | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    Promise.all([backoffice.periods(companyId), backoffice.reports(companyId)])
      .then(([ps, rs]) => {
        if (cancelled) return;
        setPeriods(ps);
        if (!periodId && ps[0]) setPeriodId(ps[0].id);
        setReports(rs);
        setLoadedFor(companyId);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(formatApiError(e, t("common.error")));
        setLoadedFor(companyId);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const generate = async (type: ReportType) => {
    if (!companyId || !periodId) return;
    setBusy(type);
    setError("");
    try {
      const r = await backoffice.generateReport(companyId, { type, periodId });
      setReports((prev) => [r, ...prev]);
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const download = async (id: string) => {
    if (!companyId) return;
    setDownloading(id);
    try {
      const { signedUrl } = await backoffice.report(companyId, id);
      window.open(signedUrl, "_blank", "noopener");
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setDownloading(null);
    }
  };

  const periodName = (id: string) => {
    const p = periods.find((x) => x.id === id);
    return p ? periodLabel(p) : "";
  };

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.subtitle")}
        actions={
          periods.length > 0 ? (
            <Select aria-label={t("transactions.period")} value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="w-40">
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{periodLabel(p)}</option>
              ))}
            </Select>
          ) : undefined
        }
      />
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

      <div className="grid gap-4 md:grid-cols-2">
        {TYPES.map(({ type, icon }) => (
          <Card key={type}>
            <CardHeader title={<span className="inline-flex items-center gap-2">{icon}{t(`reportType.${type}`)}</span>} description={t(`reportType.${type}_hint`)} />
            <CardBody>
              <Button onClick={() => generate(type)} loading={busy === type} disabled={!periodId} icon={<Download size={16} />}>
                {t("reports.generate")}
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title={t("reports.history")} description={t("reports.historyHint")} />
        {loadedFor !== companyId ? (
          <SkeletonRows />
        ) : reports.length === 0 ? (
          <EmptyState icon={<FileBarChart size={20} />} title={t("reports.empty")} description={t("reports.emptyHint")} />
        ) : (
          <ul>
            {reports.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{t(`reportType.${r.type}`)} · {periodName(r.periodId)}</div>
                  <div className="text-xs text-ink-3">{formatDateTime(r.createdAt, intl)} · {t("reports.snapshot")} <code>{shortHash(r.snapshotHash)}</code></div>
                </div>
                <Pill label={t(`reportStatus.${r.status}`)} tone={REPORT_TONES[r.status]} />
                <Button size="sm" variant="secondary" onClick={() => download(r.id)} loading={downloading === r.id} icon={<Download size={14} />}>
                  {t("common.download")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
