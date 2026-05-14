"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdminStore } from "@/lib/admin-store";

const P = "var(--primary)";
const A = "var(--accent)";

// Icons (inline SVGs)
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const IconGrid = () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />;
const IconUsers = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>);
const IconPackage = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
const IconBookmark = () => <Icon d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />;
const IconTruck = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
const IconFile = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>);
const IconLogout = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const IconMenu = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>);
const IconX = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);

const NAV = [
  { key: "/admin", label: "Overview", icon: <IconGrid /> },
  { key: "/admin/users", label: "Users", icon: <IconUsers /> },
  { key: "/admin/loads", label: "Loads", icon: <IconPackage /> },
  { key: "/admin/bookings", label: "Bookings", icon: <IconBookmark /> },
  { key: "/admin/trucks", label: "Trucks", icon: <IconTruck /> },
  { key: "/admin/documents", label: "Documents", icon: <IconFile /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, adminLogout } = useAdminStore();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (pathname === "/admin/login") return; // don't redirect on login page
    if (!admin) { router.push("/admin/login"); return; }
    if (admin.role !== "ADMIN") { router.push("/admin/login"); return; }
  }, [mounted, admin, pathname]);

  // Login page renders without layout
  if (pathname === "/admin/login") return <>{children}</>;

  if (!mounted) return null;
  if (!admin || admin.role !== "ADMIN") return null;

  const isActive = (key: string) => key === "/admin" ? pathname === "/admin" : pathname.startsWith(key);
  const pageTitle = NAV.find(n => isActive(n.key))?.label || "Admin";

  const handleLogout = () => {
    adminLogout();
    router.push("/admin/login");
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Sahid Freight" className="w-9 h-9 object-contain" />
          <div>
            <div className="text-[15px] font-extrabold" style={{ color: "var(--sidebar-text)" }}>Sahid Freight</div>
            <div className="text-[9px] tracking-[1.5px] font-bold" style={{ color: A }}>ADMIN</div>
          </div>
        </div>
      </div>

      {/* Admin card */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white shrink-0" style={{ background: A }}>
            {admin.fullName?.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold truncate" style={{ color: "var(--sidebar-text)" }}>{admin.fullName}</div>
            <div className="text-[10px] font-semibold" style={{ color: "var(--sidebar-muted)" }}>{admin.email}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
        <div className="text-[10px] font-bold tracking-[1.5px] px-2 pb-2 uppercase" style={{ color: "var(--sidebar-muted)" }}>Navigation</div>
        {NAV.map(item => (
          <button
            key={item.key}
            onClick={() => { router.push(item.key); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 transition-all text-left"
            style={{
              background: isActive(item.key) ? "var(--sidebar-active-bg)" : "transparent",
              color: isActive(item.key) ? "var(--sidebar-text)" : "var(--sidebar-muted)",
              fontWeight: isActive(item.key) ? "600" : "400",
              borderLeft: isActive(item.key) ? `3px solid ${A}` : "3px solid transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {item.icon}{item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2.5 pb-4 pt-2 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] hover:bg-white/5 transition-all text-left"
          style={{ color: "var(--sidebar-muted)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <IconLogout />Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)", background: "var(--bg)" }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[220px] min-w-[220px] flex-col sticky top-0 h-screen" style={{ background: "var(--sidebar)" }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[260px] h-full flex flex-col" style={{ background: "var(--sidebar)" }}>
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white z-10" style={{ background: "none", border: "none", cursor: "pointer" }}>
              <IconX />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-[100] flex items-center justify-between h-[60px] px-4 lg:px-9 border-b" style={{ background: "var(--topbar-bg)", borderColor: "var(--topbar-border)" }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)" }}>
              <IconMenu />
            </button>
            <h1 className="text-[17px] font-bold" style={{ color: "var(--primary)" }}>{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold hidden sm:block" style={{ color: "var(--text-secondary)" }}>{admin.fullName}</div>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-extrabold text-white" style={{ background: P }}>
              {admin.fullName?.charAt(0)}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
