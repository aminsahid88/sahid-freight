"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useGateStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { formatPrice, formatDate } from "@/lib/format";
import { Package, ArrowRight, Truck, CheckCircle2 } from "lucide-react";

const P = "var(--primary)";
const A = "var(--accent)";

const TRUCK_TYPES = ["FLATBED","REFRIGERATED","TANKER","CONTAINER","OPEN_BODY","MINI_TRUCK"];
const COUNTRIES   = ["ETHIOPIA","SOMALIA","DJIBOUTI"];

const statusStyle: any = {
  OPEN:       { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0", label: "Open" },
  BOOKED:     { bg: "#E8F0FF", color: "#3D7BFF", border: "#BBD0FF", label: "Booked" },
  IN_TRANSIT: { bg: "#FFF7ED", color: "#C2791A", border: "#FED7AA", label: "In transit" },
  DELIVERED:  { bg: "#F0FDF4", color: "#15803D", border: "#86EFAC", label: "Delivered" },
  CANCELLED:  { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Cancelled" },
  DRAFT:      { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Draft" },
};
const StatusBadge = ({ status }: { status: string }) => {
  const s = statusStyle[status] || { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: status };
  return <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>;
};

const inp  = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13px", color: "var(--text)", outline: "none", background: "var(--surface)", boxSizing: "border-box" as const };
const lbl  = { fontSize: "12px", fontWeight: "600" as const, color: "var(--text-secondary)", marginBottom: "5px", display: "block" as const };

const IconPlus  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
const IconX     = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
const IconEdit  = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
const IconTrash = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>);

export default function LoadsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { openGate } = useGateStore();
  const [loads, setLoads]   = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]   = useState("");

  // Bid modal state (truck owners)
  const [bidLoad, setBidLoad]     = useState<any | null>(null);
  const [bidPrice, setBidPrice]   = useState("");
  const [bidMsg, setBidMsg]       = useState("");
  const [bidTruck, setBidTruck]   = useState("");
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError]   = useState("");
  const [biddedIds, setBiddedIds] = useState<string[]>([]);

  // Edit modal
  const [editLoad, setEditLoad]   = useState<any | null>(null);
  const [editForm, setEditForm]   = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { if (!user) { router.push("/auth/login"); return; } fetchData(); }, [user]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchData = async () => {
    try {
      if (user?.role === "CARGO_SENDER") {
        const res = await api.get("/loads/my");
        setLoads(res.data.loads || []);
      } else if (user?.role === "TRUCK_OWNER") {
        const [loadsRes, trucksRes, bidsRes] = await Promise.all([
          api.get("/loads"),
          api.get("/trucks/my"),
          api.get("/bids/my"),
        ]);
        setLoads(loadsRes.data.loads || []);
        setTrucks(trucksRes.data.trucks || []);
        setBiddedIds((bidsRes.data.bids || []).map((b: any) => b.loadId));
      } else {
        const res = await api.get("/loads");
        setLoads(res.data.loads || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openEdit = (load: any) => {
    setEditLoad(load);
    setEditForm({
      title: load.title, description: load.description || "",
      weightTons: load.weightTons, truckTypeNeeded: load.truckTypeNeeded,
      pickupCity: load.pickupCity, pickupCountry: load.pickupCountry,
      deliveryCity: load.deliveryCity, deliveryCountry: load.deliveryCountry,
      offeredPrice: load.offeredPrice, currency: load.currency,
      scheduledDate: load.scheduledDate?.split("T")[0] || "",
    });
    setEditError("");
  };

  const submitEdit = async () => {
    setEditLoading(true); setEditError("");
    try {
      const res = await api.patch(`/loads/${editLoad.id}`, editForm);
      setLoads(prev => prev.map(l => l.id === editLoad.id ? res.data.load : l));
      setEditLoad(null);
      showToast("Load updated");
    } catch (err: any) { setEditError(formatApiError(err, "We couldn't save your changes. Please try again.", "load")); }
    finally { setEditLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    const prevLoads = loads;
    // Optimistic: remove from list immediately
    setLoads(prev => prev.filter(l => l.id !== deleteId));
    setDeleteId(null);
    try {
      await api.delete(`/loads/${deleteId}`);
      showToast("Load deleted");
    } catch (err: any) {
      setLoads(prevLoads); // Revert on failure
      showToast(formatApiError(err, "We couldn't delete this load. Please try again.", "load"));
    }
    finally { setDeleteLoading(false); }
  };

  const submitBid = async () => {
    if (!bidTruck || !bidPrice) return;
    setBidLoading(true); setBidError("");
    try {
      await api.post("/bids", { loadId: bidLoad.id, truckId: bidTruck, price: Number(bidPrice), currency: "USD", message: bidMsg });
      setBiddedIds(prev => [...prev, bidLoad.id]);
      setBidLoad(null); setBidPrice(""); setBidMsg(""); setBidTruck("");
      showToast("Offer sent — the cargo owner has been notified.");
    } catch (err: any) { setBidError(formatApiError(err, "We couldn't send your offer. Please try again.", "load")); }
    finally { setBidLoading(false); }
  };

  const canEdit   = (l: any) => user?.role === "CARGO_SENDER" && ["OPEN","DRAFT"].includes(l.status);
  const canDelete = (l: any) => user?.role === "CARGO_SENDER" && ["OPEN","DRAFT","CANCELLED"].includes(l.status);

  if (loading) return (
    <div>
      <style>{`@keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.sk{background:linear-gradient(90deg,#EDEBE6 25%,#E4E0D8 50%,#EDEBE6 75%);background-size:2000px 100%;animation:shimmer 1.5s infinite;border-radius:10px;}`}</style>
      <div className="sk" style={{ height: "28px", width: "180px", marginBottom: "6px" }} />
      <div className="sk" style={{ height: "16px", width: "120px", marginBottom: "28px" }} />
      {[1,2,3,4,5].map(i => <div key={i} className="sk" style={{ height: "80px", marginBottom: "10px", borderRadius: "12px" }} />)}
    </div>
  );

  return (
    <div>
      <style>{`
        @media (max-width: 640px) {
          .sender-loads-toast { top: auto !important; bottom: 80px !important; left: 16px !important; right: 16px !important; text-align: center; }
          .sender-loads-header { flex-wrap: wrap !important; gap: 12px !important; margin-bottom: 20px !important; }
          .sender-loads-header h1 { font-size: 20px !important; }
          .sender-loads-post-btn { width: 100% !important; justify-content: center !important; }
          .sender-load-card { padding: 14px 16px !important; }
          .sender-load-card-inner { flex-direction: column !important; align-items: stretch !important; }
          .sender-load-actions { justify-content: flex-start !important; flex-wrap: wrap !important; }
          .sender-load-actions button { flex: 1 1 auto !important; min-height: 44px !important; }
          .sender-modal-overlay { padding: 0 !important; align-items: flex-end !important; }
          .sender-modal { max-width: 100% !important; width: 100% !important; margin: 0 !important; border-radius: 20px 20px 0 0 !important; max-height: 92vh !important; }
          .sender-modal-body { padding: 18px !important; }
          .sender-edit-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .sender-modal-btn { min-height: 44px !important; }
          .sender-empty { padding: 48px 20px !important; }
        }
        @media (max-width: 380px) {
          .sender-loads-header h1 { font-size: 18px !important; }
        }
      `}</style>
      {/* Toast */}
      {toast && (
        <div className="sender-loads-toast" style={{ position: "fixed", top: "24px", right: "24px", background: P, color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="sender-loads-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>
            {user?.role === "CARGO_SENDER" ? "My loads" : "Available loads"}
          </h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {user?.role === "CARGO_SENDER"
              ? "Every load you've posted, in one place."
              : "Loads posted by cargo owners that match your trucks."}
          </div>
        </div>
        {user?.role === "CARGO_SENDER" && (
          <button className="sender-loads-post-btn" onClick={() => { if (user?.status !== "ACTIVE") { openGate(); return; } router.push("/dashboard/loads/new"); }}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: P, color: "#fff", padding: "11px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer", minHeight: "44px", transition: "opacity 0.15s" }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseOut={e => (e.currentTarget.style.opacity = "1")}>
            <IconPlus />Post load
          </button>
        )}
      </div>

      {/* Loads list */}
      {loads.length === 0 ? (
        <div className="sender-empty" style={{ background: "var(--surface)", borderRadius: "16px", padding: "72px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
          <div style={{ display: "inline-flex", padding: "16px", borderRadius: "16px", background: "var(--bg)", marginBottom: "16px", color: "#94A3B8" }}>
            <Package size={36} />
          </div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: P, marginBottom: "8px" }}>
            {user?.role === "CARGO_SENDER" ? "No loads yet" : "Nothing available in your area right now"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "380px", margin: "0 auto" }}>
            {user?.role === "CARGO_SENDER"
              ? "Post your first load and a broker will match it with a verified truck."
              : "When new loads matching your trucks are posted, they'll appear here."}
          </div>
          {user?.role === "CARGO_SENDER" && (
            <button onClick={() => { if (user?.status !== "ACTIVE") { openGate(); return; } router.push("/dashboard/loads/new"); }}
              style={{ marginTop: "20px", background: P, color: "#fff", border: "none", borderRadius: "10px", padding: "11px 22px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
              Post load
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {loads.map((load: any) => (
            <div key={load.id} onClick={() => router.push(`/dashboard/loads/${load.id}`)} className="sender-load-card"
              style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--border)", padding: "18px 20px", cursor: "pointer" }}
              onMouseOver={e => (e.currentTarget.style.background = "var(--bg)")}
              onMouseOut={e => (e.currentTarget.style.background = "var(--surface)")}>
              <div className="sender-load-card-inner" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: P }}>
                      {load.title}
                    </div>
                    <StatusBadge status={load.status} />
                    {(load._count?.bids > 0) && (
                      <span style={{ fontSize: "11px", fontWeight: "600", color: A, background: `rgba(245,158,11,0.1)`, padding: "2px 8px", borderRadius: "99px" }}>
                        {load._count.bids} bid{load._count.bids !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-secondary)", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>{load.pickupCity} <ArrowRight size={12} color={A} /> {load.deliveryCity}</span>
                    <span>·</span>
                    <span>{load.weightTons}t</span>
                    <span>·</span>
                    <span>{load.truckTypeNeeded?.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span style={{ fontWeight: "600", color: P }}>{formatPrice(load.offeredPrice, load.currency)}</span>
                    <span>·</span>
                    <span>{formatDate(load.scheduledDate, { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
                <div className="sender-load-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                  {canEdit(load) && (
                    <button onClick={e => { e.stopPropagation(); openEdit(load); }} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#E8F0FF", border: "none", borderRadius: "7px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#3D7BFF", cursor: "pointer", minHeight: "32px" }}>
                      <IconEdit />Edit
                    </button>
                  )}
                  {canDelete(load) && (
                    <button onClick={e => { e.stopPropagation(); setDeleteId(load.id); }} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#FEF2F2", border: "none", borderRadius: "7px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#DC2626", cursor: "pointer", minHeight: "32px" }}>
                      <IconTrash />Delete
                    </button>
                  )}
                  {user?.role === "TRUCK_OWNER" && !biddedIds.includes(load.id) && (
                    <button onClick={e => { e.stopPropagation(); if (user?.status !== "ACTIVE") { openGate(); return; } setBidLoad(load); setBidError(""); setBidPrice(String(load.offeredPrice)); setBidMsg(""); setBidTruck(""); }}
                      style={{ background: P, border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: "700", color: "#fff", cursor: "pointer", minHeight: "36px" }}>
                      Send offer
                    </button>
                  )}
                  {user?.role === "TRUCK_OWNER" && biddedIds.includes(load.id) && (
                    <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={13} /> Offer sent
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BID MODAL ── */}
      {bidLoad && (
        <div className="sender-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="sender-modal" style={{ background: "var(--surface)", borderRadius: "20px", width: "100%", maxWidth: "440px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: P }}>Send an offer</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{bidLoad.title}</div>
              </div>
              <button onClick={() => setBidLoad(null)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0 }}><IconX /></button>
            </div>
            <div className="sender-modal-body" style={{ padding: "24px" }}>
              <div style={{ background: "var(--bg)", borderRadius: "12px", padding: "14px", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  {bidLoad.pickupCity} <ArrowRight size={12} color={A} /> {bidLoad.deliveryCity} · {bidLoad.weightTons}t
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Cargo owner's price: <span style={{ fontWeight: "700", color: P }}>{formatPrice(bidLoad.offeredPrice, bidLoad.currency)}</span>
                </div>
              </div>

              {bidError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#DC2626" }}>{bidError}</div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label style={lbl}>Select truck *</label>
                <select style={inp} value={bidTruck} onChange={e => setBidTruck(e.target.value)}>
                  <option value="">Choose a truck...</option>
                  {trucks.filter((t: any) => t.isAvailable).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.plateNumber} — {t.truckType?.replace(/_/g, " ")} ({t.capacityTons}t)</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={lbl}>Your price (USD) *</label>
                <input style={inp} type="number" min="1" placeholder="Enter your price" value={bidPrice} onChange={e => setBidPrice(e.target.value)} />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={lbl}>Message (optional)</label>
                <textarea style={{ ...inp, minHeight: "72px", resize: "vertical" }} placeholder="Tell the cargo owner about your truck and experience..." value={bidMsg} onChange={e => setBidMsg(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button className="sender-modal-btn" onClick={() => setBidLoad(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button className="sender-modal-btn" onClick={submitBid} disabled={bidLoading || !bidTruck || !bidPrice}
                  style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: P, color: "#fff", fontSize: "13px", fontWeight: "700", cursor: (bidLoading || !bidTruck || !bidPrice) ? "not-allowed" : "pointer", opacity: (bidLoading || !bidTruck || !bidPrice) ? 0.6 : 1 }}>
                  {bidLoading ? "Sending offer…" : "Send offer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editLoad && (
        <div className="sender-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="sender-modal" style={{ background: "var(--surface)", borderRadius: "20px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "16px", fontWeight: "800", color: P }}>Edit load</div>
              <button onClick={() => setEditLoad(null)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0 }}><IconX /></button>
            </div>
            <div className="sender-modal-body" style={{ padding: "24px" }}>
              {editError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#DC2626" }}>{editError}</div>}
              <div className="sender-edit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Title</label>
                  <input style={inp} value={editForm.title} onChange={e => setEditForm((p: any) => ({ ...p, title: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Description</label>
                  <textarea style={{ ...inp, minHeight: "72px", resize: "vertical" }} value={editForm.description} onChange={e => setEditForm((p: any) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Weight (tons)</label>
                  <input style={inp} type="number" value={editForm.weightTons} onChange={e => setEditForm((p: any) => ({ ...p, weightTons: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label style={lbl}>Truck type</label>
                  <select style={inp} value={editForm.truckTypeNeeded} onChange={e => setEditForm((p: any) => ({ ...p, truckTypeNeeded: e.target.value }))}>
                    {TRUCK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Pickup city</label>
                  <input style={inp} value={editForm.pickupCity} onChange={e => setEditForm((p: any) => ({ ...p, pickupCity: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Pickup country</label>
                  <select style={inp} value={editForm.pickupCountry} onChange={e => setEditForm((p: any) => ({ ...p, pickupCountry: e.target.value }))}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Delivery city</label>
                  <input style={inp} value={editForm.deliveryCity} onChange={e => setEditForm((p: any) => ({ ...p, deliveryCity: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Delivery country</label>
                  <select style={inp} value={editForm.deliveryCountry} onChange={e => setEditForm((p: any) => ({ ...p, deliveryCountry: e.target.value }))}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Price (USD)</label>
                  <input style={inp} type="number" value={editForm.offeredPrice} onChange={e => setEditForm((p: any) => ({ ...p, offeredPrice: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label style={lbl}>Scheduled date</label>
                  <input style={inp} type="date" value={editForm.scheduledDate} onChange={e => setEditForm((p: any) => ({ ...p, scheduledDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <button className="sender-modal-btn" onClick={() => setEditLoad(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button className="sender-modal-btn" onClick={submitEdit} disabled={editLoading} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: P, color: "#fff", fontSize: "13px", fontWeight: "700", cursor: editLoading ? "not-allowed" : "pointer", opacity: editLoading ? 0.7 : 1 }}>
                  {editLoading ? "Saving changes…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteId && (
        <div className="sender-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="sender-modal" style={{ background: "var(--surface)", borderRadius: "20px", width: "100%", maxWidth: "400px", padding: "28px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 0 16px", color: "#DC2626" }}><IconTrash /></div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: P, marginBottom: "8px" }}>Delete this load?</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px", lineHeight: "1.6" }}>This can't be undone. The broker won't be able to dispatch a truck to it after this.</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="sender-modal-btn" onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Keep load</button>
              <button className="sender-modal-btn" onClick={confirmDelete} disabled={deleteLoading} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#DC2626", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: deleteLoading ? "not-allowed" : "pointer", opacity: deleteLoading ? 0.7 : 1 }}>
                {deleteLoading ? "Deleting…" : "Delete load"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
