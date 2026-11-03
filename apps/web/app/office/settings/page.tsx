"use client";
import { useEffect, useState } from "react";
import { backoffice, type CompanyDetail } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { useSettingsStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { LOCALE_NAMES, LOCALES } from "@tbo/i18n";

const card: React.CSSProperties = { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, boxShadow: "var(--card-shadow)", marginBottom: 16 };
const pill = (active: boolean): React.CSSProperties => ({ height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-dim)" : "var(--bg)", color: active ? "var(--accent)" : "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });

export default function SettingsPage() {
  const { t, locale, setLocale } = useT();
  const { theme, setTheme } = useSettingsStore();
  const { selected } = useCompanyStore();
  const [detail, setDetail] = useState<CompanyDetail | null>(null);

  useEffect(() => {
    if (!selected) return;
    backoffice.company(selected.company.id).then((d) => setDetail(d.company)).catch(() => setDetail(null));
  }, [selected?.company.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span style={{ color: "var(--text)" }}>{v}</span>
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", margin: "0 0 20px", color: "var(--text)" }}>{t("settings.title")}</h1>

      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("settings.language")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {LOCALES.map((l) => (
            <button key={l} style={pill(locale === l)} onClick={() => setLocale(l)} aria-pressed={locale === l}>{LOCALE_NAMES[l]}</button>
          ))}
        </div>
      </section>

      <section style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("settings.theme")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={pill(theme === "light")} onClick={() => setTheme("light")} aria-pressed={theme === "light"}>{t("settings.light")}</button>
          <button style={pill(theme === "dark")} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}>{t("settings.dark")}</button>
        </div>
      </section>

      {detail && (
        <section style={card}>
          <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("settings.company")}</h2>
          {row(t("company.legalName"), detail.legalName)}
          {row(t("company.dba"), detail.dba ?? "—")}
          {row(t("company.usdot"), detail.usdot ?? "—")}
          {row(t("company.mcNumber"), detail.mcNumber ?? "—")}
          {row(t("company.baseJurisdiction"), detail.iftaBaseJurisdiction ?? "—")}
          {row(t("company.timezone"), detail.timezone)}
          {row(t("settings.inboundEmail"), <code style={{ fontSize: 12 }}>docs+{detail.inboundEmailSlug}@…</code>)}
          {row(t("company.role"), selected?.roles.join(", "))}
        </section>
      )}
    </div>
  );
}
