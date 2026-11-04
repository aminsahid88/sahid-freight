"use client";
/**
 * Fuel & IFTA: the quarter workspace. Fuel by state from verified records,
 * ELD mileage import, and the worksheet preview labelled PRELIMINARY until
 * every error is resolved and the owner approves.
 */
import { useEffect, useRef, useState } from "react";
import { Fuel, Route, UploadCloud } from "lucide-react";
import { backoffice, formatMoney, formatNumber, type MileageRecord, type Period, type PeriodSummary, periodLabel, type Worksheet } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/Card";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, REPORT_TONES } from "@/components/ui/Pill";
import { FuelCardImport } from "@/components/office/FuelCardImport";

interface WorksheetState {
  data: Worksheet | null;
  ratesMissing: { quarter: string } | null;
  error: string;
}

export default function IftaPage() {
  const { t } = useT();
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [mileage, setMileage] = useState<MileageRecord[]>([]);
  const [ws, setWs] = useState<WorksheetState>({ data: null, ratesMissing: null, error: "" });
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    backoffice
      .periods(companyId)
      .then((ps) => {
        if (cancelled) return;
        setPeriods(ps);
        const q = ps.find((p) => p.type === "QUARTER") ?? ps[0];
        if (!periodId && q) setPeriodId(q.id);
      })
      .catch((e) => !cancelled && setError(formatApiError(e, t("common.error"))));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadPeriod = (cid: string, pid: string, onDone?: () => void) => {
    const key = `${cid}:${pid}`;
    return Promise.all([
      backoffice.periodSummary(cid, pid),
      backoffice.mileage(cid, pid),
      backoffice
        .worksheet(cid, pid)
        .then((w) => ({ data: w, ratesMissing: null, error: "" }))
        .catch((e) => {
          const status = (e as { response?: { status?: number; data?: { quarter?: string } } }).response?.status;
          if (status === 409) return { data: null, ratesMissing: { quarter: (e as { response?: { data?: { quarter?: string } } }).response?.data?.quarter ?? "" }, error: "" };
          return { data: null, ratesMissing: null, error: formatApiError(e, t("common.error")) };
        }),
    ])
      .then(([s, m, w]) => {
        setSummary(s);
        setMileage(m.records);
        setWs(w);
        setError("");
        setLoadedKey(key);
        onDone?.();
      })
      .catch((e) => {
        setError(formatApiError(e, t("common.error")));
        setLoadedKey(key);
      });
  };

  useEffect(() => {
    if (!companyId || !periodId) return;
    let cancelled = false;
    loadPeriod(companyId, periodId).then(() => cancelled && undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, periodId]);

  const onImport = async (file: File) => {
    if (!companyId || !periodId) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await backoffice.importMileage(companyId, periodId, file);
      setImportMsg({ tone: "success", text: t("ifta.imported", { rows: res.rows }) });
      await loadPeriod(companyId, periodId);
    } catch (e) {
      setImportMsg({ tone: "danger", text: formatApiError(e, t("common.error")) });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const period = periods.find((p) => p.id === periodId);
  const loading = loadedKey !== `${companyId}:${periodId}`;
  const mileageByJur = Object.values(
    mileage.reduce<Record<string, { jurisdiction: string; total: number; taxable: number }>>((acc, r) => {
      const a = (acc[r.jurisdiction] ??= { jurisdiction: r.jurisdiction, total: 0, taxable: 0 });
      a.total += Number(r.totalMiles);
      a.taxable += Number(r.taxableMiles);
      return acc;
    }, {}),
  ).sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));

  return (
    <div>
      <PageHeader
        title={t("ifta.title")}
        description={t("ifta.subtitle")}
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

      {loading ? (
        <SkeletonRows rows={4} height="h-20" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat icon={<Fuel size={16} />} label={t("ifta.motorFuelGallons")} value={formatNumber(summary?.fuelByState.reduce((a, s) => a + Number(s.motorFuelGallons), 0) ?? 0)} detail={t("ifta.fromVerified")} />
            <Stat icon={<Route size={16} />} label={t("ifta.totalMiles")} value={formatNumber(mileageByJur.reduce((a, j) => a + j.total, 0), 0)} detail={t("ifta.fromEld")} />
            <Stat label={t("ifta.fleetMpg")} value={ws.data?.worksheet.fleetMpg ?? "—"} detail={ws.data ? t("ifta.mpgHint") : t("ifta.needsBoth")} tone={ws.data?.worksheet.fleetMpg && (Number(ws.data.worksheet.fleetMpg) < 4 || Number(ws.data.worksheet.fleetMpg) > 9) ? "warning" : "default"} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={t("ifta.fuelByState")} description={t("ifta.fuelByStateHint")} />
              <CardBody>
                {!summary || summary.fuelByState.length === 0 ? (
                  <EmptyState icon={<Fuel size={18} />} title={t("ifta.noFuel")} description={t("ifta.noFuelHint")} className="py-8" />
                ) : (
                  <table className="w-full text-[13px]">
                    <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                      <tr>
                        <th className="py-1.5">{t("transactions.state")}</th>
                        <th className="py-1.5 text-right">{t("ifta.gallons")}</th>
                        <th className="py-1.5 text-right">{t("ifta.amount")}</th>
                        <th className="py-1.5 text-right">{t("ifta.reeferDef")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.fuelByState.map((s) => (
                        <tr key={s.state} className="border-t border-line">
                          <td className="py-2 font-semibold">{s.state}</td>
                          <td className="py-2 text-right tnum">{formatNumber(s.motorFuelGallons)}</td>
                          <td className="py-2 text-right tnum">{formatMoney(s.motorFuelAmount)}</td>
                          <td className="py-2 text-right tnum text-ink-3">{formatNumber(Number(s.reeferGallons) + Number(s.defGallons))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {summary && summary.unassigned > 0 && <Banner tone="warning" className="mt-3">{t("ifta.unassigned", { count: summary.unassigned })}</Banner>}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={t("ifta.mileage")}
                description={t("ifta.mileageHint")}
                action={
                  <>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
                    <Button size="sm" variant="secondary" icon={<UploadCloud size={14} />} loading={importing} onClick={() => fileRef.current?.click()}>
                      {t("ifta.importCsv")}
                    </Button>
                  </>
                }
              />
              <CardBody>
                {importMsg && <Banner tone={importMsg.tone} className="mb-3">{importMsg.text}</Banner>}
                {mileageByJur.length === 0 ? (
                  <EmptyState icon={<Route size={18} />} title={t("ifta.noMileage")} description={t("ifta.noMileageHint")} className="py-8" />
                ) : (
                  <table className="w-full text-[13px]">
                    <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                      <tr>
                        <th className="py-1.5">{t("ifta.jurisdiction")}</th>
                        <th className="py-1.5 text-right">{t("ifta.totalMiles")}</th>
                        <th className="py-1.5 text-right">{t("ifta.taxableMiles")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mileageByJur.map((j) => (
                        <tr key={j.jurisdiction} className="border-t border-line">
                          <td className="py-2 font-semibold">{j.jurisdiction}</td>
                          <td className="py-2 text-right tnum">{formatNumber(j.total, 0)}</td>
                          <td className="py-2 text-right tnum">{formatNumber(j.taxable, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="mt-6">
            <FuelCardImport companyId={companyId!} periodId={periodId || null} onImported={() => companyId && periodId && loadPeriod(companyId, periodId)} />
          </div>

          <Card className="mt-6">
            <CardHeader
              title={t("ifta.worksheet")}
              description={period ? t("ifta.worksheetFor", { label: periodLabel(period) }) : ""}
              action={ws.data ? <Pill label={t(`reportStatus.${ws.data.status}`)} tone={REPORT_TONES[ws.data.status]} /> : undefined}
            />
            <CardBody>
              {ws.ratesMissing ? (
                <Banner tone="warning" title={t("ifta.ratesMissingTitle", { quarter: ws.ratesMissing.quarter })}>{t("ifta.ratesMissing")}</Banner>
              ) : ws.error ? (
                <Banner tone="danger">{ws.error}</Banner>
              ) : !ws.data ? (
                <EmptyState title={t("ifta.needsBoth")} className="py-8" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                        <tr>
                          <th className="py-1.5">{t("ifta.jurisdiction")}</th>
                          <th className="py-1.5 text-right">{t("ifta.taxableMiles")}</th>
                          <th className="py-1.5 text-right">{t("ifta.consumed")}</th>
                          <th className="py-1.5 text-right">{t("ifta.taxPaid")}</th>
                          <th className="py-1.5 text-right">{t("ifta.net")}</th>
                          <th className="py-1.5 text-right">{t("ifta.rate")}</th>
                          <th className="py-1.5 text-right">{t("ifta.taxDue")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ws.data.worksheet.rows.map((r) => (
                          <tr key={r.jurisdiction} className="border-t border-line">
                            <td className="py-2 font-semibold">{r.jurisdiction}</td>
                            <td className="py-2 text-right tnum">{formatNumber(r.taxableMiles, 0)}</td>
                            <td className="py-2 text-right tnum">{formatNumber(r.gallonsConsumed)}</td>
                            <td className="py-2 text-right tnum">{formatNumber(r.taxPaidGallons)}</td>
                            <td className={`py-2 text-right tnum ${r.netTaxableGallons && Number(r.netTaxableGallons) < 0 ? "text-success" : ""}`}>{formatNumber(r.netTaxableGallons)}</td>
                            <td className="py-2 text-right tnum text-ink-2">{r.rate ?? "—"}{r.surcharge ? ` +${r.surcharge}` : ""}</td>
                            <td className={`py-2 text-right tnum font-semibold ${r.taxDue && Number(r.taxDue) < 0 ? "text-success" : ""}`}>{formatMoney(r.taxDue)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-line font-bold">
                          <td className="py-2">{t("ifta.fleet")}</td>
                          <td className="py-2 text-right tnum">{formatNumber(ws.data.worksheet.totals.totalMiles, 0)}</td>
                          <td className="py-2 text-right tnum" colSpan={2}>{t("ifta.mpg", { mpg: ws.data.worksheet.fleetMpg ?? "—" })}</td>
                          <td className="py-2 text-right tnum">{formatNumber(ws.data.worksheet.totals.totalTaxableGallons)}</td>
                          <td />
                          <td className="py-2 text-right tnum">{formatMoney(ws.data.worksheet.totals.totalTaxDue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <details className="mt-3 text-xs text-ink-3">
                    <summary className="cursor-pointer font-semibold text-ink-2">{t("ifta.roundingNotes")}</summary>
                    <ul className="mt-2 list-disc pl-5">
                      {ws.data.worksheet.roundingNotes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </details>
                  <p className="mt-3 text-xs text-ink-3">
                    {ws.data.disclaimer}
                    {ws.data.rateSource && (
                      <>
                        {" "}· {t("ifta.rateSource")}: <a className="text-accent hover:underline" href={ws.data.rateSource.sourceUrl} target="_blank" rel="noreferrer">{ws.data.rateSource.quarter}</a>
                      </>
                    )}
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
