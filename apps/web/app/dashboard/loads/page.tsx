"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useGateStore } from "@/lib/store";
import api from "@/lib/api";

const P = "var(--primary)";
const A = "var(--accent)";

const TRUCK_TYPES = ["FLATBED","REFRIGERATED","TANKER","CONTAINER","OPEN_BODY","MINI_TRUCK"];
const COUNTRIES   = ["ETHIOPIA","SOMALIA","DJIBOUTI"];

const statusStyle: any = {
  OPEN:       { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0", label: "Open" },
  BOOKED:     { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE", label: "Booked" },
  IN_TRANSIT: { bg: "#FFF7ED", color: "#C2791A", border: "#FED7AA", label: "In Transit" },
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
    } catch (err: any) { setEditError(err.response?.data?.message || "Failed to update"); }
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
      showToast(err.response?.data?.message || "Delete failed");
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
      showToast("Bid placed successfully!");
    } catch (err: any) { setBidError(err.response?.data?.message || "Bid failed"); }
    finally { setBidLoading(false); }
  };

  const canEdit   = (l: any) => user?.role === "CARGO_SENDER" && ["OPEN","DRAFT"].includes(l.status);
  const canDelete = (l: any) => user?.role === "CARGO_SENDER" && ["OPEN","DRAFT","CANCELLED"].includes(l.status);

  if (loading) return (
    <div>
      <div className="sk" style={{ height: "28px", width: "180px", marginBottom: "6px" }} />
      <div className="sk" style={{ height: "16px", width: "120px", marginBottom: "28px" }} />
      {[1,2,3,4,5].map(i => <div key={i} className="sk" style={{ height: "80px", marginBottom: "10px", borderRadius: "12px" }} />)}
    </div>
  );

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", background: P, color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>
            {user?.role === "CARGO_SENDER" ? "My Loads" : "Available Loads"}
          </h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>{loads.length} total</div>
        </div>
        {user?.role === "CARGO_SENDER" && (
          <button onClick={() => { if (user?.status !== "ACTIVE") { openGate(); return; } router.push("/dashboard/loads/new"); }}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: P, color: "#fff", padding: "11px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer", minHeight: "44px" }}>
            <IconPlus />Post New Load
          </button>
        )}
      </div>

      {/* Loads list */}
      {loads.length === 0 ? (
        <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "72px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>📦</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: P, marginBottom: "8px" }}>No loads found</div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{user?.role === "CARGO_SENDER" ? "Post your first load to get started." : "Check back soon for available loads."}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {loads.map((load: any) => (
            <div key={load.id} onClick={() => router.push(`/dashboard/loads/${load.id}`)}
              style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--border)", padding: "18px 20px", cursor: "pointer" }}
              onMouseOver={e => (e.currentTarget.style.background = "var(--bg)")}
              onMouseOut={e => (e.currentTarget.style.background = "var(--surface)")}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: P }}>
                      {load.title}
                    </div>
                    <StatusBadge status={load.status} />
                    {(load._count?.bids > 0) && (
                      <span style={{ fontSize: "11px", fontWeight: "600", color: A, background: `rgba(232,160,32,0.1)`, padding: "2px 8px", borderRadius: "99px" }}>
                        {load._count.bids} bid{load._count.bids !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-secondary)", flexWrap: "wrap" }}>
                    <span>{load.pickupCity} <span style={{ color: A, fontWeight: "700" }}>→</span> {load.deliveryCity}</span>
                    <span>·</span>
                    <span>{load.weightTons}t</span>
                    <span>·</span>
                    <span>{load.truckTypeNeeded?.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span style={{ fontWeight: "600", color: P }}>${load.offeredPrice}</span>
                    <span>·</span>
                    <span>{new Date(load.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                  {canEdit(load) && (
                    <button onClick={e => { e.stopPropagation(); openEdit(load); }} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#EFF6FF", border: "none", borderRadius: "7px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#2563EB", cursor: "pointer", minHeight: "32px" }}>
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
                      Place Bid
                    </button>
                  )}
                  {user?.role === "TRUCK_OWNER" && biddedIds.includes(load.id) && (
                    <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>✓ Bid Placed</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BID MODAL ── */}
      {bidLoad && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "20px", width: "100%", maxWidth: "440px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: P }}>Place a Bid</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{bidLoad.title}</div>
              </div>
              <button onClick={() => setBidLoad(null)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}><IconX /></button>
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ background: "var(--bg)", borderRadius: "12px", padding: "14px", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {bidLoad.pickupCity} <span style={{ color: A, fontWeight: "700" }}>→</span> {bidLoad.deliveryCity} · {bidLoad.weightTons}t
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Sender's price: <span style={{ fontWeight: "700", color: P }}>${bidLoad.offeredPrice}</span>
                </div>
              </div>

              {bidError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#DC2626" }}>{bidError}</div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label style={lbl}>Select Truck *</label>
                <select style={inp} value={bidTruck} onChange={e => setBidTruck(e.target.value)}>
                  <option value="">Choose a truck...</option>
                  {trucks.filter((t: any) => t.isAvailable).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.plateNumber} — {t.truckType?.replace(/_/g, " ")} ({t.capacityTons}t)</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={lbl}>Your Bid Price (USD) *</label>
                <input style={inp} type="number" min="1" placeholder="Enter your price" value={bidPrice} onChange={e => setBidPrice(e.target.value)} />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={lbl}>Message (optional)</label>
                <textarea style={{ ...inp, minHeight: "72px", resize: "vertical" }} placeholder="Tell the sender about your truck and experience..." value={bidMsg} onChange={e => setBidMsg(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setBidLoad(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button onClick={submitBid} disabled={bidLoading || !bidTruck || !bidPrice}
                  style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: P, color: "#fff", fontSize: "13px", fontWeight: "700", cursor: (bidLoading || !bidTruck || !bidPrice) ? "not-allowed" : "pointer", opacity: (bidLoading || !bidTruck || !bidPrice) ? 0.6 : 1 }}>
                  {bidLoading ? "Placing Bid..." : "Submit Bid"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editLoad && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "20px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "16px", fontWeight: "800", color: P }}>Edit Load</div>
              <button onClick={() => setEditLoad(null)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}><IconX /></button>
            </div>
            <div style={{ padding: "24px" }}>
              {editError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#DC2626" }}>{editError}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
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
                  <label style={lbl}>Truck Type</label>
                  <select style={inp} value={editForm.truckTypeNeeded} onChange={e => setEditForm((p: any) => ({ ...p, truckTypeNeeded: e.target.value }))}>
                    {TRUCK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Pickup City</label>
                  <input style={inp} value={editForm.pickupCity} onChange={e => setEditForm((p: any) => ({ ...p, pickupCity: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Pickup Country</label>
                  <select style={inp} value={editForm.pickupCountry} onChange={e => setEditForm((p: any) => ({ ...p, pickupCountry: e.target.value }))}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Delivery City</label>
                  <input style={inp} value={editForm.deliveryCity} onChange={e => setEditForm((p: any) => ({ ...p, deliveryCity: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Delivery Country</label>
                  <select style={inp} value={editForm.deliveryCountry} onChange={e => setEditForm((p: any) => ({ ...p, deliveryCountry: e.target.value }))}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Price (USD)</label>
                  <input style={inp} type="number" value={editForm.offeredPrice} onChange={e => setEditForm((p: any) => ({ ...p, offeredPrice: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label style={lbl}>Scheduled Date</label>
                  <input style={inp} type="date" value={editForm.scheduledDate} onChange={e => setEditForm((p: any) => ({ ...p, scheduledDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <button onClick={() => setEditLoad(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button onClick={submitEdit} disabled={editLoading} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: P, color: "#fff", fontSize: "13px", fontWeight: "700", cursor: editLoading ? "not-allowed" : "pointer", opacity: editLoading ? 0.7 : 1 }}>
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "20px", width: "100%", maxWidth: "400px", padding: "28px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 0 16px", color: "#DC2626" }}><IconTrash /></div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: P, marginBottom: "8px" }}>Delete this load?</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px", lineHeight: "1.6" }}>This action cannot be undone. The load will be permanently removed.</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleteLoading} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#DC2626", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: deleteLoading ? "not-allowed" : "pointer", opacity: deleteLoading ? 0.7 : 1 }}>
                {deleteLoading ? "Deleting..." : "Delete Load"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
