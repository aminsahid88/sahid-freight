"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

const P = "var(--primary)";
const A = "var(--accent)";

const statusStyle: any = {
  OPEN:       { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0", label: "Open" },
  BOOKED:     { bg: "#E8F0FF", color: "#3D7BFF", border: "#BBD0FF", label: "Booked" },
  IN_TRANSIT: { bg: "#FFF7ED", color: "#C2791A", border: "#FED7AA", label: "In Transit" },
  DELIVERED:  { bg: "#F0FDF4", color: "#15803D", border: "#86EFAC", label: "Delivered" },
  CANCELLED:  { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Cancelled" },
  DRAFT:      { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Draft" },
};
const StatusBadge = ({ status }: { status: string }) => {
  const s = statusStyle[status] || { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: status };
  return <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loads, setLoads] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [completedTrips, setCompletedTrips] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);
  const [returnLoads, setReturnLoads] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
    const interval = setInterval(fetchData, 15000);
    if (user.isVerified && user.status === "ACTIVE") {
      const key = "verified_banner_shown_" + user.id;
      if (!localStorage.getItem(key)) {
        setShowVerifiedBanner(true);
        localStorage.setItem(key, "1");
      }
    }
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    try {
      const loadsRes = await (user?.role === "CARGO_SENDER" ? api.get("/loads/my") : api.get("/loads"));
      setLoads(loadsRes.data.loads || []);
      if (user?.role === "TRUCK_OWNER") {
        const trucksRes = await api.get("/trucks/my");
        const myTrucks = trucksRes.data.trucks || [];
        setTrucks(myTrucks);
        const bRes = await api.get("/bookings/my").catch(() => ({ data: { bookings: [] } }));
        setCompletedTrips((bRes.data.bookings || []).filter((b: any) => b.status === "COMPLETED").length);
        // Return load matching — find loads near where trucks currently are
        if (myTrucks.length > 0) {
          const city = myTrucks[0].currentCity;
          try {
            const sugRes = await api.get(`/loads/suggested-trucks?pickupCity=${encodeURIComponent(city)}`);
            // sugRes returns trucks near that city — we actually want loads near the truck's city
            // Use the regular loads endpoint filtered by pickupCity
            const returnRes = await api.get(`/loads?pickupCity=${encodeURIComponent(city)}`);
            setReturnLoads((returnRes.data.loads || []).slice(0, 3));
          } catch { /* ignore */ }
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div>
      <style>{`@keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.sk{background:linear-gradient(90deg,#EDEBE6 25%,#E4E0D8 50%,#EDEBE6 75%);background-size:2000px 100%;animation:shimmer 1.5s infinite;border-radius:10px;}`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div className="sk" style={{ height: "28px", width: "180px" }} />
        <div className="sk" style={{ height: "40px", width: "120px", borderRadius: "10px" }} />
      </div>
      <div className="sk" style={{ height: "64px", borderRadius: "14px", marginBottom: "20px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "12px", marginBottom: "24px" }}>
        {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: "96px", borderRadius: "14px" }} />)}
      </div>
      <div className="sk" style={{ height: "220px", borderRadius: "14px" }} />
    </div>
  );

  const activeLoads    = loads.filter(l => ["OPEN","BOOKED"].includes(l.status)).length;
  const inTransitLoads = loads.filter(l => l.status === "IN_TRANSIT").length;
  const deliveredLoads = loads.filter(l => l.status === "DELIVERED").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>
            Welcome back, {user?.fullName?.split(" ")[0]}.
          </h1>
          <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--text-secondary)" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
        {user?.role === "CARGO_SENDER" && (
          <button onClick={() => router.push("/dashboard/loads/new")} style={{ display: "flex", alignItems: "center", gap: "7px", background: P, color: "#fff", padding: "11px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer", minHeight: "44px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Post Load
          </button>
        )}
      </div>

      {/* Verification banners */}
      {user && !user.isVerified && user.status === "PENDING_VERIFICATION" && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#92400E" }}>Verification Required</div>
              <div style={{ fontSize: "12px", color: "#B45309", marginTop: "2px" }}>Upload your documents to unlock full platform access.</div>
            </div>
          </div>
          <button onClick={() => router.push("/dashboard/verify")} style={{ background: A, color: "#fff", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap", minHeight: "40px" }}>
            Upload Docs →
          </button>
        </div>
      )}
      {user && !user.isVerified && user.status === "DOCUMENTS_SUBMITTED" && (
        <div style={{ background: "#E8F0FF", border: "1px solid #BBD0FF", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(37,99,235,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D7BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#1E40AF" }}>Documents Under Review</div>
            <div style={{ fontSize: "12px", color: "#3D7BFF", marginTop: "2px" }}>Our team is reviewing your submission. You'll be notified within 24 hours.</div>
          </div>
        </div>
      )}
      {showVerifiedBanner && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(22,163,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#15803D" }}>Account Verified</div>
              <div style={{ fontSize: "12px", color: "#16A34A", marginTop: "2px" }}>You now have full access to the platform.</div>
            </div>
          </div>
          <button onClick={() => setShowVerifiedBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#16A34A", fontSize: "20px", lineHeight: 1, padding: "4px 8px" }}>×</button>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {(user?.role === "CARGO_SENDER" ? [
          { label: "Total Loads", value: loads.length, sub: "all time", color: P, emoji: "📦", href: "/dashboard/loads" },
          { label: "Active", value: activeLoads, sub: "open & booked", color: "#3D7BFF", emoji: "🔵", href: "/dashboard/loads" },
          { label: "In Transit", value: inTransitLoads, sub: "on the move", color: "#C2791A", emoji: "🚛", href: "/dashboard/bookings" },
          { label: "Delivered", value: deliveredLoads, sub: "completed", color: "#16A34A", emoji: "✅", href: "/dashboard/bookings" },
        ] : [
          { label: "Available Loads", value: loads.length, sub: "open market", color: P, emoji: "📦", href: "/dashboard/loads" },
          { label: "My Fleet", value: trucks.length, sub: `${trucks.filter((t:any)=>t.isAvailable).length} available`, color: "#16A34A", emoji: "🚛", href: "/dashboard/trucks" },
          { label: "Active Bookings", value: trucks.filter((t:any)=>!t.isAvailable).length, sub: "on trips", color: "#C2791A", emoji: "📍", href: "/dashboard/bookings" },
          { label: "Completed Trips", value: completedTrips, sub: "all time", color: A, emoji: "✅", href: "/dashboard/bookings" },
        ]).map((card, i) => (
          <div key={i} onClick={() => router.push(card.href)}
            style={{ background: "var(--surface)", borderRadius: "14px", padding: "18px", border: "1px solid var(--border)", position: "relative", overflow: "hidden", cursor: "pointer", transition: "transform 0.12s, box-shadow 0.12s" }}
            onMouseOver={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
            onMouseOut={e => { e.currentTarget.style.transform = "none"; }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100%", background: card.color, borderRadius: "4px 0 0 4px" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${card.color}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>{card.emoji}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: P, letterSpacing: "-1px", lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{card.label}</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent loads */}
      <div style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: P }}>Recent Loads</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Latest activity</div>
          </div>
          <button onClick={() => router.push("/dashboard/loads")} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", color: A, fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
            View all
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>


         </button>
        </div>
        {/* Pending bids alert — cargo sender only */}
        {user?.role === "CARGO_SENDER" && loads.some((l: any) => l._count?.bids > 0 && l.status === "OPEN") && (
          <div style={{ margin: "0 16px 0", padding: "12px 16px", background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>🔔</span>
            <span style={{ fontSize: "13px", color: "#92400E", fontWeight: "600" }}>
              You have new bids waiting. Click any load to review and accept.
            </span>
          </div>
        )}
        {loads.length > 0 && (
          <div className="loads-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 180px 80px 80px 110px", padding: "10px 24px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
            {["Load", "Route", "Weight", "Price", "Status"].map(h => (
              <span key={h} style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{h}</span>
            ))}
          </div>
        )}
        {loads.slice(0, 6).length === 0 ? (
          <div style={{ padding: "52px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "14px" }}>📦</div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: P, marginBottom: "6px" }}>No loads yet</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{user?.role === "CARGO_SENDER" ? "Post your first load to get started" : "Available loads will appear here"}</div>
          </div>
        ) : loads.slice(0, 6).map((load: any, i: number) => (
          <div key={load.id} onClick={() => router.push(`/dashboard/loads/${load.id}`)}
            style={{ display: "grid", gridTemplateColumns: "1fr 180px 80px 80px 110px", padding: "14px 24px", borderBottom: i < 5 ? "1px solid var(--border)" : "none", alignItems: "center", cursor: "pointer", transition: "background 0.15s" }}
            onMouseOver={e => (e.currentTarget.style.background = "var(--bg)")}
            onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: P }}>{load.title}</span>
                {load._count?.bids > 0 && load.status === "OPEN" && (
                  <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "99px", background: "rgba(245,158,11,0.15)", color: "#92400E", whiteSpace: "nowrap" as const }}>
                    {load._count.bids} bid{load._count.bids !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{load.truckTypeNeeded?.replace(/_/g, " ")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text)" }}>
              <span>{load.pickupCity}</span>
              <span style={{ color: A, fontWeight: "700" }}>→</span>
              <span>{load.deliveryCity}</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{load.weightTons}t</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: P }}>${load.offeredPrice}</div>
            <StatusBadge status={load.status} />
          </div>
        ))}
      </div>
      {/* Return loads — truck owner only */}
      {user?.role === "TRUCK_OWNER" && returnLoads.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden", marginTop: "20px" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: P }}>Loads On Your Return Route</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Available loads near your current city</div>
            </div>
            <button onClick={() => router.push("/dashboard/loads")} style={{ background: "none", border: "none", color: A, fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>View all</button>
          </div>
          {returnLoads.map((load: any, i: number) => (
            <div key={load.id} onClick={() => router.push(`/dashboard/loads/${load.id}`)}
              style={{ display: "grid", gridTemplateColumns: "1fr 200px 100px", padding: "14px 24px", borderBottom: i < returnLoads.length - 1 ? "1px solid var(--bg)" : "none", alignItems: "center", cursor: "pointer" }}
              onMouseOver={e => e.currentTarget.style.background = "var(--bg)"}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: P }}>{load.title}</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{load.truckTypeNeeded?.replace(/_/g, " ")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text)" }}>
                <span>{load.pickupCity}</span>
                <span style={{ color: A, fontWeight: "700" }}>→</span>
                <span>{load.deliveryCity}</span>
              </div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: P }}>${load.offeredPrice}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
