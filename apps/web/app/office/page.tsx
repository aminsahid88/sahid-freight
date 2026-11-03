"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, Inbox, Truck } from "lucide-react";
import { iftaDueDate, quarterOf } from "@tbo/core/period";
import { backoffice, type CompanyDetail } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { useAuthStore } from "@/lib/store";
import { useT } from "@/lib/useT";

function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}

export default function OfficeHome() {
  const router = useRouter();
  const { t, locale } = useT();
  const { user } = useAuthStore();
  const { selected } = useCompanyStore();
  const [detail, setDetail] = useState<CompanyDetail | null>(null);

  useEffect(() => {
    if (!selected) return;
    backoffice.company(selected.company.id).then((d) => setDetail(d.company)).catch(() => setDetail(null));
  }, [selected?.company.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = quarterOf(new Date());
  const due = iftaDueDate(q.year, q.quarter);
  const dueLabel = due.toLocaleDateString(locale === "so" ? "so-SO" : "en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  const card: React.CSSProperties = { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, boxShadow: "var(--card-shadow)" };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", margin: "0 0 4px", color: "var(--text)" }}>{t("home.welcome", { name: user?.fullName?.split(" ")[0] ?? "" })}</h1>
      <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: 14 }}>{selected?.company.legalName}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
            <CalendarClock size={16} /> {t("home.nextIftaDeadline")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", margin: "10px 0 2px", letterSpacing: "-0.5px" }}>{t("home.daysLeft", { days: daysUntil(due) })}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("home.quarter", { label: q.label })} · {dueLabel}</div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
            <Inbox size={16} /> {t("nav.inbox")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", margin: "10px 0 2px", letterSpacing: "-0.5px" }}>{detail?._count.documents ?? "–"}</div>
          <button onClick={() => router.push("/office/inbox")} style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--accent)", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            {t("home.goInbox")} <ArrowRight size={14} />
          </button>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
            <Truck size={16} /> {t("nav.vehicles")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", margin: "10px 0 2px", letterSpacing: "-0.5px" }}>
            {detail ? `${detail._count.vehicles} / ${detail._count.drivers}` : "–"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("home.setupHint")}</div>
        </div>
      </div>
    </div>
  );
}
