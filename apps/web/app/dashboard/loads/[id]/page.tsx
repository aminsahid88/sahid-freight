"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { formatPrice, formatDate } from "@/lib/format";
import { Truck, ArrowRight, ShieldCheck, Star, Inbox, AlertTriangle } from "lucide-react";

// P2: bidding flow hidden during broker-direct-assignment pivot.
// When true, the bids panel + accept/reject buttons render and the bid fetch runs.
// Handlers (handleAcceptBid, handleRejectBid) are kept for easy revert.
const BIDDING_ENABLED = false;

const P = "var(--primary)";
const A = "var(--accent)";

const statusStyle: any = {
  OPEN:       { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0", label: "Open" },
  BOOKED:     { bg: "#E8F0FF", color: "#3D7BFF", border: "#BBD0FF", label: "Booked" },
  IN_TRANSIT: { bg: "#FFF7ED", color: "#C2791A", border: "#FED7AA", label: "In transit" },
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
        BIDDING_ENABLED && user?.role === "CARGO_SENDER" ? api.get(`/bids/load/${id}`) : Promise.resolve({ data: { bids: [] } }),
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
      showToast("Offer accepted — the truck owner has been notified.");
      fetchData();
    } catch (err: any) {
      setBids(prevBids);
      showToast(formatApiError(err, "We couldn't accept this offer. Please try again.", "load"));
    }
    finally { setActionLoading(null); }
  };

  const handleRejectBid = async (bidId: string) => {
    setActionLoading(bidId);
    try {
      await api.patch(`/bids/${bidId}/reject`);
      fetchData();
    } catch (err: any) { showToast(formatApiError(err, "We couldn't reject this offer. Please try again.", "load")); }
    finally { setActionLoading(null); }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/accept`);
      showToast("Booking confirmed — the truck owner has been notified.");
      fetchData();
    } catch (err: any) { showToast(formatApiError(err, "We couldn't confirm this booking. Please try again.", "booking")); }
    finally { setActionLoading(null); }
  };

  const handleRejectBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/reject`);
      fetchData();
    } catch (err: any) { showToast(formatApiError(err, "We couldn't reject this booking. Please try again.", "booking")); }
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
      <div style={{ display: "inline-flex", padding: "16px", borderRadius: "16px", background: "var(--bg)", marginBottom: "16px", color: "#94A3B8" }}>
        <AlertTriangle size={36} />
      </div>
      <h2 style={{ color: P, fontWeight: "800" }}>Load not found</h2>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>The load may have been deleted or you don't have access.</div>
      <button onClick={() => router.back()} style={{ marginTop: "16px", background: P, color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: "700", cursor: "pointer" }}>Go back</button>
    </div>
  );

  const pendingBids = bids.filter((b: any) => b.status === "PENDING");
  const lowestBid  = bids.length > 0 ? Math.min(...bids.map((b: any) => b.price)) : null;

  return (
    <div>
      <style>{`
        @media (max-width: 640px) {
          .sender-detail-toast { top: auto !important; bottom: 80px !important; left: 16px !important; right: 16px !important; text-align: center; }
          .sender-detail-header { margin-bottom: 20px !important; gap: 12px !important; }
          .sender-detail-title { font-size: 20px !important; }
          .sender-detail-price { padding: 14px 18px !important; text-align: left !important; width: 100% !important; }
          .sender-detail-price-value { font-size: 22px !important; }
          .sender-route-card { padding: 18px !important; }
          .sender-route-row { flex-wrap: wrap !important; gap: 12px !important; }
          .sender-route-city { font-size: 16px !important; }
          .sender-route-arrow { flex-direction: row !important; width: 100% !important; justify-content: center !important; order: 2 !important; }
          .sender-route-arrow > div { width: 32px !important; height: 2px !important; }
          .sender-route-pickup { flex: 1 1 45% !important; order: 1 !important; }
          .sender-route-delivery { flex: 1 1 45% !important; order: 3 !important; }
          .sender-details-card { padding: 18px !important; }
          .sender-details-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .sender-details-cell { padding: 12px !important; }
          .sender-bids-header { padding: 14px 16px !important; }
          .sender-bid-row { padding: 14px 16px !important; }
          .sender-bid-inner { flex-direction: column !important; align-items: stretch !important; }
          .sender-bid-right { justify-content: space-between !important; width: 100% !important; }
          .sender-booking-row { padding: 14px 16px !important; flex-direction: column !important; align-items: stretch !important; }
          .sender-booking-right { flex-wrap: wrap !important; width: 100% !important; justify-content: flex-start !important; }
          .sender-booking-right button { flex: 1 1 auto !important; min-height: 44px !important; }
          .sender-postedby { padding: 16px !important; }
        }
        @media (max-width: 380px) {
          .sender-detail-title { font-size: 18px !important; }
          .sender-details-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Toast */}
      {toast && (
        <div className="sender-detail-toast" style={{ position: "fixed", top: "24px", right: "24px", background: P, color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="sender-detail-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", padding: "4px 0 8px", display: "flex", alignItems: "center", gap: "4px", minHeight: "32px" }}>
            ← Back
          </button>
          <h1 className="sender-detail-title" style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>{load.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
            <StatusBadge status={load.status} />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Posted {formatDate(load.createdAt)}</span>
            {bids.length > 0 && <span style={{ fontSize: "13px", color: A, fontWeight: "600" }}>{bids.length} offer{bids.length !== 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div className="sender-detail-price" style={{ background: P, borderRadius: "14px", padding: "16px 24px", textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>Offered price</div>
          <div className="sender-detail-price-value" style={{ fontSize: "28px", fontWeight: "800", color: "#fff", letterSpacing: "-1px" }}>{formatPrice(load.offeredPrice, load.currency)}</div>
          {lowestBid && lowestBid < load.offeredPrice && (
            <div style={{ fontSize: "11px", color: A, marginTop: "4px" }}>Lowest offer: {formatPrice(lowestBid, load.currency)}</div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>

        {/* Route card */}
        <div className="sender-route-card" style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "20px" }}>Route</div>
          <div className="sender-route-row" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div className="sender-route-pickup" style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Pickup</div>
              <div className="sender-route-city" style={{ fontSize: "20px", fontWeight: "800", color: P }}>{load.pickupCity}</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{load.pickupCountry}</div>
            </div>
            <div className="sender-route-arrow" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <div style={{ width: "48px", height: "2px", background: A }} />
              <Truck size={18} color={A} />
              <div style={{ width: "48px", height: "2px", background: A }} />
            </div>
            <div className="sender-route-delivery" style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Delivery</div>
              <div className="sender-route-city" style={{ fontSize: "20px", fontWeight: "800", color: P }}>{load.deliveryCity}</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{load.deliveryCountry}</div>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="sender-details-card" style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Load details</div>
          <div className="sender-details-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              ["Weight", `${load.weightTons} tons`],
              ["Truck type", load.truckTypeNeeded?.replace(/_/g, " ")],
              ["Scheduled", load.scheduledDate ? formatDate(load.scheduledDate) : "Flexible"],
              ["Currency", load.currency],
            ].map(([label, value]) => (
              <div key={label} className="sender-details-cell" style={{ background: "var(--bg)", borderRadius: "10px", padding: "14px" }}>
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

        {/* ── BIDS PANEL — hidden during broker pivot (P2) ── */}
        {BIDDING_ENABLED && user?.role === "CARGO_SENDER" && (
          <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div className="sender-bids-header" style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: P }}>
                Offers <span style={{ color: "var(--text-secondary)", fontWeight: "400" }}>({bids.length})</span>
              </div>
              {pendingBids.length > 0 && (
                <span style={{ fontSize: "12px", fontWeight: "700", color: A, background: `rgba(245,158,11,0.1)`, padding: "3px 10px", borderRadius: "99px" }}>
                  {pendingBids.length} pending
                </span>
              )}
            </div>
            {bids.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ display: "inline-flex", padding: "12px", borderRadius: "12px", background: "var(--bg)", marginBottom: "12px", color: "#94A3B8" }}>
                  <Inbox size={28} />
                </div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>No offers yet. A broker will match your load with a verified truck shortly.</div>
              </div>
            ) : bids.map((bid: any, i: number) => (
              <div key={bid.id} className="sender-bid-row" style={{ padding: "18px 24px", borderBottom: i < bids.length - 1 ? "1px solid var(--bg)" : "none" }}>
                <div className="sender-bid-inner" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `rgba(27,58,45,0.1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800", color: P, flexShrink: 0 }}>
                        {bid.truckOwner?.fullName?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: P }}>{bid.truckOwner?.fullName}</span>
                          {bid.truckOwner?.isVerified && (
                            <span style={{ fontSize: "10px", fontWeight: "700", color: "#16A34A", background: "#F0FDF4", padding: "2px 6px", borderRadius: "99px", border: "1px solid #BBF7D0", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <ShieldCheck size={10} /> Verified
                            </span>
                          )}
                          {bid.truckOwner?.averageRating > 0 && (
                            <span style={{ fontSize: "10px", color: "#92400E", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <Star size={10} fill="currentColor" /> {Number(bid.truckOwner.averageRating).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{bid.truckOwner?.phone}</div>
                      </div>
                    </div>
                    {bid.truck && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg)", borderRadius: "7px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <Truck size={12} />
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
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>{formatDate(bid.createdAt)}</div>
                  </div>
                  <div className="sender-bid-right" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "22px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>{formatPrice(bid.price, load.currency)}</div>
                      <StatusBadge status={bid.status} />
                    </div>
                    {bid.status === "PENDING" && load.status === "OPEN" && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => handleRejectBid(bid.id)} disabled={actionLoading === bid.id}
                          style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer", minHeight: "44px" }}>
                          Decline
                        </button>
                        <button onClick={() => handleAcceptBid(bid.id)} disabled={actionLoading === bid.id}
                          style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: P, color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", minHeight: "44px" }}>
                          {actionLoading === bid.id ? "Accepting…" : "Accept offer"}
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
              <div key={booking.id} className="sender-booking-row" style={{ padding: "16px 24px", borderBottom: i < bookings.length - 1 ? "1px solid var(--bg)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: P }}>
                    {booking.truck?.plateNumber} · {booking.truck?.truckType?.replace(/_/g, " ")}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    {booking.owner?.fullName} · {booking.owner?.phone}
                  </div>
                </div>
                <div className="sender-booking-right" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: P }}>{formatPrice(booking.agreedPrice, booking.currency || load.currency)}</span>
                  <StatusBadge status={booking.status} />
                  {booking.status === "PENDING" && (
                    <div style={{ display: "flex", gap: "8px", flex: "1 1 auto" }}>
                      <button onClick={() => handleRejectBooking(booking.id)} disabled={actionLoading === booking.id}
                        style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", cursor: "pointer", minHeight: "44px" }}>
                        Decline
                      </button>
                      <button onClick={() => handleAcceptBooking(booking.id)} disabled={actionLoading === booking.id}
                        style={{ padding: "7px 14px", borderRadius: "8px", border: "none", background: P, color: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer", minHeight: "44px" }}>
                        {actionLoading === booking.id ? "Confirming…" : "Confirm booking"}
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
          <div className="sender-postedby" style={{ background: "var(--surface)", borderRadius: "16px", padding: "20px 24px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: `rgba(27,58,45,0.1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: P, flexShrink: 0 }}>
              {load.sender.fullName?.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>Posted by</div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: P }}>{load.sender.fullName}</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{load.sender.phone}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
