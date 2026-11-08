"use client";
/**
 * Back-office shell. Desktop: light sidebar with the sections grouped
 * (Work / Compliance / Setup), company switcher, and the signed-in user.
 * Phone: top bar with the company picker and a five-item bottom tab bar
 * (the rest under "More"). One primary action per screen lives in the pages.
 * Elements carry data-tour ids for the first-run tour.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronDown, ClipboardCheck, FileBarChart, FileSearch, Fuel, Home, Inbox, LogOut, Menu, Settings, Truck, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { primaryRole, type SelectedCompany, useCompanyStore } from "@/lib/company";
import { backoffice } from "@/lib/backoffice";
import { useT } from "@/lib/useT";
import { useIsClient, useIsMobile } from "@/lib/useViewport";
import { formatApiError } from "@/lib/errors";
import { Logo } from "@/components/ui/Logo";
import { Banner } from "@/components/ui/Banner";
import { Tour } from "@/components/office/Tour";
import { PageTransition } from "@/components/ui/Motion";

interface NavItem {
  href: string;
  key: string;
  icon: React.ReactNode;
  tour: string;
}

const GROUPS: Array<{ key: string; items: NavItem[] }> = [
  {
    key: "nav.groupWork",
    items: [
      { href: "/office", key: "nav.home", icon: <Home size={17} />, tour: "nav-home" },
      { href: "/office/inbox", key: "nav.inbox", icon: <Inbox size={17} />, tour: "nav-inbox" },
      { href: "/office/transactions", key: "nav.transactions", icon: <FileSearch size={17} />, tour: "nav-transactions" },
      { href: "/office/review", key: "nav.review", icon: <ClipboardCheck size={17} />, tour: "nav-review" },
    ],
  },
  {
    key: "nav.groupCompliance",
    items: [
      { href: "/office/ifta", key: "nav.fuelIfta", icon: <Fuel size={17} />, tour: "nav-ifta" },
      { href: "/office/reports", key: "nav.reports", icon: <FileBarChart size={17} />, tour: "nav-reports" },
    ],
  },
  {
    key: "nav.groupSetup",
    items: [
      { href: "/office/vehicles", key: "nav.vehicles", icon: <Truck size={17} />, tour: "nav-vehicles" },
      { href: "/office/settings", key: "nav.settings", icon: <Settings size={17} />, tour: "nav-settings" },
    ],
  },
];
const NAV: NavItem[] = GROUPS.flatMap((g) => g.items);
const MOBILE_PRIMARY = ["/office", "/office/inbox", "/office/review", "/office/ifta"];

function initials(name: string | undefined): string {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function CompanyPicker({ selected, list, loaded, onSelect }: { selected: SelectedCompany | null; list: SelectedCompany[]; loaded: boolean; onSelect: (id: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const label = selected ? selected.company.dba || selected.company.legalName : loaded ? t("company.noCompany") : t("common.loading");
  return (
    <div className="relative" data-tour="company">
      <button
        onClick={() => list.length > 1 && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-control bg-surface2 px-3 py-2.5 text-left text-[13px] font-semibold text-ink transition-colors hover:bg-line"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-2 shadow-card">
          <Building2 size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {list.length > 1 && <ChevronDown size={14} className="shrink-0 text-ink-3" />}
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-[300] overflow-hidden rounded-control bg-canvas p-1 shadow-dropdown">
          {list.map((c) => (
            <button
              key={c.company.id}
              role="option"
              aria-selected={selected?.company.id === c.company.id}
              onClick={() => {
                onSelect(c.company.id);
                setOpen(false);
              }}
              className={`block w-full rounded-[8px] px-3 py-2 text-left text-[13px] text-ink hover:bg-surface ${selected?.company.id === c.company.id ? "bg-accent-dim font-semibold text-accent" : ""}`}
            >
              {c.company.dba || c.company.legalName}
              {c.company.isDemo && <span className="ml-2 text-[11px] text-ink-3">{t("app.demo")}</span>}
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
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!isClient) return;
    if (!user) {
      router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
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

  const isActive = (href: string) => (href === "/office" ? pathname === "/office" : pathname.startsWith(href));
  const role = selected ? primaryRole(selected.roles) : null;

  // No company yet: a focused setup screen instead of an empty back office.
  if (loaded && list.length === 0) {
    return (
      <div className="min-h-screen">
        <header className="flex h-16 items-center justify-between px-6">
          <Logo size={28} glow />
          <button onClick={() => logout()} className="inline-flex h-9 items-center gap-2 rounded-control px-3 text-[13px] font-medium text-ink-2 hover:bg-surface2 hover:text-ink">
            <LogOut size={15} />
            {t("nav.signOut")}
          </button>
        </header>
        <main className="mx-auto max-w-xl px-5 pb-16 pt-6">
          {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          {children}
        </main>
      </div>
    );
  }
  const content = (
    <>
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      {children}
      {selected && (
        <Suspense fallback={null}>
          <Tour />
        </Suspense>
      )}
    </>
  );

  if (isMobile) {
    const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
    const more = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
    return (
      <div className="min-h-screen">
        <header className="glass fixed inset-x-0 top-0 z-[200] flex h-14 items-center gap-2 border-b border-line px-3" style={{ background: "var(--sidebar)" }}>
          <div className="min-w-0 flex-1">
            <CompanyPicker selected={selected} list={list} loaded={loaded} onSelect={select} />
          </div>
          <button aria-label={t("nav.settings")} onClick={() => router.push("/office/settings")} className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[12px] font-bold text-white">
            {initials(user?.fullName)}
          </button>
        </header>
        <main className="px-4 pb-24 pt-[72px]">{content}</main>
        <nav className="glass fixed inset-x-0 bottom-0 z-[200] flex h-16 items-center justify-around border-t border-line pb-[env(safe-area-inset-bottom)]" style={{ background: "var(--sidebar)" }} aria-label="Main">
          {primary.map((item) => (
            <Link key={item.href} href={item.href} data-tour={item.tour} aria-current={isActive(item.href) ? "page" : undefined} className={`flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 ${isActive(item.href) ? "text-accent" : "text-ink-3"}`}>
              {item.icon}
              <span className={`text-[10px] ${isActive(item.href) ? "font-bold" : "font-medium"}`}>{t(item.key)}</span>
            </Link>
          ))}
          <button onClick={() => setMoreOpen(true)} className={`flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 ${more.some((m) => isActive(m.href)) ? "text-accent" : "text-ink-3"}`} aria-haspopup="dialog">
            <Menu size={18} />
            <span className="text-[10px] font-medium">{t("nav.more")}</span>
          </button>
        </nav>
        {moreOpen && (
          <div role="dialog" aria-modal className="fixed inset-0 z-[300] flex items-end bg-[rgba(12,18,34,0.45)] backdrop-blur-[2px]" onClick={() => setMoreOpen(false)}>
            <div className="w-full rounded-t-card bg-canvas-solid p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-panel" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">{t("nav.more")}</div>
                <button onClick={() => setMoreOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-control text-ink-2 hover:bg-surface2">
                  <X size={16} />
                </button>
              </div>
              {more.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-12 items-center gap-3 rounded-control px-3 text-[15px] font-medium text-ink hover:bg-surface">
                  <span className="text-ink-3">{item.icon}</span>
                  {t(item.key)}
                </Link>
              ))}
              <button onClick={() => logout()} className="flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-[15px] font-medium text-ink-2 hover:bg-surface">
                <LogOut size={18} />
                {t("nav.signOut")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="glass sticky top-0 flex h-screen w-64 min-w-64 flex-col border-r border-sidebar-line text-sidebar-text" style={{ background: "var(--sidebar)" }}>
        <div className="px-4 pb-3 pt-5">
          <Link href="/office" className="mb-5 block px-1" aria-label="Sahid Freight">
            <Logo size={28} glow />
          </Link>
          <CompanyPicker selected={selected} list={list} loaded={loaded} onSelect={select} />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-1" aria-label="Main">
          {GROUPS.map((g) => (
            <div key={g.key} className="mb-4">
              <div className="mb-1 px-3 label-caps">{t(g.key)}</div>
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour={item.tour}
                    aria-current={active ? "page" : undefined}
                    className={`relative mb-0.5 flex h-9 items-center gap-2.5 rounded-control px-3 text-[13px] transition-colors ${active ? "bg-sidebar-active font-semibold text-ink" : "font-medium text-sidebar-muted hover:bg-surface2 hover:text-ink"}`}
                  >
                    {active && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[linear-gradient(180deg,var(--accent),var(--accent-2))]" />}
                    <span className={active ? "text-accent" : "text-ink-3"}>{item.icon}</span>
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-line p-3">
          <div className="flex items-center gap-3 rounded-control px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[12px] font-bold text-white shadow-button">{initials(user?.fullName)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">{user?.fullName}</span>
              {role && <span className="block truncate text-[11px] text-ink-3">{t(`role.${role}`)}</span>}
            </span>
            <button onClick={() => logout()} aria-label={t("nav.signOut")} title={t("nav.signOut")} className="flex h-8 w-8 items-center justify-center rounded-control text-ink-3 hover:bg-surface2 hover:text-ink">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-9">
        <div className="mx-auto max-w-content">
          <PageTransition>{content}</PageTransition>
        </div>
      </main>
    </div>
  );
}
