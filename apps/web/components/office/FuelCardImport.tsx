"use client";
/**
 * Fuel-card statement import: choose provider and CSV → check the column
 * mapping (remembered per provider) → import → see how many rows matched
 * receipts. Rows are never counted as receipts; matches corroborate them.
 */
import { useEffect, useRef, useState } from "react";
import { CreditCard, RefreshCw, UploadCloud } from "lucide-react";
import { backoffice, FUEL_CARD_FIELDS, FUEL_CARD_PROVIDERS, type FuelCardImport as ImportRow, type FuelCardMapping, type FuelCardPreview, type FuelCardProvider, formatDateTime, type MatchSummary } from "@/lib/backoffice";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Checkbox, Select } from "@/components/ui/Field";

const REQUIRED: Array<"date" | "gallons" | "amount"> = ["date", "gallons", "amount"];

export function FuelCardImport({ companyId, periodId, onImported }: { companyId: string; periodId: string | null; onImported?: () => void }) {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const fileRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<FuelCardProvider>("comdata");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FuelCardPreview | null>(null);
  const [mapping, setMapping] = useState<FuelCardMapping>({});
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState<"preview" | "import" | "match" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ rows: number; duplicates: number; matching: MatchSummary } | null>(null);
  const [history, setHistory] = useState<ImportRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    backoffice
      .fuelCardImports(companyId)
      .then((rows) => !cancelled && setHistory(rows))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const onFile = async (f: File) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError("");
    setBusy("preview");
    try {
      const p = await backoffice.fuelCardPreview(companyId, f, provider);
      setPreview(p);
      setMapping(p.savedMapping ?? p.detectedMapping);
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const missingRequired = REQUIRED.filter((f) => f !== "gallons" && f !== "amount" ? !mapping[f] : false).concat(!mapping.gallons && !mapping.amount ? ["gallons"] : []);

  const doImport = async () => {
    if (!file) return;
    setBusy("import");
    setError("");
    try {
      const res = await backoffice.fuelCardImport(companyId, file, provider, mapping, save);
      setResult({ rows: res.fuelCardImport.rows, duplicates: res.fuelCardImport.duplicates ?? 0, matching: res.matching });
      setPreview(null);
      setFile(null);
      setHistory(await backoffice.fuelCardImports(companyId));
      onImported?.();
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const rematch = async () => {
    if (!periodId) return;
    setBusy("match");
    setError("");
    try {
      const m = await backoffice.runMatching(companyId, periodId);
      setResult({ rows: 0, duplicates: 0, matching: m });
      onImported?.();
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <CreditCard size={16} /> {t("fuelCard.title")}
          </span>
        }
        description={t("fuelCard.hint")}
        action={
          periodId ? (
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} loading={busy === "match"} onClick={rematch}>
              {t("fuelCard.runMatch")}
            </Button>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}
        {result && (
          <Banner tone="success" title={result.rows ? t("fuelCard.imported", { rows: result.rows, duplicates: result.duplicates }) : t("fuelCard.matched", { matched: result.matching.matched })}>
            <ul className="mt-1 list-disc pl-4">
              {result.rows > 0 && <li>{t("fuelCard.matched", { matched: result.matching.matched })}</li>}
              <li>{t("fuelCard.unmatchedCards", { count: result.matching.unmatchedCardRows })}</li>
              <li>{t("fuelCard.unmatchedReceipts", { count: result.matching.unmatchedReceipts })}</li>
            </ul>
          </Banner>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Select label={t("fuelCard.provider")} value={provider} onChange={(e) => setProvider(e.target.value as FuelCardProvider)} className="w-48">
            {FUEL_CARD_PROVIDERS.map((p) => (
              <option key={p} value={p}>{t(`fuelCardProvider.${p}`)}</option>
            ))}
          </Select>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button variant="secondary" icon={<UploadCloud size={16} />} loading={busy === "preview"} onClick={() => fileRef.current?.click()}>
            {t("fuelCard.chooseFile")}
          </Button>
          <span className="text-xs text-ink-3">{t("fuelCard.xlsxNote")}</span>
        </div>

        {preview && (
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="text-[13px] font-bold text-ink">{t("fuelCard.columns")}</div>
            <p className="mb-3 text-xs text-ink-3">{t("fuelCard.columnsHint")}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FUEL_CARD_FIELDS.map((field) => (
                <Select
                  key={field}
                  label={`${t(`fuelCardField.${field}`)}${field === "date" ? ` (${t("fuelCard.required")})` : ""}`}
                  value={mapping[field] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || undefined })}
                >
                  <option value="">{t("fuelCard.notMapped")}</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </Select>
              ))}
            </div>
            {preview.sampleRows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("fuelCard.sample")}</div>
                <table className="w-full text-xs">
                  <thead className="text-left text-ink-3">
                    <tr>{preview.headers.map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((r, i) => (
                      <tr key={i} className="border-t border-line text-ink-2">
                        {r.map((cell, j) => <td key={j} className="py-1 pr-3 whitespace-nowrap">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Checkbox label={t("fuelCard.saveMapping", { provider: t(`fuelCardProvider.${provider}`) })} checked={save} onChange={(e) => setSave(e.target.checked)} />
              <Button onClick={doImport} loading={busy === "import"} disabled={missingRequired.length > 0} icon={<UploadCloud size={16} />}>
                {t("fuelCard.import")}
              </Button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-[13px] font-bold text-ink">{t("fuelCard.history")}</div>
          {history.length === 0 ? (
            <p className="text-[13px] text-ink-3">{t("fuelCard.none")}</p>
          ) : (
            <ul className="text-[13px]">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between border-t border-line py-2">
                  <span className="text-ink">{t(`fuelCardProvider.${h.provider}`)} · {t("fuelCard.rows", { rows: h.rows })}{typeof h.matched === "number" ? ` · ${t("fuelCard.matched", { matched: h.matched })}` : ""}</span>
                  <span className="text-ink-3">{formatDateTime(h.importedAt, intl)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
