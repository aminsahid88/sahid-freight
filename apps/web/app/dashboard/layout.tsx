"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";

const IconGrid = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>);
const IconPackage = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
const IconTruck = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
const IconBookmark = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>);
const IconBell = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>);
const IconUser = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const IconLogout = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const IconUsers = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>);
const IconShield = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetch("http://localhost:8000/notifications/unread", {
      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
    }).then(r => r.json()).then(d => setUnread(d.count || 0)).catch(() => {});
  }, [user]);

  const navItems = mounted ? [
    { key: "/dashboard", label: "Overview", icon: <IconGrid /> },
    { key: "/dashboard/loads", label: user?.role === "CARGO_SENDER" ? "My Loads" : "Loads", icon: <IconPackage /> },
    ...(user?.role === "TRUCK_OWNER" ? [{ key: "/dashboard/trucks", label: "Fleet", icon: <IconTruck /> }, { key: "/dashboard/drivers", label: "Drivers", icon: <IconUsers /> }] : []),
    { key: "/dashboard/bookings", label: "Bookings", icon: <IconBookmark /> },
    { key: "/dashboard/notifications", label: "Alerts", icon: (
      <span style={{ position: "relative", display: "inline-flex" }}>
        <IconBell />
        {unread > 0 && <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#c8901e", color: "#fff", borderRadius: "99px", fontSize: "9px", fontWeight: "800", padding: "1px 4px", minWidth: "14px", textAlign: "center" }}>{unread}</span>}
      </span>
    )},
    { key: "/dashboard/profile", label: "Profile", icon: <IconUser /> },
  ] : [];

  const active = (key: string) => key === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(key);
  const navigate = (key: string) => router.push(key);

  if (!mounted) return null;

  if (isMobile) return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ position: "fixed" as const, top: 0, left: 0, right: 0, height: "56px", background: "#1a2744", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img src="/loadlink.png" alt="Sahid Freight" style={{ width: "34px", height: "34px", objectFit: "contain" }} />
          <span style={{ fontSize: "17px", fontWeight: "900", color: "#fff", letterSpacing: "-0.5px" }}>Sahid Freight</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {user && !user.isVerified && (
            <div onClick={() => router.push("/dashboard/verify")} style={{ color: "#c8901e", display: "flex" }}><IconShield /></div>
          )}
          <div onClick={() => router.push("/dashboard/profile")} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#c8901e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#fff", cursor: "pointer" }}>
            {user?.fullName?.charAt(0)}
          </div>
        </div>
      </div>
      <main style={{ paddingTop: "56px", paddingBottom: "72px", minHeight: "100vh" }}>
        <div style={{ padding: "16px" }}>{children}</div>
      </main>
      <nav style={{ position: "fixed" as const, bottom: 0, left: 0, right: 0, height: "64px", background: "#1a2744", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(240,235,224,0.1)" }}>
        {navItems.slice(0, 5).map((item) => (
          <button key={item.key} onClick={() => navigate(item.key)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: active(item.key) ? "#c8901e" : "rgba(240,235,224,0.45)", minWidth: "52px" }}>
            {item.icon}
            <span style={{ fontSize: "9px", fontWeight: active(item.key) ? "700" : "400", whiteSpace: "nowrap" }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#f5f3ef" }}>
      <aside style={{ width: "240px", minWidth: "240px", background: "#1a2744", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(240,235,224,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/loadlink.png" alt="Sahid Freight" style={{ width: "56px", height: "56px", objectFit: "contain" }} />
            <span style={{ fontSize: "19px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.5px" }}>Sahid Freight</span>
          </div>
        </div>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(240,235,224,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#c8901e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: "#fff", flexShrink: 0 }}>
              {user?.fullName?.charAt(0)}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#f0ebe0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.fullName}</div>
              <div style={{ fontSize: "11px", color: "#c8901e", fontWeight: "600", marginTop: "1px" }}>{user?.role?.replace(/_/g, " ")}</div>
            </div>
          </div>
          {user && !user.isVerified && (
            <div onClick={() => router.push("/dashboard/verify")} style={{ marginTop: "10px", background: "rgba(200,144,30,0.12)", border: "1px solid rgba(200,144,30,0.25)", borderRadius: "7px", padding: "7px 10px", display: "flex", alignItems: "center", gap: "7px", cursor: "pointer" }}>
              <span style={{ color: "#c8901e" }}><IconShield /></span>
              <span style={{ fontSize: "11px", color: "#c8901e", fontWeight: "600" }}>Verification pending</span>
            </div>
          )}
        </div>
        <nav style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", color: "rgba(240,235,224,0.2)", letterSpacing: "1.5px", padding: "4px 8px 8px", textTransform: "uppercase" }}>Navigation</div>
          {navItems.map((item) => (
            <button key={item.key} onClick={() => navigate(item.key)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "9px", border: "none", borderLeft: active(item.key) ? "3px solid #c8901e" : "3px solid transparent", background: active(item.key) ? "rgba(240,235,224,0.09)" : "transparent", color: active(item.key) ? "#f0ebe0" : "rgba(240,235,224,0.42)", fontSize: "13px", fontWeight: active(item.key) ? "600" : "400", cursor: "pointer", textAlign: "left", marginBottom: "1px", transition: "all 0.12s" }}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 10px 20px", borderTop: "1px solid rgba(240,235,224,0.08)" }}>
          <button onClick={() => { logout(); router.push("/"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "9px", border: "none", background: "transparent", color: "rgba(240,235,224,0.35)", fontSize: "13px", cursor: "pointer", textAlign: "left" }}>
            <IconLogout />Sign Out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
