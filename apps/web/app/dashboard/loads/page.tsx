"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

const TRUCK_TYPES = ["FLATBED","REFRIGERATED","TANKER","CONTAINER","OPEN_BODY","MINI_TRUCK"];
const COUNTRIES = ["Ethiopia","Somalia","Djibouti"];

const IconEdit = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
const IconTrash = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>);
const IconPin = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>);
const IconWeight = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 00-1.905 1.46L2.1 18.5A2 2 0 004 21h16a2 2 0 001.9-2.54L19.4 9.46A2 2 0 0017.5 8z"/></svg>);
const IconPlus = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
const IconX = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
const IconPackage = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);

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

const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", color: "#1a2744", outline: "none", background: "#fff", boxSizing: "border-box" as const };
const labelStyle = { fontSize: "12px", fontWeight: "600" as const, color: "#6b7280", marginBottom: "5px", display: "block" as const };

export default function LoadsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loads, setLoads] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoad, setBookingLoad] = useState<any | null>(null);
  const [selectedTruck, setSelectedTruck] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookedIds, setBookedIds] = useState<string[]>([]);
  const [editLoad, setEditLoad] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
  }, [user]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchData = async () => {
    try {
      if (user?.role === "CARGO_SENDER") {
        const res = await api.get("/loads/my");
        setLoads(res.data.loads || []);
      } else if (user?.role === "TRUCK_OWNER") {
        const [loadsRes, trucksRes, bookingsRes] = await Promise.all([
          api.get("/loads"),
          api.get("/trucks/my"),
          api.get("/bookings/my"),
        ]);
        setLoads(loadsRes.data.loads || []);
        setTrucks(trucksRes.data.trucks || []);
        setBookedIds((bookingsRes.data.bookings || []).map((b: any) => b.loadId));
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
      title: load.title,
      description: load.description || "",
      weightTons: load.weightTons,
      truckTypeNeeded: load.truckTypeNeeded,
      pickupCity: load.pickupCity,
      pickupCountry: load.pickupCountry,
      deliveryCity: load.deliveryCity,
      deliveryCountry: load.deliveryCountry,
      offeredPrice: load.offeredPrice,
      currency: load.currency,
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
      showToast("Load updated successfully");
    } catch (err: any) {
      setEditError(err.response?.data?.message || "Failed to update");
    } finally { setEditLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/loads/${deleteId}`);
      setLoads(prev => prev.filter(l => l.id !== deleteId));
      setDeleteId(null);
      showToast("Load deleted");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to delete");
      setDeleteId(null);
    } finally { setDeleteLoading(false); }
  };

  const handleBook = async () => {
    if (!selectedTruck || !bookingLoad) return;
    setBookingLoading(true); setBookingError("");
    try {
      await api.post("/bookings", { loadId: bookingLoad.id, truckId: selectedTruck, agreedPrice: bookingLoad.offeredPrice });
      setBookedIds(prev => [...prev, bookingLoad.id]);
      setBookingLoad(null); setSelectedTruck("");
      showToast("Booking application sent!");
    } catch (err: any) {
      setBookingError(err.response?.data?.message || "Booking failed");
    } finally { setBookingLoading(false); }
  };

  const canEdit = (load: any) => user?.role === "CARGO_SENDER" && ["OPEN","DRAFT"].includes(load.status);
  const canDelete = (load: any) => user?.role === "CARGO_SENDER" && ["OPEN","DRAFT","CANCELLED"].includes(load.status);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ textAlign: "center" as const }}>
        <div style={{ width: "34px", height: "34px", border: "3px solid #e8e3d8", borderTop: "3px solid #1a2744", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", fontFamily: "'Helvetica Neue', Arial, sans-serif", padding: "32px 36px" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed" as const, top: "24px", right: "24px", background: "#1a2744", color: "#f0ebe0", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1a2744", letterSpacing: "-0.5px" }}>
            {user?.role === "CARGO_SENDER" ? "My Loads" : "Available Loads"}
          </h1>
          <div style={{ fontSize: "13px", color: "#9e9890", marginTop: "3px" }}>{loads.length} total</div>
        </div>
        {user?.role === "CARGO_SENDER" && (
          <button onClick={() => router.push("/dashboard/loads/new")} style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1a2744", color: "#f0ebe0", padding: "10px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer" }}>
            <IconPlus />Post New Load
          </button>
        )}
      </div>

      {/* Table */}
      {loads.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "72px 24px", textAlign: "center" as const, border: "1px solid #ede9e0" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#f5f3ef", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#c8c0b0" }}><IconPackage /></div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", marginBottom: "7px" }}>No loads found</div>
          <div style={{ fontSize: "13px", color: "#9e9890" }}>{user?.role === "CARGO_SENDER" ? "Post your first load to get started." : "Check back soon for available loads."}</div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #ede9e0", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 190px 90px 110px 100px 90px", padding: "9px 20px", background: "#faf8f4", borderBottom: "1px solid #f0ede6" }}>
            {["Load", "Route", "Weight", "Truck Type", "Price", "Status"].map(h => (
              <span key={h} style={{ fontSize: "10px", fontWeight: "700", color: "#b0a898", textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>{h}</span>
            ))}
          </div>
          {loads.map((load: any, i: number) => (
            <div key={load.id} style={{ display: "grid", gridTemplateColumns: "1fr 190px 90px 110px 100px 90px", padding: "14px 20px", borderBottom: i < loads.length - 1 ? "1px solid #faf8f4" : "none", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{load.title}</div>
                <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "2px" }}>{new Date(load.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                {/* Edit/Delete buttons */}
                {(canEdit(load) || canDelete(load)) && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    {canEdit(load) && (
                      <button onClick={() => openEdit(load)} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#eff6ff", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: "600", color: "#2563eb", cursor: "pointer" }}>
                        <IconEdit />Edit
                      </button>
                    )}
                    {canDelete(load) && (
                      <button onClick={() => setDeleteId(load.id)} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#fef2f2", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: "600", color: "#dc2626", cursor: "pointer" }}>
                        <IconTrash />Delete
                      </button>
                    )}
                  </div>
                )}
                {/* Book button for truck owners */}
                {user?.role === "TRUCK_OWNER" && !bookedIds.includes(load.id) && (
                  <button onClick={() => { setBookingLoad(load); setBookingError(""); }} style={{ marginTop: "6px", background: "#1a2744", border: "none", borderRadius: "6px", padding: "4px 12px", fontSize: "11px", fontWeight: "600", color: "#f0ebe0", cursor: "pointer" }}>
                    Apply
                  </button>
                )}
                {user?.role === "TRUCK_OWNER" && bookedIds.includes(load.id) && (
                  <span style={{ marginTop: "6px", display: "inline-block", fontSize: "11px", color: "#16a34a", fontWeight: "600" }}>Applied</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#4b5563" }}>
                <IconPin /><span>{load.pickupCity}</span><span style={{ color: "#c8901e", fontWeight: "700", margin: "0 2px" }}>→</span><span>{load.deliveryCity}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}><IconWeight />{load.weightTons}t</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>{load.truckTypeNeeded?.replace(/_/g, " ")}</div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a2744" }}>${load.offeredPrice}</div>
              <StatusBadge status={load.status} />
            </div>
          ))}
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editLoad && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto" as const, boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0ede6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#1a2744" }}>Edit Load</div>
                <div style={{ fontSize: "12px", color: "#9e9890", marginTop: "2px" }}>{editLoad.title}</div>
              </div>
              <button onClick={() => setEditLoad(null)} style={{ background: "#f5f3ef", border: "none", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}><IconX /></button>
            </div>
            <div style={{ padding: "24px" }}>
              {editError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#dc2626" }}>{editError}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Title</label>
                  <input style={inputStyle} value={editForm.title} onChange={e => setEditForm((p: any) => ({ ...p, title: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea style={{ ...inputStyle, minHeight: "72px", resize: "vertical" as const }} value={editForm.description} onChange={e => setEditForm((p: any) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Weight (tons)</label>
                  <input style={inputStyle} type="number" value={editForm.weightTons} onChange={e => setEditForm((p: any) => ({ ...p, weightTons: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label style={labelStyle}>Truck Type</label>
                  <select style={inputStyle} value={editForm.truckTypeNeeded} onChange={e => setEditForm((p: any) => ({ ...p, truckTypeNeeded: e.target.value }))}>
                    {TRUCK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Pickup City</label>
                  <input style={inputStyle} value={editForm.pickupCity} onChange={e => setEditForm((p: any) => ({ ...p, pickupCity: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Pickup Country</label>
                  <select style={inputStyle} value={editForm.pickupCountry} onChange={e => setEditForm((p: any) => ({ ...p, pickupCountry: e.target.value }))}>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Delivery City</label>
                  <input style={inputStyle} value={editForm.deliveryCity} onChange={e => setEditForm((p: any) => ({ ...p, deliveryCity: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Delivery Country</label>
                  <select style={inputStyle} value={editForm.deliveryCountry} onChange={e => setEditForm((p: any) => ({ ...p, deliveryCountry: e.target.value }))}>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Offered Price (USD)</label>
                  <input style={inputStyle} type="number" value={editForm.offeredPrice} onChange={e => setEditForm((p: any) => ({ ...p, offeredPrice: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label style={labelStyle}>Scheduled Date</label>
                  <input style={inputStyle} type="date" value={editForm.scheduledDate} onChange={e => setEditForm((p: any) => ({ ...p, scheduledDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button onClick={() => setEditLoad(null)} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button onClick={submitEdit} disabled={editLoading} style={{ flex: 2, padding: "11px", borderRadius: "9px", border: "none", background: "#1a2744", color: "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: editLoading ? "not-allowed" : "pointer", opacity: editLoading ? 0.7 : 1 }}>
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteId && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "28px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 0 16px", color: "#dc2626" }}><IconTrash /></div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#1a2744", marginBottom: "8px" }}>Delete this load?</div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "24px", lineHeight: "1.5" }}>This action cannot be undone. The load will be permanently removed from the platform.</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleteLoading} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "none", background: "#dc2626", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: deleteLoading ? "not-allowed" : "pointer", opacity: deleteLoading ? 0.7 : 1 }}>
                {deleteLoading ? "Deleting..." : "Delete Load"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKING MODAL ── */}
      {bookingLoad && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "420px", padding: "28px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#1a2744" }}>Apply for Load</div>
              <button onClick={() => setBookingLoad(null)} style={{ background: "#f5f3ef", border: "none", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}><IconX /></button>
            </div>
            <div style={{ background: "#faf8f4", borderRadius: "10px", padding: "14px", marginBottom: "18px" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a2744", marginBottom: "6px" }}>{bookingLoad.title}</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>{bookingLoad.pickupCity} → {bookingLoad.deliveryCity} · {bookingLoad.weightTons}t · ${bookingLoad.offeredPrice}</div>
            </div>
            {bookingError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "13px", color: "#dc2626" }}>{bookingError}</div>}
            <label style={labelStyle}>Select Truck</label>
            <select style={{ ...inputStyle, marginBottom: "18px" }} value={selectedTruck} onChange={e => setSelectedTruck(e.target.value)}>
              <option value="">Choose a truck...</option>
              {trucks.filter((t: any) => t.isAvailable).map((t: any) => (
                <option key={t.id} value={t.id}>{t.plateNumber} — {t.truckType?.replace(/_/g, " ")} ({t.capacityTons}t)</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setBookingLoad(null)} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleBook} disabled={bookingLoading || !selectedTruck} style={{ flex: 2, padding: "11px", borderRadius: "9px", border: "none", background: "#1a2744", color: "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: (!selectedTruck || bookingLoading) ? "not-allowed" : "pointer", opacity: (!selectedTruck || bookingLoading) ? 0.6 : 1 }}>
                {bookingLoading ? "Sending..." : "Send Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
