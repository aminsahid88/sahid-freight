"use client";
/**
 * Official IFTA rate table loader (platform admins). Rows are pasted from the
 * iftach.org matrix; the worksheet never estimates a rate. Lives in the control
 * room (/office/admin, Rate tables tab).
 */
import { useEffect, useState } from "react";
import { backoffice } from "@/lib/backoffice";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";

/** Platform admins load the official quarterly IFTA rate matrix here; the worksheet never estimates a rate. */
export function RateTableCard() {
  const { t } = useT();
  const now = new Date();
  const [quarter, setQuarter] = useState(`${now.getUTCFullYear()}Q${Math.floor(now.getUTCMonth() / 3) + 1}`);
  const [sourceUrl, setSourceUrl] = useState("https://www.iftach.org/taxmatrix4/");
  const [rows, setRows] = useState("");
  const [existing, setExisting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    if (!/^\d{4}Q[1-4]$/.test(quarter)) return;
    let cancelled = false;
    backoffice
      .iftaRates(quarter)
      .then((r) => !cancelled && setExisting(r.length))
      .catch(() => !cancelled && setExisting(null));
    return () => {
      cancelled = true;
    };
  }, [quarter]);

  const parsed = rows
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^(jurisdiction|state|jur)/i.test(l))
    .map((l) => l.split(/[,\t;]+/).map((c) => c.trim()))
    .filter((c) => c.length >= 2)
    .map((c) => ({ jurisdiction: c[0]!.toUpperCase(), rate: c[1]!.replace(/[$\s]/g, ""), ...(c[2] ? { surcharge: c[2].replace(/[$\s]/g, "") } : {}) }));

  const load = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await backoffice.loadIftaRates({ quarter, sourceUrl: sourceUrl.trim(), rows: parsed });
      setMsg({ tone: "success", text: t("settings.ratesLoaded", { rows: r.rows, quarter: r.quarter }) });
      setExisting(r.rows);
      setRows("");
    } catch (e) {
      setMsg({ tone: "danger", text: formatApiError(e, t("common.error")) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title={t("settings.rates")} description={t("settings.ratesHint")} />
      <CardBody className="grid gap-3">
        {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t("settings.ratesQuarter")} value={quarter} onChange={(e) => setQuarter(e.target.value.toUpperCase())} pattern="\d{4}Q[1-4]" hint={existing === null ? t("settings.ratesNone") : t("settings.ratesExisting", { quarter, rows: existing })} />
          <Input label={t("settings.ratesSource")} type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </div>
        <Textarea label={t("settings.ratesCsv")} value={rows} onChange={(e) => setRows(e.target.value)} placeholder={"OH,0.4700\nIN,0.5700,0.0000\nIL,0.6520"} className="font-mono" />
        <div>
          <Button onClick={load} loading={busy} disabled={parsed.length === 0 || !/^\d{4}Q[1-4]$/.test(quarter)}>{t("settings.ratesLoad")} ({parsed.length})</Button>
        </div>
      </CardBody>
    </Card>
  );
}
