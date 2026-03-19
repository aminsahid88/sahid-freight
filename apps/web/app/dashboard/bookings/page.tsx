"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

export default function BookingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [selectedLoad, setSelectedLoad] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
    if (user?.role === "TRUCK_OWNER") {
      api.get("/drivers").then(r => setDrivers(r.data.drivers || [])).catch(() => {});
    }
  }, [user]);

  const fetchData = async () => {
    try {
      if (user?.role === "TRUCK_OWNER") {
        const res = await api.get("/bookings/my");
        setBookings(res.data.bookings || []);
      } else if (user?.role === "ADMIN") {
        return;
      } else {
        const res = await api.get("/loads/my");
        setLoads(res.data.loads || []);
        if (res.data.loads?.length > 0) {
          const firstLoad = res.data.loads[0];
          setSelectedLoad(firstLoad.id);
          const bRes = await api.get(`/bookings/load/${firstLoad.id}`);
          setBookings(bRes.data.bookings || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookingsForLoad = async (loadId: string) => {
    setSelectedLoad(loadId);
    try {
      const res = await api.get(`/bookings/load/${loadId}`);
      setBookings(res.data.bookings || []);
    } catch (err) { console.error(err); }
  };

  const handleAccept = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/accept`);
      if (selectedLoad) loadBookingsForLoad(selectedLoad);
      else fetchData();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/reject`);
      if (selectedLoad) loadBookingsForLoad(selectedLoad);
      else fetchData();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const handleAssignDriver = async () => {
    if (!assignModal || !selectedDriver) return;
    try {
      await api.patch("/bookings/" + assignModal + "/assign-driver", { driverId: selectedDriver });
      setAssignModal(null); setSelectedDriver("");
      fetchData();
    } catch (err: any) { console.error(err); }
  };

  const statusColor: any = {
    PENDING:   { bg: "#fff7ed", color: "#c8901e", border: "#fed7aa" },
    ACCEPTED:  { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    REJECTED:  { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    CANCELLED: { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
    COMPLETED: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "loads", label: user?.role === "CARGO_SENDER" ? "My Loads" : "Find Loads" },
    ...(user?.role === "TRUCK_OWNER" ? [{ key: "trucks", label: "My Trucks" }] : []),
    { key: "bookings", label: "Bookings" },
    { key: "notifications", label: "Notifications" },
  ];

  return (
    <div>
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#1a2744", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Bookings</h1>
          <p style={{ color: "#9e9890", fontSize: "13px", margin: "0 0 16px" }}>
            {user?.role === "CARGO_SENDER" ? "Review and manage applications for your loads" : "Track your booking requests"}
          </p>
          {user?.role === "CARGO_SENDER" && loads.length > 0 && (
            <select value={selectedLoad || ""} onChange={e => loadBookingsForLoad(e.target.value)}
              style={{ padding: "9px 14px", borderRadius: "9px", border: "1px solid #ede9e0", background: "#fff", fontSize: "13px", color: "#1a2744", fontWeight: "600", cursor: "pointer", outline: "none", width: "100%", maxWidth: "360px" }}>
              {loads.map((load: any) => (
                <option key={load.id} value={load.id}>{load.title} — {load.pickupCity} → {load.deliveryCity}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center" as const, padding: "64px" }}>
            <div style={{ width: "36px", height: "36px", border: "3px solid #e8e3d8", borderTop: "3px solid #1a2744", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Sidebar — cargo sender only */}
            {/* Bookings list */}
            <div>
              {bookings.length === 0 ? (
                <div style={{ background: "#fff", borderRadius: "16px", padding: "64px 24px", textAlign: "center" as const, border: "1px solid rgba(26,39,68,0.06)" }}>
                  
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1a2744", margin: "0 0 8px" }}>No bookings yet</h3>
                  <p style={{ color: "#9e9890", fontSize: "15px", margin: 0 }}>
                    {user?.role === "CARGO_SENDER" ? "No truck owners have applied for this load yet" : "You haven't applied for any loads yet"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
                  {bookings.map((booking: any) => (
                    <div key={booking.id} style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(26,39,68,0.06)", boxShadow: "0 2px 8px rgba(26,39,68,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                        <div>
                          {user?.role === "CARGO_SENDER" ? (
                            <>
                              <div style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", marginBottom: "4px" }}>
                                {booking.truck?.plateNumber} — {booking.truck?.truckType?.replace("_", " ")}
                              </div>
                              <div style={{ fontSize: "13px", color: "#9e9890" }}>
                                Owner: {booking.owner?.fullName} · {booking.owner?.phone}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", marginBottom: "4px" }}>
                                {booking.load?.title}
                              </div>
                              <div style={{ fontSize: "13px", color: "#9e9890" }}>
                                {booking.load?.pickupCity} → {booking.load?.deliveryCity}
                              </div>
                            </>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", padding: "5px 12px", borderRadius: "20px", background: statusColor[booking.status]?.bg, color: statusColor[booking.status]?.color, border: `1px solid ${statusColor[booking.status]?.border}`, whiteSpace: "nowrap" as const }}>
                            {booking.status}
                          </span>
                          {user?.role === "TRUCK_OWNER" && booking.status === "ACCEPTED" && !booking.driverId && (
                            <button onClick={e => { e.stopPropagation(); setAssignModal(booking.id); }} style={{ padding: "5px 12px", borderRadius: "8px", border: "1px solid #c8901e", background: "#fff7ed", color: "#c8901e", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" as const }}>
                              + Assign Driver
                            </button>
                          )}
                          {booking.driverId && (
                            <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "600", padding: "4px 10px", borderRadius: "99px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                              Driver assigned
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", paddingTop: "14px", borderTop: "1px solid #f0ede6" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "4px" }}>Price</div>
                          <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a2744" }}>
                            ${booking.agreedPrice} <span style={{ fontSize: "12px", fontWeight: "400", color: "#9e9890" }}>{booking.currency}</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "4px" }}>Date</div>
                          <div style={{ fontSize: "13px", color: "#1a2744" }}>{new Date(booking.createdAt).toLocaleDateString()}</div>
                        </div>

                        {user?.role === "CARGO_SENDER" && booking.status === "PENDING" && (
                          <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
                            <button onClick={() => handleReject(booking.id)} disabled={actionLoading === booking.id} style={{ padding: "9px 20px", borderRadius: "8px", border: "1px solid #e8e3d8", background: "#fff", color: "#9e9890", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s" }}>
                              Reject
                            </button>
                            <button onClick={() => handleAccept(booking.id)} disabled={actionLoading === booking.id} style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "#1a2744", color: "#f0ebe0", fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s" }}>
                              {actionLoading === booking.id ? "..." : "Accept"}
                            </button>
                          </div>
                        )}


                        {(booking.status === "ACCEPTED" || booking.load?.status === "IN_TRANSIT") && (
                          <div style={{ marginLeft: "auto" }}>
                            <a href={`/tracking/${booking.id}`} style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "#c8901e", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", textDecoration: "none" }}>
                              {user?.role === "TRUCK_OWNER" ? "Share Location" : "Track Shipment"}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Assign Driver Modal */}
      {assignModal && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "28px" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#1a2744", marginBottom: "16px" }}>Assign Driver</div>
            <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "9px", border: "1px solid #ede9e0", fontSize: "13px", color: "#1a2744", marginBottom: "16px", outline: "none" }}>
              <option value="">Select a driver...</option>
              {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.fullName} — {d.phone}</option>)}
            </select>
            {drivers.length === 0 && <div style={{ fontSize: "12px", color: "#9e9890", marginBottom: "16px" }}>No drivers yet. Add drivers from My Drivers page.</div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setAssignModal(null); setSelectedDriver(""); }} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid #ede9e0", background: "#fff", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAssignDriver} disabled={!selectedDriver} style={{ flex: 2, padding: "11px", borderRadius: "9px", border: "none", background: "#1a2744", color: "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: !selectedDriver ? "not-allowed" : "pointer", opacity: !selectedDriver ? 0.6 : 1 }}>
                Assign Driver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
