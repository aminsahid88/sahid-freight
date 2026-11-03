"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { backoffice } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";

const input: React.CSSProperties = { width: "100%", height: 44, padding: "0 12px", borderRadius: 10, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)", fontSize: 14, fontFamily: "inherit" };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 };

const STATES = ["AL","AR","AZ","CA","CO","CT","DE","FL","GA","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles"];

export default function NewCompanyPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const { setList } = useCompanyStore();
  const [form, setForm] = useState({ legalName: "", dba: "", usdot: "", mcNumber: "", iftaBaseJurisdiction: "MN", timezone: "America/Chicago" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await backoffice.createCompany({
        legalName: form.legalName.trim(),
        dba: form.dba.trim() || undefined,
        usdot: form.usdot.trim() || undefined,
        mcNumber: form.mcNumber.trim() || undefined,
        iftaBaseJurisdiction: form.iftaBaseJurisdiction,
        timezone: form.timezone,
        language: locale === "so" ? "SO" : "EN",
      });
      const list = await backoffice.myCompanies();
      setList(list);
      router.replace("/office/vehicles");
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", margin: "0 0 6px", color: "var(--text)" }}>{t("company.create")}</h1>
      <p style={{ margin: "0 0 20px", color: "var(--text-secondary)", fontSize: 14 }}>{t("app.tagline")}</p>
      {error && <div role="alert" style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", fontSize: 13 }}>{error}</div>}
      <form onSubmit={submit} style={{ display: "grid", gap: 14, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div><label style={label}>{t("company.legalName")}</label><input style={input} required minLength={2} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
        <div><label style={label}>{t("company.dba")}</label><input style={input} value={form.dba} onChange={(e) => setForm({ ...form, dba: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={label}>{t("company.usdot")}</label><input style={input} inputMode="numeric" pattern="\d{1,8}" value={form.usdot} onChange={(e) => setForm({ ...form, usdot: e.target.value })} /></div>
          <div><label style={label}>{t("company.mcNumber")}</label><input style={input} value={form.mcNumber} onChange={(e) => setForm({ ...form, mcNumber: e.target.value })} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>{t("company.baseJurisdiction")}</label>
            <select style={input} value={form.iftaBaseJurisdiction} onChange={(e) => setForm({ ...form, iftaBaseJurisdiction: e.target.value })}>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>{t("company.timezone")}</label>
            <select style={input} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={saving} style={{ height: 48, borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
          {saving ? t("common.loading") : t("company.createButton")}
        </button>
      </form>
    </div>
  );
}
