"use client";
/**
 * Back-office shell: sidebar on desktop, bottom tabs on mobile. One primary
 * action per screen, Inter, Lucide icons, CSS-variable theme tokens.
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Home, Inbox, LogOut, Settings, Truck, ChevronDown, FileSearch, Fuel, FileBarChart, ClipboardCheck } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { type SelectedCompany, useCompanyStore } from "@/lib/company";
import { backoffice } from "@/lib/backoffice";
import { useT } from "@/lib/useT";
import { useIsClient, useIsMobile } from "@/lib/useViewport";
import { formatApiError } from "@/lib/errors";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function CompanyPicker({ selected, list, loaded, onSelect }: { selected: SelectedCompany | null; list: SelectedCompany[]; loaded: boolean; onSelect: (id: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--sidebar-border)", background: "var(--sidebar-active-bg)", color: "var(--sidebar-text)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
      >
        <Building2 size={16} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {selected ? selected.company.dba || selected.company.legalName : loaded ? t("company.noCompany") : t("common.loading")}
        </span>
        {list.length > 1 && <ChevronDown size={14} />}
      </button>
      {open && list.length > 1 && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--dropdown-shadow)", zIndex: 300, overflow: "hidden" }}>
          {list.map((c) => (
            <button
              key={c.company.id}
              role="option"
              aria-selected={selected?.company.id === c.company.id}
              onClick={() => {
                onSelect(c.company.id);
                setOpen(false);
              }}
              style={{ width: "100%", textAlign: "left", padding: "10px 12px", border: "none", background: selected?.company.id === c.company.id ? "var(--accent-dim)" : "transparent", color: "var(--text)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              {c.company.dba || c.company.legalName}
              {c.company.isDemo && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>{t("app.demo")}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { t } = useT();
  const { selected, list, loaded, setList, select } = useCompanyStore();
  const isClient = useIsClient();
  const isMobile = useIsMobile();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isClient) return;
    if (!user) {
      router.replace("/auth/login?next=/office");
      return;
    }
    backoffice
      .myCompanies()
      .then((cs) => {
        setList(cs);
        if (cs.length === 0 && pathname !== "/office/new-company") router.replace("/office/new-company");
      })
      .catch((e) => setError(formatApiError(e, t("common.error"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, user?.id]);

  if (!isClient) return null;

  const nav: NavItem[] = [
    { href: "/office", label: t("nav.home"), icon: <Home size={18} /> },
    { href: "/office/inbox", label: t("nav.inbox"), icon: <Inbox size={18} /> },
    { href: "/office/vehicles", label: t("nav.vehicles"), icon: <Truck size={18} /> },
    { href: "/office/settings", label: t("nav.settings"), icon: <Settings size={18} /> },
  ];
  const later: NavItem[] = [
    { href: "#", label: t("nav.transactions"), icon: <FileSearch size={18} /> },
    { href: "#", label: t("nav.review"), icon: <ClipboardCheck size={18} /> },
    { href: "#", label: t("nav.fuelIfta"), icon: <Fuel size={18} /> },
    { href: "#", label: t("nav.reports"), icon: <FileBarChart size={18} /> },
  ];
  const isActive = (href: string) => (href === "/office" ? pathname === "/office" : pathname.startsWith(href));
  const picker = <CompanyPicker selected={selected} list={list} loaded={loaded} onSelect={select} />;

  const content = (
    <>
      {error && (
        <div role="alert" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", fontSize: 13 }}>
          {error}
        </div>
      )}
      {children}
    </>
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--surface)", fontFamily: "var(--font)" }}>
        <header style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: "var(--sidebar)", color: "var(--sidebar-text)", zIndex: 200, display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>{picker}</div>
          <button aria-label={t("nav.settings")} onClick={() => router.push("/office/settings")} style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
            {user?.fullName?.charAt(0)}
          </button>
        </header>
        <main style={{ padding: "72px 16px 88px" }}>{content}</main>
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "var(--sidebar)", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid var(--sidebar-border)", zIndex: 200, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {nav.map((item) => (
            <button key={item.href} onClick={() => router.push(item.href)} aria-current={isActive(item.href) ? "page" : undefined} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", minWidth: 56, minHeight: 48, padding: 6, color: isActive(item.href) ? "#fff" : "var(--sidebar-muted)", cursor: "pointer", fontFamily: "inherit" }}>
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: isActive(item.href) ? 700 : 500 }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface)", fontFamily: "var(--font)" }}>
      <aside style={{ width: 240, minWidth: 240, background: "var(--sidebar)", color: "var(--sidebar-text)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid var(--sidebar-border)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px", marginBottom: 12 }}>{t("app.name")}</div>
          {picker}
        </div>
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {nav.map((item) => (
            <button key={item.href} onClick={() => router.push(item.href)} aria-current={isActive(item.href) ? "page" : undefined} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none", background: isActive(item.href) ? "var(--sidebar-active-bg)" : "transparent", color: isActive(item.href) ? "#fff" : "var(--sidebar-muted)", fontSize: 13, fontWeight: isActive(item.href) ? 700 : 500, cursor: "pointer", textAlign: "left", marginBottom: 2, fontFamily: "inherit" }}>
              {item.icon}
              {item.label}
            </button>
          ))}
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sidebar-muted)", letterSpacing: "1.2px", padding: "16px 12px 6px", textTransform: "uppercase" }}>{t("nav.comingSoon")}</div>
          {later.map((item) => (
            <div key={item.label} aria-disabled style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", color: "var(--sidebar-muted)", fontSize: 13, opacity: 0.6 }}>
              {item.icon}
              {item.label}
            </div>
          ))}
        </nav>
        <div style={{ padding: "10px 10px 16px", borderTop: "1px solid var(--sidebar-border)" }}>
          <div style={{ padding: "6px 12px 10px", fontSize: 12, color: "var(--sidebar-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.fullName}</div>
          <button onClick={() => logout()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "none", background: "transparent", color: "var(--sidebar-muted)", fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
            <LogOut size={16} />
            {t("nav.signOut")}
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "32px 40px", maxWidth: 1100 }}>{content}</main>
    </div>
  );
}
