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
  const [rateModal, setRateModal] = useState<any | null>(null);
  const [rateValue, setRateValue] = useState(0);
  const [rateComment, setRateComment] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [payments, setPayments] = useState<Record<string, any>>({});
  const [paymentModal, setPaymentModal] = useState<any | null>(null);
  const [waafiPhone, setWaafiPhone] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
    if (user?.role === "TRUCK_OWNER") {
      api.get("/drivers").then(r => setDrivers(r.data.drivers || [])).catch(() => {});
    }
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
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
          const bList = bRes.data.bookings || [];
          setBookings(bList);
          fetchPaymentsForBookings(bList);
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
      const bList = res.data.bookings || [];
      setBookings(bList);
      fetchPaymentsForBookings(bList);
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

  const handleRate = async () => {
    if (!rateModal || rateValue === 0) return;
    setRateLoading(true);
    try {
      await api.patch(`/bookings/${rateModal.id}/rate`, { rating: rateValue, comment: rateComment });
      setRateModal(null); setRateValue(0); setRateComment("");
      fetchData();
    } catch (err: any) { alert(err?.response?.data?.message || "Failed to submit rating"); }
    finally { setRateLoading(false); }
  };

  const fetchPaymentsForBookings = async (bookingList: any[]) => {
    const payable = bookingList.filter(b => ["ACCEPTED", "IN_TRANSIT", "COMPLETED"].includes(b.status));
    const results: Record<string, any> = {};
    await Promise.allSettled(payable.map(async b => {
      try {
        const r = await api.get(`/payments/${b.id}`);
        if (r.data.payment) results[b.id] = r.data.payment;
      } catch {}
    }));
    setPayments(prev => ({ ...prev, ...results }));
  };

  const handleInitiatePayment = async (booking: any, provider: string, phone?: string) => {
    setPaymentLoading(true);
    setPaymentMsg("");
    try {
      const res = await api.post("/payments/initiate", { bookingId: booking.id, provider, phone });
      const { payment, checkoutUrl, message } = res.data;
      setPayments(prev => ({ ...prev, [booking.id]: payment }));
      if (provider === "CHAPA" && checkoutUrl) {
        window.open(checkoutUrl, "_blank");
        setPaymentMsg("Complete payment in the Chapa tab, then click Verify below.");
      } else if (provider === "WAAFI") {
        setPaymentMsg(message || "Check your phone for EVC Plus / ZAAD prompt.");
        // Poll for confirmation
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const v = await api.post("/payments/verify", { bookingId: booking.id });
            if (v.data.payment?.status === "COMPLETED") {
              clearInterval(poll);
              setPayments(prev => ({ ...prev, [booking.id]: v.data.payment }));
              setPaymentMsg("Payment confirmed!");
              setTimeout(() => setPaymentModal(null), 1500);
            }
          } catch {}
          if (attempts >= 12) clearInterval(poll);
        }, 5000);
      } else if (provider === "CASH") {
        setPaymentMsg(message || "Cash payment recorded.");
        setTimeout(() => setPaymentModal(null), 1500);
      }
    } catch (err: any) {
      setPaymentMsg(err?.response?.data?.message || "Payment failed. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleVerifyChapa = async (bookingId: string) => {
    setPaymentLoading(true);
    try {
      const res = await api.post("/payments/verify", { bookingId });
      setPayments(prev => ({ ...prev, [bookingId]: res.data.payment }));
      setPaymentMsg(res.data.payment?.status === "COMPLETED" ? "Payment verified!" : "Not confirmed yet. Try again in a moment.");
    } catch (err: any) {
      setPaymentMsg(err?.response?.data?.message || "Verification failed");
    } finally {
      setPaymentLoading(false);
    }
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
    PENDING:   { bg: "#fff7ed", color: "#E8A020", border: "#fed7aa" },
    ACCEPTED:  { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    REJECTED:  { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    CANCELLED: { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
    COMPLETED: { bg: "#E8F0FF", color: "#3D7BFF", border: "#BBD0FF" },
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
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--primary)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>Bookings</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "0 0 16px" }}>
            {user?.role === "CARGO_SENDER" ? "Review and manage applications for your loads" : "Track your booking requests"}
          </p>
          {user?.role === "CARGO_SENDER" && loads.length > 0 && (
            <select value={selectedLoad || ""} onChange={e => loadBookingsForLoad(e.target.value)}
              style={{ padding: "9px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "13px", color: "var(--primary)", fontWeight: "600", cursor: "pointer", outline: "none", width: "100%", maxWidth: "360px" }}>
              {loads.map((load: any) => (
                <option key={load.id} value={load.id}>{load.title} — {load.pickupCity} → {load.deliveryCity}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "8px" }}>
            <style>{`@keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.sk{background:linear-gradient(90deg,#ede9e2 25%,#e2ddd6 50%,#ede9e2 75%);background-size:2000px 100%;animation:shimmer 1.5s infinite;border-radius:10px;}`}</style>
            {[1,2,3,4].map((i: number) => <div key={i} className="sk" style={{ height: "72px", marginBottom: "10px" }} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Sidebar — cargo sender only */}
            {/* Bookings list */}
            <div>
              {bookings.length === 0 ? (
                <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "64px 24px", textAlign: "center" as const, border: "1px solid rgba(26,39,68,0.06)" }}>

                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--primary)", margin: "0 0 8px" }}>No bookings yet</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>
                    {user?.role === "CARGO_SENDER" ? "No truck owners have applied for this load yet" : "You haven't applied for any loads yet"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
                  {bookings.map((booking: any) => (
                    <div key={booking.id} style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(26,39,68,0.06)", boxShadow: "0 2px 8px rgba(26,39,68,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                        <div>
                          {user?.role === "CARGO_SENDER" ? (
                            <>
                              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>
                                {booking.truck?.plateNumber} — {booking.truck?.truckType?.replace("_", " ")}
                              </div>
                              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                                Owner: {booking.owner?.fullName} · {booking.owner?.phone}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>
                                {booking.load?.title}
                              </div>
                              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                                {booking.load?.pickupCity} → {booking.load?.deliveryCity}
                              </div>
                            </>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", padding: "5px 12px", borderRadius: "20px", background: statusColor[booking.status]?.bg, color: statusColor[booking.status]?.color, border: `1px solid ${statusColor[booking.status]?.border}`, whiteSpace: "nowrap" as const }}>
                            {booking.status === "COMPLETED" ? "DELIVERED" : booking.status}
                          </span>
                          {user?.role === "TRUCK_OWNER" && booking.status === "ACCEPTED" && !booking.driverId && (
                            <button onClick={e => { e.stopPropagation(); setAssignModal(booking.id); }} style={{ padding: "5px 12px", borderRadius: "8px", border: "1px solid var(--accent)", background: "#fff7ed", color: "var(--accent)", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" as const }}>
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

                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "4px" }}>Price</div>
                          <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary)" }}>
                            ${booking.agreedPrice} <span style={{ fontSize: "12px", fontWeight: "400", color: "var(--text-secondary)" }}>{booking.currency}</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "4px" }}>Date</div>
                          <div style={{ fontSize: "13px", color: "var(--primary)" }}>{new Date(booking.createdAt).toLocaleDateString()}</div>
                        </div>

                        {user?.role === "CARGO_SENDER" && booking.status === "PENDING" && (
                          <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
                            <button onClick={() => handleReject(booking.id)} disabled={actionLoading === booking.id} style={{ padding: "9px 20px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s" }}>
                              Reject
                            </button>
                            <button onClick={() => handleAccept(booking.id)} disabled={actionLoading === booking.id} style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "var(--primary)", color: "#FAFAF8", fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s" }}>
                              {actionLoading === booking.id ? "..." : "Accept"}
                            </button>
                          </div>
                        )}


                        {(booking.status === "ACCEPTED" || booking.load?.status === "IN_TRANSIT") && (
                          <div style={{ marginLeft: "auto" }}>
                            <a href={`/tracking/${booking.id}`} style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", textDecoration: "none" }}>
                              {user?.role === "TRUCK_OWNER" ? "Share Location" : "Track Shipment"}
                            </a>
                          </div>
                        )}
                        {/* Payment section — cargo sender only */}
                        {user?.role === "CARGO_SENDER" && ["ACCEPTED", "IN_TRANSIT"].includes(booking.status) && (() => {
                          const pmt = payments[booking.id];
                          if (pmt?.status === "COMPLETED") {
                            return (
                              <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "700", padding: "5px 12px", borderRadius: "20px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                                ✓ Paid
                              </span>
                            );
                          }
                          if (pmt?.status === "FAILED") {
                            return (
                              <button onClick={() => { setPaymentModal(booking); setPaymentMsg(""); setWaafiPhone(""); }}
                                style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                                Payment Failed — Try Again
                              </button>
                            );
                          }
                          if (pmt?.status === "PROCESSING") {
                            return (
                              <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{ fontSize: "12px", color: "#6b7280", padding: "5px 10px", borderRadius: "20px", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                                  Awaiting Payment
                                </span>
                                <button onClick={() => { setPaymentModal(booking); setPaymentMsg(""); setWaafiPhone(""); }}
                                  style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--primary)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                                  Check / Retry
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button onClick={() => { setPaymentModal(booking); setPaymentMsg(""); setWaafiPhone(""); }}
                              style={{ marginLeft: "auto", padding: "9px 20px", borderRadius: "8px", border: "none", background: "var(--primary)", color: "#FAFAF8", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                              💳 Pay
                            </button>
                          );
                        })()}
                        {booking.status === "COMPLETED" && (() => {
                          const hasRated = user?.role === "CARGO_SENDER" ? !!booking.senderRatedAt : !!booking.ownerRatedAt;
                          return hasRated ? (
                            <div style={{ marginLeft: "auto", fontSize: "12px", color: "#16a34a", fontWeight: "600", padding: "7px 16px", borderRadius: "99px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                              ★ Rated
                            </div>
                          ) : (
                            <button onClick={() => { setRateModal(booking); setRateValue(0); setRateComment(""); }} style={{ marginLeft: "auto", padding: "9px 20px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                              ★ Rate
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Payment Modal */}
      {paymentModal && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "16px", width: "100%", maxWidth: "440px", padding: "28px" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary)", marginBottom: "4px" }}>Pay for Delivery</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              {paymentModal.load?.title} · <strong>${paymentModal.agreedPrice} {paymentModal.currency}</strong>
            </div>

            {/* Chapa */}
            <div style={{ border: "1.5px solid #bbf7d0", borderRadius: "12px", padding: "16px", marginBottom: "12px" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>🏦 Pay with Chapa</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>For Ethiopian Birr (ETB) — TeleBirr, CBE, Awash Bank</div>
              <button
                onClick={() => handleInitiatePayment(paymentModal, "CHAPA")}
                disabled={paymentLoading}
                style={{ width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: "#16a34a", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", opacity: paymentLoading ? 0.7 : 1 }}>
                Pay with Chapa →
              </button>
              {payments[paymentModal.id]?.provider === "CHAPA" && payments[paymentModal.id]?.status === "PROCESSING" && (
                <button onClick={() => handleVerifyChapa(paymentModal.id)} disabled={paymentLoading}
                  style={{ width: "100%", marginTop: "8px", padding: "9px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--primary)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                  I've completed payment — Verify
                </button>
              )}
            </div>

            {/* Waafi */}
            <div style={{ border: "1.5px solid #BBD0FF", borderRadius: "12px", padding: "16px", marginBottom: "12px" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>📱 Pay with Waafi</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>For EVC Plus / Telesom ZAAD (USD)</div>
              <input
                value={waafiPhone}
                onChange={e => setWaafiPhone(e.target.value)}
                placeholder="e.g. 0611234567"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px", color: "var(--primary)", marginBottom: "8px", boxSizing: "border-box" as const, outline: "none" }}
              />
              <button
                onClick={() => handleInitiatePayment(paymentModal, "WAAFI", waafiPhone)}
                disabled={paymentLoading || !waafiPhone.trim()}
                style={{ width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: "#3D7BFF", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", opacity: (!waafiPhone.trim() || paymentLoading) ? 0.6 : 1 }}>
                Send Payment Request
              </button>
            </div>

            {/* Cash */}
            <div style={{ border: "1.5px solid #e5e7eb", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>💵 Cash on Delivery</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>Pay the driver directly upon delivery</div>
              <button
                onClick={() => handleInitiatePayment(paymentModal, "CASH")}
                disabled={paymentLoading}
                style={{ width: "100%", padding: "11px", borderRadius: "9px", border: "1px solid var(--border)", background: "#f9fafb", color: "#374151", fontSize: "13px", fontWeight: "700", cursor: "pointer", opacity: paymentLoading ? 0.7 : 1 }}>
                Confirm Cash Payment
              </button>
            </div>

            {paymentMsg && (
              <div style={{ padding: "10px 14px", borderRadius: "9px", background: paymentMsg.includes("fail") || paymentMsg.includes("Failed") ? "#fef2f2" : "#f0fdf4", color: paymentMsg.includes("fail") || paymentMsg.includes("Failed") ? "#dc2626" : "#16a34a", fontSize: "13px", fontWeight: "600", marginBottom: "12px" }}>
                {paymentMsg}
              </div>
            )}

            <button onClick={() => { setPaymentModal(null); setPaymentMsg(""); setWaafiPhone(""); }}
              style={{ width: "100%", padding: "11px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Rate Modal */}
      {rateModal && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "28px" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary)", marginBottom: "4px" }}>Rate this booking</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              {user?.role === "CARGO_SENDER" ? `Rating: ${rateModal.owner?.fullName}` : `Rating: ${rateModal.sender?.fullName || "Cargo sender"}`}
            </div>
            {/* Stars */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", justifyContent: "center" }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setRateValue(star)}
                  style={{ fontSize: "32px", background: "none", border: "none", cursor: "pointer", color: star <= rateValue ? "var(--accent)" : "var(--border)", transition: "color 0.1s", lineHeight: 1 }}>
                  ★
                </button>
              ))}
            </div>
            <textarea value={rateComment} onChange={e => setRateComment(e.target.value)} placeholder="Leave a comment (optional)..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px", color: "var(--primary)", minHeight: "80px", resize: "vertical", outline: "none", marginBottom: "16px", boxSizing: "border-box" as const }} />
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setRateModal(null); setRateValue(0); setRateComment(""); }} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleRate} disabled={rateValue === 0 || rateLoading} style={{ flex: 2, padding: "11px", borderRadius: "9px", border: "none", background: "var(--primary)", color: "#FAFAF8", fontSize: "13px", fontWeight: "700", cursor: rateValue === 0 ? "not-allowed" : "pointer", opacity: rateValue === 0 ? 0.6 : 1 }}>
                {rateLoading ? "Submitting..." : `Submit ${rateValue > 0 ? rateValue + "★" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Driver Modal */}
      {assignModal && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "28px" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary)", marginBottom: "16px" }}>Assign Driver</div>
            <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px", color: "var(--primary)", marginBottom: "16px", outline: "none" }}>
              <option value="">Select a driver...</option>
              {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.fullName} — {d.phone}</option>)}
            </select>
            {drivers.length === 0 && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>No drivers yet. Add drivers from My Drivers page.</div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setAssignModal(null); setSelectedDriver(""); }} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAssignDriver} disabled={!selectedDriver} style={{ flex: 2, padding: "11px", borderRadius: "9px", border: "none", background: "var(--primary)", color: "#FAFAF8", fontSize: "13px", fontWeight: "700", cursor: !selectedDriver ? "not-allowed" : "pointer", opacity: !selectedDriver ? 0.6 : 1 }}>
                Assign Driver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
