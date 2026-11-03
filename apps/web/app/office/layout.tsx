"use client";
/**
 * Back-office shell. Desktop: fixed sidebar with the eight sections from the
 * brief. Phone: top bar with the company picker and a five-item bottom tab bar
 * (the rest under "More"). One primary action per screen lives in the pages.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronDown, ClipboardCheck, FileBarChart, FileSearch, Fuel, Home, Inbox, LogOut, Menu, Settings, Truck, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { type SelectedCompany, useCompanyStore } from "@/lib/company";
import { backoffice } from "@/lib/backoffice";
import { useT } from "@/lib/useT";
import { useIsClient, useIsMobile } from "@/lib/useViewport";
import { formatApiError } from "@/lib/errors";
import { Logo } from "@/components/ui/Logo";
import { Banner } from "@/components/ui/Banner";

interface NavItem {
  href: string;
  key: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { href: "/office", key: "nav.home", icon: <Home size={18} /> },
  { href: "/office/inbox", key: "nav.inbox", icon: <Inbox size={18} /> },
  { href: "/office/transactions", key: "nav.transactions", icon: <FileSearch size={18} /> },
  { href: "/office/review", key: "nav.review", icon: <ClipboardCheck size={18} /> },
  { href: "/office/ifta", key: "nav.fuelIfta", icon: <Fuel size={18} /> },
  { href: "/office/reports", key: "nav.reports", icon: <FileBarChart size={18} /> },
  { href: "/office/vehicles", key: "nav.vehicles", icon: <Truck size={18} /> },
  { href: "/office/settings", key: "nav.settings", icon: <Settings size={18} /> },
];
const MOBILE_PRIMARY = ["/office", "/office/inbox", "/office/review", "/office/ifta"];

function CompanyPicker({ selected, list, loaded, onSelect, dark }: { selected: SelectedCompany | null; list: SelectedCompany[]; loaded: boolean; onSelect: (id: string) => void; dark?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const label = selected ? selected.company.dba || selected.company.legalName : loaded ? t("company.noCompany") : t("common.loading");
  return (
    <div className="relative">
      <button
        onClick={() => list.length > 1 && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-control border px-3 py-2.5 text-left text-[13px] font-semibold ${dark ? "border-sidebar-line bg-sidebar-active text-sidebar-text" : "border-line bg-canvas text-ink"}`}
      >
        <Building2 size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {list.length > 1 && <ChevronDown size={14} className="shrink-0" />}
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-[300] overflow-hidden rounded-control border border-line bg-canvas shadow-dropdown">
          {list.map((c) => (
            <button
              key={c.company.id}
              role="option"
              aria-selected={selected?.company.id === c.company.id}
              onClick={() => {
                onSelect(c.company.id);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2.5 text-left text-[13px] text-ink hover:bg-surface ${selected?.company.id === c.company.id ? "bg-accent-dim" : ""}`}
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
  const content = (
    <>
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      {children}
    </>
  );

  if (isMobile) {
    const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
    const more = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
    return (
      <div className="min-h-screen bg-surface">
        <header className="fixed inset-x-0 top-0 z-[200] flex h-14 items-center gap-2 bg-sidebar px-3 text-sidebar-text">
          <div className="min-w-0 flex-1">
            <CompanyPicker selected={selected} list={list} loaded={loaded} onSelect={select} dark />
          </div>
          <button aria-label={t("nav.settings")} onClick={() => router.push("/office/settings")} className="flex h-9 w-9 items-center justify-center rounded-control bg-accent text-sm font-bold text-white">
            {user?.fullName?.charAt(0)}
          </button>
        </header>
        <main className="px-4 pb-24 pt-[72px]">{content}</main>
        <nav className="fixed inset-x-0 bottom-0 z-[200] flex h-16 items-center justify-around border-t border-sidebar-line bg-sidebar pb-[env(safe-area-inset-bottom)]" aria-label="Main">
          {primary.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 ${isActive(item.href) ? "text-white" : "text-sidebar-muted"}`}>
              {item.icon}
              <span className={`text-[10px] ${isActive(item.href) ? "font-bold" : "font-medium"}`}>{t(item.key)}</span>
            </Link>
          ))}
          <button onClick={() => setMoreOpen(true)} className={`flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 ${more.some((m) => isActive(m.href)) ? "text-white" : "text-sidebar-muted"}`} aria-haspopup="dialog">
            <Menu size={18} />
            <span className="text-[10px] font-medium">{t("nav.more")}</span>
          </button>
        </nav>
        {moreOpen && (
          <div role="dialog" aria-modal className="fixed inset-0 z-[300] flex items-end bg-[rgba(15,23,42,0.5)]" onClick={() => setMoreOpen(false)}>
            <div className="w-full rounded-t-2xl bg-canvas p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold text-ink">{t("nav.more")}</div>
                <button onClick={() => setMoreOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink-2">
                  <X size={16} />
                </button>
              </div>
              {more.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-12 items-center gap-3 rounded-control px-3 text-[15px] font-medium text-ink hover:bg-surface">
                  {item.icon}
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
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 flex h-screen w-60 min-w-60 flex-col bg-sidebar text-sidebar-text">
        <div className="border-b border-sidebar-line px-4 pb-4 pt-5">
          <Link href="/office" className="mb-4 block" aria-label="Sahid Freight">
            <Logo light size={26} />
          </Link>
          <CompanyPicker selected={selected} list={list} loaded={loaded} onSelect={select} dark />
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`mb-0.5 flex items-center gap-2.5 rounded-control px-3 py-2.5 text-[13px] ${isActive(item.href) ? "bg-sidebar-active font-bold text-white" : "font-medium text-sidebar-muted hover:bg-sidebar-active hover:text-white"}`}>
              {item.icon}
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-line px-2.5 pb-4 pt-2.5">
          <div className="truncate px-3 pb-2 text-xs text-sidebar-muted">{user?.fullName}</div>
          <button onClick={() => logout()} className="flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-left text-[13px] text-sidebar-muted hover:bg-sidebar-active hover:text-white">
            <LogOut size={16} />
            {t("nav.signOut")}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8">
        <div className="mx-auto max-w-content">{content}</div>
      </main>
    </div>
  );
}
