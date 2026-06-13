"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
  PENDING:    { bg: "#FFF7ED", color: "#C2791A", border: "#FED7AA", label: "Pending" },
  ACCEPTED:   { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0", label: "Accepted" },
  REJECTED:   { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Rejected" },
};
const StatusBadge = ({ status }: { status: string }) => {
  const s = statusStyle[status] || { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: status };
  return <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>;
};

export default function LoadDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user } = useAuthStore();
  const [load, setLoad]           = useState<any>(null);
  const [bids, setBids]           = useState<any[]>([]);
  const [bookings, setBookings]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast]         = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user, id]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchData = async () => {
    try {
      const [loadRes, bidsRes, bookingsRes] = await Promise.all([
        api.get(`/loads/${id}`),
        user?.role === "CARGO_SENDER" ? api.get(`/bids/load/${id}`) : Promise.resolve({ data: { bids: [] } }),
        user?.role === "CARGO_SENDER" ? api.get(`/bookings/load/${id}`) : Promise.resolve({ data: { bookings: [] } }),
      ]);
      setLoad(loadRes.data.load || loadRes.data);
      setBids(bidsRes.data.bids || []);
      setBookings(bookingsRes.data.bookings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAcceptBid = async (bidId: string) => {
    setActionLoading(bidId);
    const prevBids = bids;
    // Optimistic: mark this bid ACCEPTED, all other PENDING bids REJECTED
    setBids(prev => prev.map(b => b.id === bidId
      ? { ...b, status: "ACCEPTED" }
      : b.status === "PENDING" ? { ...b, status: "REJECTED" } : b
    ));
    try {
      await api.patch(`/bids/${bidId}/accept`);
      showToast("Bid accepted!");
      fetchData();
    } catch (err: any) {
      setBids(prevBids);
      showToast(err.response?.data?.message || "Error");
    }
    finally { setActionLoading(null); }
  };

  const handleRejectBid = async (bidId: string) => {
    setActionLoading(bidId);
    try {
      await api.patch(`/bids/${bidId}/reject`);
      fetchData();
    } catch (err: any) { showToast(err.response?.data?.message || "Error"); }
    finally { setActionLoading(null); }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/accept`);
      showToast("Booking accepted!");
      fetchData();
    } catch (err: any) { showToast(err.response?.data?.message || "Error"); }
    finally { setActionLoading(null); }
  };

  const handleRejectBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/reject`);
      fetchData();
    } catch (err: any) { showToast(err.response?.data?.message || "Error"); }
    finally { setActionLoading(null); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: "36px", height: "36px", border: `3px solid var(--border)`, borderTop: `3px solid ${P}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!load) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>😕</div>
      <h2 style={{ color: P, fontWeight: "800" }}>Load not found</h2>
      <button onClick={() => router.back()} style={{ marginTop: "16px", background: P, color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: "700", cursor: "pointer" }}>Go Back</button>
    </div>
  );

  const pendingBids = bids.filter((b: any) => b.status === "PENDING");
  const lowestBid  = bids.length > 0 ? Math.min(...bids.map((b: any) => b.price)) : null;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", background: P, color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", padding: "0 0 8px", display: "flex", alignItems: "center", gap: "4px" }}>
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>{load.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
            <StatusBadge status={load.status} />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Posted {new Date(load.createdAt).toLocaleDateString()}</span>
            {bids.length > 0 && <span style={{ fontSize: "13px", color: A, fontWeight: "600" }}>{bids.length} bid{bids.length !== 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div style={{ background: P, borderRadius: "14px", padding: "16px 24px", textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>Offered Price</div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#fff", letterSpacing: "-1px" }}>${load.offeredPrice}</div>
          {lowestBid && lowestBid < load.offeredPrice && (
            <div style={{ fontSize: "11px", color: A, marginTop: "4px" }}>Lowest bid: ${lowestBid}</div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>

        {/* Route card */}
        <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "20px" }}>Route</div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Pickup</div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: P }}>{load.pickupCity}</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{load.pickupCountry}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <div style={{ width: "48px", height: "2px", background: A }} />
              <div style={{ fontSize: "16px" }}>🚛</div>
              <div style={{ width: "48px", height: "2px", background: A }} />
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Delivery</div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: P }}>{load.deliveryCity}</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{load.deliveryCountry}</div>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Load Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              ["Weight", `${load.weightTons} tons`],
              ["Truck Type", load.truckTypeNeeded?.replace(/_/g, " ")],
              ["Scheduled", load.scheduledDate ? new Date(load.scheduledDate).toLocaleDateString() : "Flexible"],
              ["Currency", load.currency],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "var(--bg)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: P }}>{value}</div>
              </div>
            ))}
          </div>
          {load.description && (
            <div style={{ marginTop: "12px", padding: "14px", background: "var(--bg)", borderRadius: "10px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Description</div>
              <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: "1.6" }}>{load.description}</div>
            </div>
          )}
        </div>

        {/* ── BIDS PANEL (cargo sender only) ── */}
        {user?.role === "CARGO_SENDER" && (
          <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: P }}>
                Bids <span style={{ color: "var(--text-secondary)", fontWeight: "400" }}>({bids.length})</span>
              </div>
              {pendingBids.length > 0 && (
                <span style={{ fontSize: "12px", fontWeight: "700", color: A, background: `rgba(245,158,11,0.1)`, padding: "3px 10px", borderRadius: "99px" }}>
                  {pendingBids.length} pending
                </span>
              )}
            </div>
            {bids.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>No bids yet. Share your load to attract truck owners.</div>
              </div>
            ) : bids.map((bid: any, i: number) => (
              <div key={bid.id} style={{ padding: "18px 24px", borderBottom: i < bids.length - 1 ? "1px solid var(--bg)" : "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `rgba(27,58,45,0.1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: P, flexShrink: 0 }}>
                        {bid.truckOwner?.fullName?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: P }}>{bid.truckOwner?.fullName}</span>
                          {bid.truckOwner?.isVerified && <span style={{ fontSize: "10px", fontWeight: "700", color: "#16A34A", background: "#F0FDF4", padding: "2px 6px", borderRadius: "99px", border: "1px solid #BBF7D0" }}>✓ Verified</span>}
                          {bid.truckOwner?.averageRating > 0 && (
                            <span style={{ fontSize: "10px", color: "#92400E", fontWeight: "600" }}>★ {Number(bid.truckOwner.averageRating).toFixed(1)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{bid.truckOwner?.phone}</div>
                      </div>
                    </div>
                    {bid.truck && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg)", borderRadius: "7px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <span>🚛</span>
                        <span style={{ fontWeight: "600", color: P }}>{bid.truck.plateNumber}</span>
                        <span>·</span>
                        <span>{bid.truck.truckType?.replace(/_/g, " ")}</span>
                        <span>·</span>
                        <span>{bid.truck.capacityTons}t</span>
                      </div>
                    )}
                    {bid.message && (
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px", fontStyle: "italic" }}>"{bid.message}"</div>
                    )}
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>{new Date(bid.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "22px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>${bid.price}</div>
                      <StatusBadge status={bid.status} />
                    </div>
                    {bid.status === "PENDING" && load.status === "OPEN" && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => handleRejectBid(bid.id)} disabled={actionLoading === bid.id}
                          style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer", minHeight: "36px" }}>
                          Reject
                        </button>
                        <button onClick={() => handleAcceptBid(bid.id)} disabled={actionLoading === bid.id}
                          style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: P, color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", minHeight: "36px" }}>
                          {actionLoading === bid.id ? "..." : "Accept"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── BOOKINGS PANEL (cargo sender only) ── */}
        {user?.role === "CARGO_SENDER" && bookings.length > 0 && (
          <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: P }}>
                Bookings <span style={{ color: "var(--text-secondary)", fontWeight: "400" }}>({bookings.length})</span>
              </div>
            </div>
            {bookings.map((booking: any, i: number) => (
              <div key={booking.id} style={{ padding: "16px 24px", borderBottom: i < bookings.length - 1 ? "1px solid var(--bg)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: P }}>
                    {booking.truck?.plateNumber} · {booking.truck?.truckType?.replace(/_/g, " ")}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    {booking.owner?.fullName} · {booking.owner?.phone}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: P }}>${booking.agreedPrice}</span>
                  <StatusBadge status={booking.status} />
                  {booking.status === "PENDING" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => handleRejectBooking(booking.id)} disabled={actionLoading === booking.id}
                        style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                        Reject
                      </button>
                      <button onClick={() => handleAcceptBooking(booking.id)} disabled={actionLoading === booking.id}
                        style={{ padding: "7px 14px", borderRadius: "8px", border: "none", background: P, color: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                        {actionLoading === booking.id ? "..." : "Accept"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Posted by */}
        {load.sender && (
          <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "20px 24px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: `rgba(27,58,45,0.1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: P, flexShrink: 0 }}>
              {load.sender.fullName?.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>Posted By</div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: P }}>{load.sender.fullName}</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{load.sender.phone}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
