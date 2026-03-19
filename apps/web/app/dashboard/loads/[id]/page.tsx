"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

export default function LoadDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user } = useAuthStore();
  const [load, setLoad] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
  }, [user, id]);

  const fetchData = async () => {
    try {
      const [loadRes, bookingsRes] = await Promise.all([
        api.get(`/loads/${id}`),
        user?.role === "CARGO_SENDER" ? api.get(`/bookings/load/${id}`) : Promise.resolve({ data: { bookings: [] } }),
      ]);
      setLoad(loadRes.data.load || loadRes.data);
      setBookings(bookingsRes.data.bookings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAccept = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/accept`);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/reject`);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const statusColor: any = {
    OPEN:       { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    BOOKED:     { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    IN_TRANSIT: { bg: "#fff7ed", color: "#c8901e", border: "#fed7aa" },
    DELIVERED:  { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
    CANCELLED:  { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    DRAFT:      { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
    PENDING:    { bg: "#fff7ed", color: "#c8901e", border: "#fed7aa" },
    ACCEPTED:   { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    REJECTED:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ width: "36px", height: "36px", border: "3px solid #e8e3d8", borderTop: "3px solid #1a2744", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!load) return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ textAlign: "center" as const }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>😕</div>
        <h2 style={{ color: "#1a2744", fontWeight: "800" }}>Load not found</h2>
        <button onClick={() => router.back()} style={{ marginTop: "16px", background: "#1a2744", color: "#f0ebe0", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: "700", cursor: "pointer" }}>Go Back</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Nav */}
      <div style={{ background: "#1a2744", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 100 }}>
        <div onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <img src="/loadlink.png" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
        </div>
        <button onClick={() => router.back()} style={{ background: "rgba(240,235,224,0.08)", border: "none", borderRadius: "8px", padding: "8px 16px", color: "rgba(240,235,224,0.6)", fontSize: "14px", cursor: "pointer" }}>
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "800", color: "#1a2744", margin: "0 0 8px", letterSpacing: "-1px" }}>{load.title}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", padding: "5px 12px", borderRadius: "20px", background: statusColor[load.status]?.bg, color: statusColor[load.status]?.color, border: `1px solid ${statusColor[load.status]?.border}` }}>
                {load.status}
              </span>
              <span style={{ fontSize: "13px", color: "#9e9890" }}>
                Posted {new Date(load.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1a2744", letterSpacing: "-1px" }}>${load.offeredPrice}</div>
            <div style={{ fontSize: "13px", color: "#9e9890" }}>{load.currency}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>

          {/* Left */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "16px" }}>

            {/* Route */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(26,39,68,0.06)" }}>
              <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, margin: "0 0 20px" }}>Route</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "6px" }}>Pickup</div>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a2744" }}>{load.pickupCity}</div>
                  <div style={{ fontSize: "13px", color: "#9e9890" }}>{load.pickupCountry}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "40px", height: "2px", background: "#c8901e" }} />
                  
                  <div style={{ width: "40px", height: "2px", background: "#c8901e" }} />
                </div>
                <div style={{ flex: 1, textAlign: "right" as const }}>
                  <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "6px" }}>Delivery</div>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a2744" }}>{load.deliveryCity}</div>
                  <div style={{ fontSize: "13px", color: "#9e9890" }}>{load.deliveryCountry}</div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(26,39,68,0.06)" }}>
              <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, margin: "0 0 20px" }}>Load Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {[
                  ["Weight", `${load.weightTons} tons`],
                  ["Truck Type", load.truckTypeNeeded?.replace(/_/g, " ")],
                  ["Schedule", load.scheduledDate ? new Date(load.scheduledDate).toLocaleDateString() : "Flexible"],
                  ["Currency", load.currency],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#faf8f4", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "6px" }}>{label}</div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a2744" }}>{value}</div>
                  </div>
                ))}
              </div>
              {load.description && (
                <div style={{ marginTop: "16px", padding: "14px", background: "#faf8f4", borderRadius: "10px" }}>
                  <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "6px" }}>Description</div>
                  <div style={{ fontSize: "14px", color: "#1a2744", lineHeight: "1.6" }}>{load.description}</div>
                </div>
              )}
            </div>

            {/* Bookings — cargo sender only */}
            {user?.role === "CARGO_SENDER" && (
              <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid rgba(26,39,68,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0ede6" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, margin: 0 }}>
                    Applications ({bookings.length})
                  </h3>
                </div>
                {bookings.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center" as const }}>
                    
                    <p style={{ color: "#9e9890", fontSize: "14px", margin: 0 }}>No applications yet</p>
                  </div>
                ) : bookings.map((booking: any) => (
                  <div key={booking.id} style={{ padding: "18px 24px", borderBottom: "1px solid #faf8f4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a2744", marginBottom: "4px" }}>
                        {booking.truck?.plateNumber} · {booking.truck?.truckType?.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontSize: "13px", color: "#9e9890" }}>
                        {booking.owner?.fullName} · {booking.owner?.phone}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px", fontWeight: "800", color: "#1a2744" }}>${booking.agreedPrice}</span>
                      <span style={{ fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "20px", background: statusColor[booking.status]?.bg, color: statusColor[booking.status]?.color, border: `1px solid ${statusColor[booking.status]?.border}` }}>
                        {booking.status}
                      </span>
                      {booking.status === "PENDING" && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => handleReject(booking.id)} disabled={actionLoading === booking.id} style={{ padding: "7px 14px", borderRadius: "7px", border: "1px solid #e8e3d8", background: "#fff", color: "#9e9890", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                            Reject
                          </button>
                          <button onClick={() => handleAccept(booking.id)} disabled={actionLoading === booking.id} style={{ padding: "7px 14px", borderRadius: "7px", border: "none", background: "#1a2744", color: "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                            {actionLoading === booking.id ? "..." : "Accept"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "16px" }}>
            {load.sender && (
              <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(26,39,68,0.06)" }}>
                <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, margin: "0 0 16px" }}>Posted By</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "#f0ebe0" }}>
                    {load.sender.fullName?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a2744" }}>{load.sender.fullName}</div>
                    <div style={{ fontSize: "13px", color: "#9e9890" }}>{load.sender.phone}</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: "#1a2744", borderRadius: "16px", padding: "24px" }}>
              <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.4)", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "8px" }}>Offered Price</div>
              <div style={{ fontSize: "36px", fontWeight: "800", color: "#f0ebe0", letterSpacing: "-1px", marginBottom: "4px" }}>${load.offeredPrice}</div>
              <div style={{ fontSize: "13px", color: "#c8901e" }}>{load.currency}</div>
            </div>

            <div style={{ background: "#fff", borderRadius: "16px", padding: "20px 24px", border: "1px solid rgba(26,39,68,0.06)" }}>
              <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "12px" }}>Timeline</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#9e9890" }}>Posted</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{new Date(load.createdAt).toLocaleDateString()}</span>
                </div>
                {load.scheduledDate && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "#9e9890" }}>Scheduled</span>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{new Date(load.scheduledDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
