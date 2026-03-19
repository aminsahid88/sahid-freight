"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

const IconPackage = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
const IconTruck = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
const IconBell = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>);
const IconPin = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>);
const IconWeight = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 00-1.905 1.46L2.1 18.5A2 2 0 004 21h16a2 2 0 001.9-2.54L19.4 9.46A2 2 0 0017.5 8z"/></svg>);
const IconShield = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
const IconPlus = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
const IconArrow = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);

const statusStyle: any = {
  OPEN:       { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Open" },
  BOOKED:     { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", label: "Booked" },
  IN_TRANSIT: { bg: "#fff7ed", color: "#c8901e", border: "#fed7aa", label: "In Transit" },
  DELIVERED:  { bg: "#f0fdf4", color: "#15803d", border: "#86efac", label: "Delivered" },
  CANCELLED:  { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "Cancelled" },
  DRAFT:      { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb", label: "Draft" },
};
const StatusBadge = ({ status }: { status: string }) => {
  const s = statusStyle[status] || { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb", label: status };
  return <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loads, setLoads] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [loadsRes, notifsRes, unreadRes] = await Promise.all([
        user?.role === "CARGO_SENDER" ? api.get("/loads/my") : api.get("/loads"),
        api.get("/notifications"),
        api.get("/notifications/unread"),
      ]);
      setLoads(loadsRes.data.loads || []);
      setNotifications(notifsRes.data.notifications || []);
      setUnread(unreadRes.data.count || 0);
      if (user?.role === "TRUCK_OWNER") {
        const trucksRes = await api.get("/trucks/my");
        setTrucks(trucksRes.data.trucks || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" as const }}>
        <div style={{ width: "34px", height: "34px", border: "3px solid #e8e3d8", borderTop: "3px solid #1a2744", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        <p style={{ color: "#9e9890", fontSize: "13px", margin: 0 }}>Loading...</p>
      </div>
    </div>
  );

  const activeLoads = loads.filter(l => ["OPEN","BOOKED","IN_TRANSIT"].includes(l.status)).length;
  const deliveredLoads = loads.filter(l => l.status === "DELIVERED").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1a2744", letterSpacing: "-0.5px" }}>
            Welcome back, {user?.fullName?.split(" ")[0]}.
          </h1>
          <div style={{ marginTop: "3px", fontSize: "13px", color: "#9e9890" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
        {user?.role === "CARGO_SENDER" && (
          <button onClick={() => router.push("/dashboard/loads/new")} style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1a2744", color: "#f0ebe0", padding: "10px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer" }}>
            <IconPlus />Post New Load
          </button>
        )}

      </div>

      {/* Verification banner */}
      {user && !user.isVerified && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(200,144,30,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8901e", flexShrink: 0 }}><IconShield /></div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#92400e" }}>Account Verification Required</div>
              <div style={{ fontSize: "12px", color: "#b45309", marginTop: "1px" }}>Upload your documents to unlock full platform access.</div>
            </div>
          </div>
          <button onClick={() => router.push("/dashboard/verify")} style={{ background: "#c8901e", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: "6px" }}>
            Upload Docs <IconArrow />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: user?.role === "CARGO_SENDER" ? "Total Loads" : "Available Loads", value: loads.length, sub: `${activeLoads} active`, accent: "#1a2744", icon: <IconPackage /> },
          { label: user?.role === "TRUCK_OWNER" ? "My Fleet" : "Delivered", value: user?.role === "TRUCK_OWNER" ? trucks.length : deliveredLoads, sub: user?.role === "TRUCK_OWNER" ? `${trucks.filter((t:any)=>t.isAvailable).length} available` : "completed", accent: "#16a34a", icon: <IconTruck /> },
          { label: "Notifications", value: notifications.length, sub: `${unread} unread`, accent: "#2563eb", icon: <IconBell /> },
          { label: "Coverage", value: "3", sub: "ET · SO · DJ", accent: "#c8901e", icon: <IconPin /> },
        ].map((card, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #ede9e0", position: "relative" as const, overflow: "hidden" }}>
            <div style={{ position: "absolute" as const, top: 0, left: 0, width: "3px", height: "100%", background: card.accent }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${card.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: card.accent }}>{card.icon}</div>
              <span style={{ fontSize: "10px", color: "#b0a898", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{card.sub}</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#1a2744", letterSpacing: "-1px", lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "4px" }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Recent loads table */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #ede9e0", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #f0ede6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a2744" }}>Recent Loads</div>
            <div style={{ fontSize: "12px", color: "#9e9890", marginTop: "1px" }}>Latest activity</div>
          </div>
          <button onClick={() => router.push("/dashboard/loads")} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", color: "#c8901e", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
            View all <IconArrow />
          </button>
        </div>
        {loads.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 90px 90px 100px", padding: "9px 22px", background: "#faf8f4", borderBottom: "1px solid #f0ede6" }}>
            {["Load", "Route", "Weight", "Price", "Status"].map(h => (
              <span key={h} style={{ fontSize: "10px", fontWeight: "700", color: "#b0a898", textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>{h}</span>
            ))}
          </div>
        )}
        {loads.slice(0, 6).length === 0 ? (
          <div style={{ padding: "48px 22px", textAlign: "center" as const }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f5f3ef", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: "#c8c0b0" }}><IconPackage /></div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a2744", marginBottom: "5px" }}>No loads yet</div>
            <div style={{ fontSize: "12px", color: "#9e9890" }}>{user?.role === "CARGO_SENDER" ? "Post your first load to get started" : "Available loads will appear here"}</div>
          </div>
        ) : loads.slice(0, 6).map((load: any, i: number) => (
          <div key={load.id} onClick={() => router.push(`/dashboard/loads/${load.id}`)}
            style={{ display: "grid", gridTemplateColumns: "1fr 200px 90px 90px 100px", padding: "13px 22px", borderBottom: i < 5 ? "1px solid #faf8f4" : "none", alignItems: "center", cursor: "pointer" }}
            onMouseOver={e => e.currentTarget.style.background = "#faf8f4"}
            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{load.title}</div>
              <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "1px" }}>{load.truckTypeNeeded?.replace(/_/g, " ")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#4b5563" }}>
              <IconPin /><span>{load.pickupCity}</span><span style={{ color: "#c8901e", fontWeight: "700", margin: "0 2px" }}>→</span><span>{load.deliveryCity}</span>
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}><IconWeight />{load.weightTons}t</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a2744" }}>${load.offeredPrice}</div>
            <StatusBadge status={load.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
