"use client";
/**
 * ELD mileage import for one quarter: choose the ELD provider and CSV →
 * check layout, distance unit and columns (remembered per provider) → see
 * every row problem before anything is written → import. A newer file for a
 * truck replaces its earlier rows; nothing is deleted. After the import the
 * M-rules are re-checked and the outcome is shown.
 */
import { useEffect, useRef, useState } from "react";
import { Route, UploadCloud } from "lucide-react";
import { backoffice, type DistanceUnit, formatDateTime, MILEAGE_FIELDS, MILEAGE_PROVIDERS, type MileageImportResult, type MileageImportRow, type MileageLayout, type MileageMapping, type MileagePreview, type MileageProvider } from "@/lib/backoffice";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Checkbox, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";

const LONG_FIELDS = MILEAGE_FIELDS;
const REQUIRED_LONG = new Set(["unit", "jurisdiction", "totalMiles"]);
const MAX_PROBLEMS_SHOWN = 20;

interface Choices {
  layout: MileageLayout;
  distanceUnit: DistanceUnit;
  mapping: MileageMapping;
}

export function MileageImport({ companyId, periodId, onImported }: { companyId: string; periodId: string; onImported?: () => void }) {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const fileRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<MileageProvider>("motive");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MileagePreview | null>(null);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MileageImportResult | null>(null);
  const [history, setHistory] = useState<MileageImportRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    backoffice
      .mileageImports(companyId, periodId)
      .then((rows) => !cancelled && setHistory(rows))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [companyId, periodId]);

  const runPreview = async (f: File, explicit?: Choices) => {
    setBusy("preview");
    setError("");
    try {
      const p = await backoffice.mileagePreview(companyId, periodId, f, { provider, ...explicit });
      setPreview(p);
      setChoices({ layout: p.layout, distanceUnit: p.distanceUnit, mapping: p.mapping });
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (f: File) => {
    setFile(f);
    setPreview(null);
    setChoices(null);
    setResult(null);
    await runPreview(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const update = (patch: Partial<Choices>) => {
    if (!file || !choices) return;
    const next = { ...choices, ...patch };
    setChoices(next);
    void runPreview(file, next);
  };

  const doImport = async () => {
    if (!file || !choices) return;
    setBusy("import");
    setError("");
    try {
      const res = await backoffice.importMileage(companyId, periodId, file, { provider, ...choices }, save);
      setResult(res);
      setPreview(null);
      setChoices(null);
      setFile(null);
      setHistory(await backoffice.mileageImports(companyId, periodId));
      onImported?.();
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    } finally {
      setBusy(null);
    }
  };

  const problems = preview?.parse.errors ?? [];
  const canImport = !!preview && problems.length === 0 && preview.missing.length === 0 && preview.parse.records.length > 0;
  const mpgOut = result?.rules.opened.M003 ? true : false;

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Route size={16} /> {t("mileage.title")}
          </span>
        }
        description={t("mileage.hint")}
      />
      <CardBody className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}
        {result && (
          <Banner tone={mpgOut ? "warning" : "success"} title={t("mileage.imported", { rows: result.mileageImport.rows })}>
            <ul className="mt-1 list-disc pl-4">
              {result.superseded.records > 0 && <li>{t("mileage.superseded", { records: result.superseded.records })}</li>}
              <li>{t("mileage.rulesChecked", { count: result.rules.transactionsChecked })}</li>
              {(result.rules.opened.M001 > 0 || result.rules.opened.M002 > 0) && <li>{t("mileage.rulesOpened", { m001: result.rules.opened.M001, m002: result.rules.opened.M002 })}</li>}
              {result.rules.resolved > 0 && <li>{t("mileage.rulesResolved", { count: result.rules.resolved })}</li>}
              {result.rules.fleetMpg && <li>{t("mileage.fleetMpgNow", { mpg: result.rules.fleetMpg })}</li>}
              {mpgOut && <li>{t("mileage.mpgOutOfBand")}</li>}
            </ul>
          </Banner>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Select label={t("mileage.provider")} value={provider} onChange={(e) => setProvider(e.target.value as MileageProvider)} className="w-52">
            {MILEAGE_PROVIDERS.map((p) => (
              <option key={p} value={p}>{t(`mileageProvider.${p}`)}</option>
            ))}
          </Select>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button variant="secondary" icon={<UploadCloud size={16} />} loading={busy === "preview" && !preview} onClick={() => fileRef.current?.click()}>
            {t("mileage.chooseFile")}
          </Button>
          <span className="text-xs text-ink-3">{t("mileage.xlsxNote")}</span>
        </div>

        {preview && choices && (
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="text-[13px] font-bold text-ink">{t("mileage.columns")}</div>
            <p className="mb-3 text-xs text-ink-3">{t("mileage.columnsHint")}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label={t("mileage.layout")} value={choices.layout} onChange={(e) => update({ layout: e.target.value as MileageLayout, mapping: {} })}>
                <option value="long">{t("mileage.layoutLong")}</option>
                <option value="wide">{t("mileage.layoutWide")}</option>
              </Select>
              <Select label={t("mileage.distanceUnit")} value={choices.distanceUnit} onChange={(e) => update({ distanceUnit: e.target.value as DistanceUnit })}>
                <option value="mi">{t("mileage.mi")}</option>
                <option value="km">{t("mileage.km")}</option>
              </Select>
              {(choices.layout === "wide" ? (["unit"] as const) : LONG_FIELDS).map((field) => (
                <Select
                  key={field}
                  label={`${t(`mileageField.${field}`)}${choices.layout === "long" && REQUIRED_LONG.has(field) ? ` (${t("mileage.required")})` : ""}`}
                  value={choices.mapping[field] ?? ""}
                  onChange={(e) => update({ mapping: { ...choices.mapping, [field]: e.target.value || undefined } })}
                >
                  <option value="">{t("mileage.notMapped")}</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </Select>
              ))}
            </div>
            {choices.layout === "wide" && <p className="mt-2 text-xs text-ink-3">{t("mileage.stateColumns", { columns: preview.jurisdictionColumns.join(", ") || "—" })}</p>}

            {preview.sampleRows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("mileage.sample")}</div>
                <table className="w-full text-xs">
                  <thead className="text-left text-ink-3">
                    <tr>{preview.headers.map((h, i) => <th key={`${h}-${i}`} className="py-1 pr-3 font-medium">{h}</th>)}</tr>
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

            <div className="mt-4">
              {problems.length > 0 ? (
                <Banner tone="danger" title={t("mileage.problems", { count: problems.length })}>
                  {preview.parse.unknownUnits.length > 0 && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span>{t("mileage.unknownUnits", { units: preview.parse.unknownUnits.join(", ") })}</span>
                      <LinkButton href="/office/vehicles" size="sm" variant="secondary">{t("mileage.goVehicles")}</LinkButton>
                    </div>
                  )}
                  <ul className="list-disc pl-4">
                    {problems.slice(0, MAX_PROBLEMS_SHOWN).map((p, i) => (
                      <li key={i}>
                        <span className="font-semibold">{t("mileage.row", { row: p.row })}</span> · {p.message}
                      </li>
                    ))}
                    {problems.length > MAX_PROBLEMS_SHOWN && <li>…</li>}
                  </ul>
                </Banner>
              ) : (
                preview.parse.records.length > 0 && <Banner tone="info">{t("mileage.ready", { records: preview.parse.records.length, skipped: preview.parse.skipped })}</Banner>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Checkbox label={t("mileage.saveMapping", { provider: t(`mileageProvider.${provider}`) })} checked={save} onChange={(e) => setSave(e.target.checked)} />
              <Button onClick={doImport} loading={busy === "import"} disabled={!canImport || busy === "preview"} icon={<UploadCloud size={16} />}>
                {t("mileage.import")}
              </Button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-[13px] font-bold text-ink">{t("mileage.history")}</div>
          {history.length === 0 ? (
            <p className="text-[13px] text-ink-3">{t("mileage.none")}</p>
          ) : (
            <ul className="text-[13px]">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2">
                  <span className="inline-flex flex-wrap items-center gap-2 text-ink">
                    <span>{(MILEAGE_PROVIDERS as string[]).includes(h.provider) ? t(`mileageProvider.${h.provider}`) : h.provider}</span>
                    {h.filename && <span className="text-ink-3">· {h.filename}</span>}
                    <span className="text-ink-3">· {t("mileage.activeRows", { active: h.activeRows, rows: h.rows })}</span>
                    {h.distanceUnit === "km" && <Pill label="km → mi" tone="grey" />}
                    {h.activeRows === 0 && h.rows > 0 && <Pill label={t("mileage.replaced")} tone="grey" />}
                  </span>
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
