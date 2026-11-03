"use client";
import { useEffect, useState, useCallback } from "react";
import adminApi from "@/lib/admin-api";

type Load = {
  id: string; title: string; description: string; weightTons: number;
  truckTypeNeeded: string; pickupCity: string; pickupCountry: string;
  deliveryCity: string; deliveryCountry: string; offeredPrice: number;
  currency: string; status: string; scheduledDate: string; createdAt: string;
  sender: { id: string; fullName: string; phone: string };
  _count: { bids: number; bookings: number };
  bids?: any[]; bookings?: any[];
};

const STATUS_OPTS = ["", "DRAFT", "OPEN", "BOOKED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];

const statusStyle = (s: string) => {
  const m: Record<string, { bg: string; color: string; border: string }> = {
    OPEN:       { bg: "#E8F0FF", color: "#3D7BFF", border: "#BBD0FF" },
    BOOKED:     { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    IN_TRANSIT: { bg: "#fff7ed", color: "#d97706", border: "#fed7aa" },
    DELIVERED:  { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
    CANCELLED:  { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
    DRAFT:      { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
  };
  return m[s] || m.DRAFT;
};

const Badge = ({ status }: { status: string }) => {
  const s = statusStyle(status);
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status.replace(/_/g, " ")}
    </span>
  );
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function AdminLoadsPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Load | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get("/admin/loads", { params: { search: search || undefined, status: status || undefined, page } });
      setLoads(data.loads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch { showToast("Failed to load loads", "error"); }
    finally { setLoading(false); }
  }, [search, status, page]);

  useEffect(() => { fetchLoads(); }, [fetchLoads]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openDetail = async (load: Load) => {
    setSelected(load);
    setDetailLoading(true);
    try {
      const { data } = await adminApi.get(`/admin/loads/${load.id}`);
      setSelected(data.load || data);
    } catch { /* keep summary data */ }
    finally { setDetailLoading(false); }
  };

  const forceCancel = async () => {
    if (!selected || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await adminApi.post(`/admin/loads/${selected.id}/cancel`, { reason: cancelReason });
      showToast("Load cancelled");
      setCancelModal(false);
      setCancelReason("");
      setSelected(null);
      fetchLoads();
    } catch { showToast("Failed to cancel load", "error"); }
    finally { setCancelling(false); }
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{value}</span>
    </div>
  );

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-lg"
          style={{ background: toast.type === "success" ? "#16a34a" : "#dc2626" }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-extrabold" style={{ color: "var(--primary)" }}>Loads ({total})</h2>
        <div className="flex gap-2 flex-wrap">
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search loads..."
            className="px-3 py-2 rounded-lg border text-sm outline-none w-48"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--primary)" }} />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--primary)" }}>
            <option value="">All Statuses</option>
            {STATUS_OPTS.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border overflow-auto" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr>{["Title", "Sender", "Route", "Weight", "Price", "Status", "Bids", ""].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {loads.map((l, i) => (
                  <tr key={l.id} onClick={() => openDetail(l)} className="cursor-pointer hover:bg-black/[0.02] transition-colors"
                    style={{ background: i % 2 === 0 ? "var(--surface)" : "rgba(0,0,0,0.01)" }}>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="font-semibold text-sm" style={{ color: "var(--primary)" }}>{l.title}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{fmtDate(l.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="font-semibold text-sm" style={{ color: "var(--primary)" }}>{l.sender?.fullName}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{l.sender?.phone}</div>
                    </td>
                    <td className="px-4 py-3 border-b text-sm" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
                      {l.pickupCity} &rarr; {l.deliveryCity}
                    </td>
                    <td className="px-4 py-3 border-b text-sm" style={{ borderColor: "var(--border)" }}>{l.weightTons}t</td>
                    <td className="px-4 py-3 border-b text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
                      {l.offeredPrice} {l.currency}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}><Badge status={l.status} /></td>
                    <td className="px-4 py-3 border-b text-sm text-center" style={{ borderColor: "var(--border)" }}>{l._count?.bids || 0}</td>
                    <td className="px-4 py-3 border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>View</td>
                  </tr>
                ))}
                {loads.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>No loads found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {loads.map(l => (
              <div key={l.id} onClick={() => openDetail(l)} className="rounded-xl border p-4 cursor-pointer"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="font-bold text-[15px] min-w-0" style={{ color: "var(--primary)" }}>{l.title}</div>
                  <Badge status={l.status} />
                </div>
                <div className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>{l.pickupCity} &rarr; {l.deliveryCity}</div>
                <div className="text-[13px] font-semibold mb-1" style={{ color: "var(--primary)" }}>{l.sender?.fullName}</div>
                <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{l.weightTons}t</span>
                  <span className="font-semibold" style={{ color: "var(--primary)" }}>{l.offeredPrice} {l.currency}</span>
                  <span>{l._count?.bids || 0} bids</span>
                </div>
              </div>
            ))}
            {loads.length === 0 && (
              <div className="rounded-xl border p-10 text-center text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>No loads found</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--primary)", cursor: page <= 1 ? "default" : "pointer" }}>Prev</button>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--primary)", cursor: page >= totalPages ? "default" : "pointer" }}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { setSelected(null); setCancelModal(false); setCancelReason(""); }}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl"
            style={{ background: "var(--surface)" }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold truncate" style={{ color: "var(--primary)" }}>{selected.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Created {fmtDate(selected.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge status={selected.status} />
                <button onClick={() => { setSelected(null); setCancelModal(false); setCancelReason(""); }}
                  className="px-2.5 py-1.5 rounded-lg border text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>X</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
                </div>
              ) : (
                <>
                  {selected.description && (
                    <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{selected.description}</p>
                  )}
                  <InfoRow label="Route" value={`${selected.pickupCity}, ${selected.pickupCountry} → ${selected.deliveryCity}, ${selected.deliveryCountry}`} />
                  <InfoRow label="Weight" value={`${selected.weightTons} tons`} />
                  <InfoRow label="Truck Type" value={selected.truckTypeNeeded?.replace(/_/g, " ") || "Any"} />
                  <InfoRow label="Price" value={`${selected.offeredPrice} ${selected.currency}`} />
                  <InfoRow label="Sender" value={`${selected.sender?.fullName} (${selected.sender?.phone})`} />
                  {selected.scheduledDate && <InfoRow label="Scheduled" value={fmtDate(selected.scheduledDate)} />}

                  {/* Bids */}
                  {selected.bids && selected.bids.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Bids ({selected.bids.length})</h4>
                      <div className="flex flex-col gap-2">
                        {selected.bids.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2"
                            style={{ borderColor: "var(--border)" }}>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{b.owner?.fullName || b.truckOwner?.fullName || "Owner"}</div>
                              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{b.owner?.phone || b.truckOwner?.phone || ""}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold" style={{ color: "var(--primary)" }}>{b.amount || b.price} {selected.currency}</div>
                              <Badge status={b.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bookings */}
                  {selected.bookings && selected.bookings.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Bookings ({selected.bookings.length})</h4>
                      <div className="flex flex-col gap-2">
                        {selected.bookings.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2"
                            style={{ borderColor: "var(--border)" }}>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{b.owner?.fullName || "Owner"}</div>
                              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{b.truck?.plateNumber || ""}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold" style={{ color: "var(--primary)" }}>{b.agreedPrice} {b.currency || selected.currency}</div>
                              <Badge status={b.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Force Cancel */}
                  {!cancelModal && selected.status !== "CANCELLED" && selected.status !== "DELIVERED" && (
                    <button onClick={() => setCancelModal(true)}
                      className="mt-5 w-full py-3 rounded-xl border text-sm font-bold"
                      style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626", cursor: "pointer" }}>
                      Force Cancel Load
                    </button>
                  )}

                  {cancelModal && (
                    <div className="mt-5 p-4 rounded-xl border" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
                      <h4 className="text-sm font-bold mb-2" style={{ color: "#dc2626" }}>Cancel Reason</h4>
                      <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..."
                        className="w-full h-20 p-3 rounded-lg border text-sm resize-none outline-none"
                        style={{ borderColor: "var(--border)", fontFamily: "inherit" }} />
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => { setCancelModal(false); setCancelReason(""); }}
                          className="flex-1 py-2.5 rounded-lg border text-sm font-semibold"
                          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
                        <button onClick={forceCancel} disabled={!cancelReason.trim() || cancelling}
                          className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                          style={{ background: cancelReason.trim() ? "#dc2626" : "var(--border)", cursor: cancelReason.trim() ? "pointer" : "not-allowed", border: "none" }}>
                          {cancelling ? "Cancelling..." : "Confirm Cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
