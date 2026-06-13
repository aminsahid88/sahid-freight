"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore, useGateStore, useSettingsStore } from "@/lib/store";
import { tr } from "@/lib/translations";

// Colors pulled from CSS variables at render time via inline styles
// Use var(--primary), var(--accent), etc. in styles
const P = "var(--primary)";
const A = "var(--accent)";

const IconGrid     = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>);
const IconPackage  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
const IconBookmark = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>);
const IconBell     = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>);
const IconUser     = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const IconTruck    = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
const IconUsers    = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>);
const IconLogout   = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const IconShield   = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout }    = useAuthStore();
  const { showGate, closeGate } = useGateStore();
  const { language }        = useSettingsStore();
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [notifs, setNotifs]   = useState<any[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchUnread = () => {
    if (!user) return;
    const token = localStorage.getItem("accessToken");
    const base = process.env.NEXT_PUBLIC_API_URL || "https://sahid-freight-production.up.railway.app";
    fetch(`${base}/notifications/unread`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setUnread(d.count || 0)).catch(() => {});
  };

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role === "DRIVER") { router.push("/driver"); return; }
    fetchUnread();
    const id = setInterval(fetchUnread, 15000);
    return () => clearInterval(id);
  }, [user]);

  // Close bell dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowBell(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openBell = async () => {
    if (showBell) { setShowBell(false); return; }
    const token = localStorage.getItem("accessToken");
    const base = process.env.NEXT_PUBLIC_API_URL || "https://sahid-freight-production.up.railway.app";
    try {
      const res = await fetch(`${base}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setNotifs((d.notifications || []).slice(0, 8));
      // Mark all read
      await fetch(`${base}/notifications/read-all`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      setUnread(0);
    } catch {}
    setShowBell(true);
  };

  // Sidebar nav — role-specific items
  const navItems = mounted ? [
    { key: "/dashboard",           label: tr("overview", language),   icon: <IconGrid /> },
    { key: "/dashboard/loads",     label: user?.role === "CARGO_SENDER" ? tr("my_loads", language) : tr("loads", language), icon: <IconPackage /> },
    ...(user?.role === "TRUCK_OWNER" ? [
      { key: "/dashboard/trucks",  label: "My Trucks",  icon: <IconTruck /> },
      { key: "/dashboard/drivers", label: "Drivers",    icon: <IconUsers /> },
    ] : []),
    { key: "/dashboard/bookings",  label: tr("bookings", language),   icon: <IconBookmark /> },
    { key: "/dashboard/profile",   label: tr("profile", language),    icon: <IconUser /> },
  ] : [];

  const active   = (key: string) => key === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(key);
  const navigate = (key: string) => router.push(key);

  if (!mounted) return null;

  const GateModal = () => {
    if (!showGate) return null;
    const isPending = user?.status === "PENDING_VERIFICATION";
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ background: "#fff", borderRadius: "20px", padding: "36px 32px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
          <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: isPending ? "#FFFBEB" : "#E8F0FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            {isPending
              ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
              : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3D7BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            }
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: "800", color: P, margin: "0 0 10px" }}>
            {isPending ? "Verification Required" : "Documents Under Review"}
          </h3>
          <p style={{ fontSize: "14px", color: "#6B6B6B", lineHeight: "1.6", margin: "0 0 24px" }}>
            {isPending
              ? "Upload your verification documents before accessing this feature."
              : "Your documents are under review. You'll be notified within 24 hours once approved."}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => closeGate()} style={{ flex: 1, height: "44px", background: "#FAFAF8", border: "1px solid #E8E4DC", borderRadius: "10px", fontSize: "14px", fontWeight: "600", color: "#6B6B6B", cursor: "pointer" }}>Close</button>
            {isPending && (
              <button onClick={() => { closeGate(); router.push("/dashboard/verify"); }} style={{ flex: 1, height: "44px", background: P, border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", color: "#fff", cursor: "pointer" }}>Upload Docs</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const BellDropdown = () => (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "320px", background: "#fff", borderRadius: "14px", border: "1px solid #E8E4DC", boxShadow: "0 16px 48px rgba(0,0,0,0.14)", zIndex: 500, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0EDE8", fontSize: "13px", fontWeight: "700", color: P }}>Notifications</div>
      {notifs.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", fontSize: "13px", color: "#6B6B6B" }}>No notifications yet</div>
      ) : notifs.map((n: any) => (
        <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid #FAFAF8", background: n.isRead ? "#fff" : "rgba(232,160,32,0.04)" }}>
          <div style={{ fontSize: "13px", fontWeight: n.isRead ? "400" : "600", color: P, marginBottom: "3px" }}>{n.title}</div>
          <div style={{ fontSize: "12px", color: "#6B6B6B", lineHeight: "1.4", marginBottom: "4px" }}>{n.body}</div>
          <div style={{ fontSize: "11px", color: "#9CA3AF" }}>{timeAgo(n.createdAt)}</div>
        </div>
      ))}
      <div style={{ padding: "10px 16px", borderTop: "1px solid #F0EDE8" }}>
        <button onClick={() => { setShowBell(false); router.push("/dashboard/notifications"); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: A, fontWeight: "600", cursor: "pointer", textAlign: "center" as const }}>
          View all notifications
        </button>
      </div>
    </div>
  );

  /* ── MOBILE ── */
  if (isMobile) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)" }}>
      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "56px", background: P, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
          <span style={{ fontSize: "17px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>Sahid Freight</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {user && !user.isVerified && user.status === "PENDING_VERIFICATION" && (
            <div onClick={() => router.push("/dashboard/verify")} style={{ color: A, display: "flex", cursor: "pointer" }}><IconShield /></div>
          )}
          {/* Bell — mobile */}
          <div ref={bellRef} style={{ position: "relative" }}>
            <div onClick={openBell} style={{ cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <IconBell />
              {unread > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#DC2626", color: "#fff", borderRadius: "99px", fontSize: "9px", fontWeight: "800", padding: "1px 4px", minWidth: "14px", textAlign: "center" }}>{unread}</span>}
            </div>
            {showBell && <BellDropdown />}
          </div>
          <div onClick={() => router.push("/dashboard/profile")} style={{ width: "32px", height: "32px", borderRadius: "8px", background: A, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#fff", cursor: "pointer" }}>
            {user?.fullName?.charAt(0)}
          </div>
        </div>
      </div>
      <GateModal />
      <main style={{ paddingTop: "56px", paddingBottom: "72px", minHeight: "100vh" }}>
        <div style={{ padding: "16px" }}>{children}</div>
      </main>
      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "64px", background: P, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {navItems.map((item) => (
          <button key={item.key} onClick={() => navigate(item.key)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: active(item.key) ? A : "rgba(255,255,255,0.4)", minWidth: "48px" }}>
            {item.icon}
            <span style={{ fontSize: "9px", fontWeight: active(item.key) ? "700" : "400", whiteSpace: "nowrap" }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );

  /* ── DESKTOP ── */
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)", background: "#FAFAF8" }}>
      {/* Sidebar */}
      <aside style={{ width: "220px", minWidth: "220px", background: P, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo.svg" alt="Sahid Freight" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
            <span style={{ fontSize: "17px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>Sahid Freight</span>
          </div>
        </div>
        {/* User card */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: A, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "#fff", flexShrink: 0 }}>
              {user?.fullName?.charAt(0)}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.fullName}</div>
              <div style={{ fontSize: "11px", color: A, fontWeight: "600", marginTop: "1px" }}>{user?.role?.replace(/_/g, " ")}</div>
            </div>
          </div>
          {user && !user.isVerified && user.status === "PENDING_VERIFICATION" && (
            <div onClick={() => router.push("/dashboard/verify")} style={{ marginTop: "10px", background: "rgba(232,160,32,0.12)", border: "1px solid rgba(232,160,32,0.25)", borderRadius: "8px", padding: "7px 10px", display: "flex", alignItems: "center", gap: "7px", cursor: "pointer" }}>
              <span style={{ color: A }}><IconShield /></span>
              <span style={{ fontSize: "11px", color: A, fontWeight: "600" }}>{tr("verify_account", language)}</span>
            </div>
          )}
          {user && !user.isVerified && user.status === "DOCUMENTS_SUBMITTED" && (
            <div style={{ marginTop: "10px", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "8px", padding: "7px 10px", display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ color: "#60A5FA" }}><IconShield /></span>
              <span style={{ fontSize: "11px", color: "#60A5FA", fontWeight: "600" }}>{tr("docs_under_review", language)}</span>
            </div>
          )}
        </div>
        {/* Nav links — max 4 items */}
        <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.2)", letterSpacing: "1.5px", padding: "6px 8px 8px", textTransform: "uppercase" }}>Navigation</div>
          {navItems.map((item) => (
            <button key={item.key} onClick={() => navigate(item.key)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "9px", border: "none", borderLeft: active(item.key) ? `3px solid ${A}` : "3px solid transparent", background: active(item.key) ? "rgba(255,255,255,0.08)" : "transparent", color: active(item.key) ? "#fff" : "rgba(255,255,255,0.42)", fontSize: "13px", fontWeight: active(item.key) ? "600" : "400", cursor: "pointer", textAlign: "left", marginBottom: "1px", transition: "all 0.12s" }}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        {/* Sign out */}
        <div style={{ padding: "10px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => { logout(); router.push("/"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 10px", borderRadius: "9px", border: "none", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "13px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>
            <IconLogout />{tr("sign_out", language)}
          </button>
        </div>
      </aside>

      <GateModal />

      {/* Main area with topbar */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#FAFAF8", borderBottom: "1px solid #E8E4DC", padding: "0 36px", height: "60px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
          {/* Notification bell */}
          <div ref={bellRef} style={{ position: "relative" }}>
            <button onClick={openBell}
              style={{ position: "relative", background: "#fff", border: "1px solid #E8E4DC", borderRadius: "10px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B6B6B" }}>
              <IconBell />
              {unread > 0 && (
                <span style={{ position: "absolute", top: "-4px", right: "-4px", background: "#DC2626", color: "#fff", borderRadius: "99px", fontSize: "9px", fontWeight: "800", padding: "1px 4px", minWidth: "16px", textAlign: "center", lineHeight: "14px" }}>
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {showBell && <BellDropdown />}
          </div>
          {/* Avatar */}
          <div onClick={() => router.push("/dashboard/profile")} style={{ width: "40px", height: "40px", borderRadius: "10px", background: P, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "#fff", cursor: "pointer", flexShrink: 0 }}>
            {user?.fullName?.charAt(0)}
          </div>
        </header>
        <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
