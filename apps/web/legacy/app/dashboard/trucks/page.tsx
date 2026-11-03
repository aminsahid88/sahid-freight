"use client";
import { Truck, Plus, ShieldCheck, CheckCircle2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useGateStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { formatDate } from "@/lib/format";

export default function TrucksPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { openGate } = useGateStore();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTruck, setAssigningTruck] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (!["TRUCK_OWNER", "CARGO_SENDER"].includes(user.role)) { router.push("/dashboard"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [trucksRes, driversRes] = await Promise.all([
        api.get("/trucks/my"),
        api.get("/drivers"),
      ]);
      setTrucks(trucksRes.data.trucks || []);
      setDrivers(driversRes.data.drivers || []);
    } catch (err) {
      setPageError(formatApiError(err, "We couldn't load your trucks.", "truck"));
    }
    finally { setLoading(false); }
  };

  const assignDriver = async (truckId: string, driverId: string | null) => {
    setAssignLoading(true);
    try {
      await api.patch(`/trucks/${truckId}`, { driverId });
      setAssigningTruck(null);
      fetchData();
    } catch (err) {
      setPageError(formatApiError(err, "We couldn't assign that driver.", "truck"));
    }
    finally { setAssignLoading(false); }
  };

  const toggleAvailability = async (truckId: string, current: boolean) => {
    try {
      await api.patch(`/trucks/${truckId}`, { isAvailable: !current });
      setTrucks((prev) => prev.map((t) => t.id === truckId ? { ...t, isAvailable: !current } : t));
    } catch (err) {
      setPageError(formatApiError(err, "We couldn't update this truck's status.", "truck"));
    }
  };

  if (!user?.isVerified) return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "40px 24px", textAlign: "center" as const }}>
      <div style={{ width: "64px", height: "64px", background: "#fff7ed", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ShieldCheck size={28} color="var(--accent)" />
      </div>
      <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary)", margin: 0 }}>Documents under review</h2>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "300px", lineHeight: "1.6", margin: 0 }}>Your documents have been submitted and are being reviewed. You can add trucks once your account is verified — usually within 24 hours.</p>
      <button onClick={() => router.push("/dashboard")} style={{ background: "var(--primary)", color: "#FAFAF8", border: "none", borderRadius: "10px", padding: "12px 28px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>Back to dashboard</button>
    </div>
  );

  return (
    <div>
        <style>{`
          @media (max-width: 640px) {
            .trucks-header { flex-direction: column !important; align-items: stretch !important; gap: 12px; margin-bottom: 20px !important; }
            .trucks-h1 { font-size: 22px !important; letter-spacing: -0.5px !important; }
            .trucks-add-btn { justify-content: center; width: 100%; padding: 14px 20px !important; }
            .trucks-list-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
            .trucks-card { padding: 16px !important; border-radius: 14px !important; }
            .trucks-card-top { flex-wrap: wrap; gap: 10px; }
            .trucks-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
            .trucks-driver-row { flex-direction: column !important; align-items: stretch !important; gap: 10px; }
            .trucks-change-driver-btn { width: 100%; min-height: 44px; }
            .trucks-footer-row { flex-direction: column !important; align-items: stretch !important; gap: 10px; }
            .trucks-find-loads-btn { width: 100%; justify-content: center; min-height: 44px; }
          }
        `}</style>
        <div className="trucks-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 className="trucks-h1" style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary)", margin: "0 0 4px", letterSpacing: "-1px" }}>My trucks</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>Every truck registered to your account.</p>
          </div>
          <a href="/dashboard/trucks/new" className="trucks-add-btn" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--primary)", color: "#FAFAF8", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>
            <Plus size={16} /> Add truck
          </a>
        </div>

        {pageError && (
          <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>
            {pageError}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "8px" }}>
            <style>{`@keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.sk{background:linear-gradient(90deg,#ede9e2 25%,#e2ddd6 50%,#ede9e2 75%);background-size:2000px 100%;animation:shimmer 1.5s infinite;border-radius:10px;}`}</style>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>Loading your trucks…</div>
            {[1,2,3,4].map((i: number) => <div key={i} className="sk" style={{ height: "72px", marginBottom: "10px" }} />)}
          </div>
        ) : trucks.length === 0 ? (
          <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "64px 24px", textAlign: "center" as const, border: "1px solid rgba(10,31,68,0.06)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#94A3B8" }}>
              <Truck size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--primary)", margin: "0 0 8px" }}>No trucks yet</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: "0 0 24px" }}>Add your first truck to start receiving dispatches.</p>
            <a href="/dashboard/trucks/new" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--primary)", color: "#FAFAF8", padding: "12px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>
              <Plus size={16} /> Add truck
            </a>
          </div>
        ) : (
          <div className="trucks-list-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {trucks.map((truck: any) => (
              <div key={truck.id} className="trucks-card" style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(10,31,68,0.06)", boxShadow: "0 2px 8px rgba(10,31,68,0.04)" }}>

                <div className="trucks-card-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "48px", height: "48px", background: "var(--bg)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary)", fontFamily: "monospace", letterSpacing: "1px" }}>{truck.plateNumber}</div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>{truck.truckType?.replace(/_/g, " ")}</div>
                    </div>
                  </div>

                  {/* availability toggle */}
                  <div
                    onClick={() => toggleAvailability(truck.id, truck.isAvailable)}
                    style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", background: truck.isAvailable ? "#f0fdf4" : "#fef2f2", border: `1px solid ${truck.isAvailable ? "#bbf7d0" : "#fecaca"}`, borderRadius: "20px", padding: "6px 12px" }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: truck.isAvailable ? "#16a34a" : "#dc2626" }} />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: truck.isAvailable ? "#16a34a" : "#dc2626" }}>
                      {truck.isAvailable ? "Available" : "Busy"}
                    </span>
                  </div>
                </div>

                <div className="trucks-stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  {[
                    ["Capacity", `${truck.capacityTons} tons`],
                    ["Location", truck.currentCity],
                    ["Length", truck.lengthMeters ? `${truck.lengthMeters}m` : "—"],
                    ["Verified", truck.isVerified ? "Yes" : "Pending"],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px 12px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Driver assignment */}
                <div style={{ marginBottom: "14px", background: "var(--bg)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div className="trucks-driver-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "3px" }}>Permanent driver</div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>
                        {truck.driver?.fullName || <span style={{ color: "var(--text-secondary)", fontWeight: "400" }}>No driver assigned</span>}
                      </div>
                      {truck.driver && <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{truck.driver.phone}</div>}
                    </div>
                    <button
                      onClick={() => setAssigningTruck(assigningTruck === truck.id ? null : truck.id)}
                      className="trucks-change-driver-btn"
                      style={{ background: "none", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 12px", color: "var(--primary)", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseOver={e => { e.currentTarget.style.background = "var(--surface)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {truck.driver ? "Change driver" : "Assign driver"}
                    </button>
                  </div>

                  {assigningTruck === truck.id && (
                    <div style={{ marginTop: "10px", borderTop: "1px solid var(--border)", paddingTop: "10px", display: "flex", flexDirection: "column" as const, gap: "6px" }}>
                      {drivers.length === 0 ? (
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No drivers added yet. <a href="/dashboard/drivers" style={{ color: "var(--accent)", fontWeight: "600" }}>Add a driver</a>.</div>
                      ) : (
                        <>
                          {drivers.map((d: any) => (
                            <button key={d.id} onClick={() => assignDriver(truck.id, d.id)} disabled={assignLoading}
                              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${truck.driverId === d.id ? "var(--primary)" : "var(--border)"}`, background: truck.driverId === d.id ? "var(--bg)" : "var(--surface)", cursor: "pointer", textAlign: "left" as const }}>
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", color: "#FAFAF8", flexShrink: 0 }}>
                                {d.fullName?.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary)" }}>{d.fullName}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{d.phone}</div>
                              </div>
                              {truck.driverId === d.id && (
                                <div style={{ marginLeft: "auto", fontSize: "11px", color: "#047857", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <CheckCircle2 size={12} /> Assigned
                                </div>
                              )}
                            </button>
                          ))}
                          {truck.driverId && (
                            <button onClick={() => assignDriver(truck.id, null)} disabled={assignLoading}
                              style={{ padding: "7px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fff5f5", color: "#DC2626", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                              Remove driver
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="trucks-footer-row" style={{ paddingTop: "14px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Added {formatDate(truck.createdAt)}
                  </span>
                  <button
                    onClick={() => router.push(`/dashboard/loads`)}
                    className="trucks-find-loads-btn"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 14px", color: "var(--primary)", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseOver={e => { e.currentTarget.style.background = "var(--bg)"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Search size={13} /> Find loads
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
