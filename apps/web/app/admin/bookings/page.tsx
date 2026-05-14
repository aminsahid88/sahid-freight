"use client";
import { useEffect, useState, useCallback } from "react";
import adminApi from "@/lib/admin-api";

type Booking = {
  id: string; status: string; agreedPrice: number; currency: string;
  createdAt: string; pickedUpAt: string | null; deliveredAt: string | null;
  load: { title: string; pickupCity: string; deliveryCity: string };
  sender: { fullName: string; phone: string };
  owner: { fullName: string; phone: string };
  driver: { fullName: string; phone: string } | null;
  truck: { plateNumber: string; truckType: string } | null;
  payment?: any;
};

const STATUS_OPTS = ["", "PENDING", "ACCEPTED", "IN_TRANSIT", "COMPLETED", "REJECTED", "CANCELLED"];

const statusStyle = (s: string) => {
  const m: Record<string, { bg: string; color: string; border: string }> = {
    PENDING:    { bg: "#fff7ed", color: "#d97706", border: "#fed7aa" },
    ACCEPTED:   { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    IN_TRANSIT: { bg: "#fff7ed", color: "#d97706", border: "#fed7aa" },
    COMPLETED:  { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    REJECTED:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    CANCELLED:  { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
  };
  return m[s] || { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" };
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

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "--";
const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get("/admin/bookings", { params: { status: status || undefined, page } });
      setBookings(data.bookings || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch { showToast("Failed to load bookings", "error"); }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const openDetail = async (booking: Booking) => {
    setSelected(booking);
    setDetailLoading(true);
    try {
      const { data } = await adminApi.get(`/admin/bookings/${booking.id}`);
      setSelected(data.booking || data);
    } catch { /* keep summary data */ }
    finally { setDetailLoading(false); }
  };

  const TimelineStep = ({ label, date, active, last }: { label: string; date: string | null; active: boolean; last?: boolean }) => (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 rounded-full shrink-0 mt-0.5"
          style={{ background: active ? "#16a34a" : "var(--border)", border: active ? "none" : "2px solid var(--border)" }} />
        {!last && <div className="w-0.5 flex-1 min-h-[24px]" style={{ background: "var(--border)" }} />}
      </div>
      <div className="pb-4">
        <div className="text-sm font-semibold" style={{ color: active ? "var(--primary)" : "var(--text-secondary)" }}>{label}</div>
        {date ? (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{fmtDateTime(date)}</div>
        ) : (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--border)" }}>Pending</div>
        )}
      </div>
    </div>
  );

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-semibold text-right" style={{ color: "var(--primary)" }}>{value}</span>
    </div>
  );

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-lg"
          style={{ background: toast.type === "success" ? "#16a34a" : "#dc2626" }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-extrabold" style={{ color: "var(--primary)" }}>Bookings ({total})</h2>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--primary)" }}>
          <option value="">All Statuses</option>
          {STATUS_OPTS.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
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
                <tr>{["Load", "Route", "Sender", "Owner", "Driver", "Truck", "Price", "Status", ""].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => (
                  <tr key={b.id} onClick={() => openDetail(b)} className="cursor-pointer hover:bg-black/[0.02] transition-colors"
                    style={{ background: i % 2 === 0 ? "var(--surface)" : "rgba(0,0,0,0.01)" }}>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="font-semibold text-sm" style={{ color: "var(--primary)" }}>{b.load?.title}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{fmtDate(b.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 border-b text-sm" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
                      {b.load?.pickupCity} &rarr; {b.load?.deliveryCity}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{b.sender?.fullName}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{b.sender?.phone}</div>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{b.owner?.fullName}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{b.owner?.phone}</div>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <div className="text-sm" style={{ color: "var(--primary)" }}>{b.driver?.fullName || "--"}</div>
                    </td>
                    <td className="px-4 py-3 border-b text-sm font-mono" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
                      {b.truck?.plateNumber || "--"}
                    </td>
                    <td className="px-4 py-3 border-b text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
                      {b.agreedPrice} {b.currency}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}><Badge status={b.status} /></td>
                    <td className="px-4 py-3 border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>View</td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>No bookings found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {bookings.map(b => (
              <div key={b.id} onClick={() => openDetail(b)} className="rounded-xl border p-4 cursor-pointer"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="font-bold text-[15px] min-w-0" style={{ color: "var(--primary)" }}>{b.load?.title}</div>
                  <Badge status={b.status} />
                </div>
                <div className="text-[13px] mb-2" style={{ color: "var(--text-secondary)" }}>{b.load?.pickupCity} &rarr; {b.load?.deliveryCity}</div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div><span style={{ color: "var(--text-secondary)" }}>Sender: </span><span className="font-semibold" style={{ color: "var(--primary)" }}>{b.sender?.fullName}</span></div>
                  <div><span style={{ color: "var(--text-secondary)" }}>Owner: </span><span className="font-semibold" style={{ color: "var(--primary)" }}>{b.owner?.fullName}</span></div>
                  <div><span style={{ color: "var(--text-secondary)" }}>Truck: </span><span className="font-mono font-semibold" style={{ color: "var(--primary)" }}>{b.truck?.plateNumber || "--"}</span></div>
                  <div><span style={{ color: "var(--text-secondary)" }}>Price: </span><span className="font-semibold" style={{ color: "var(--primary)" }}>{b.agreedPrice} {b.currency}</span></div>
                </div>
              </div>
            ))}
            {bookings.length === 0 && (
              <div className="rounded-xl border p-10 text-center text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>No bookings found</div>
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
          onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl"
            style={{ background: "var(--surface)" }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold truncate" style={{ color: "var(--primary)" }}>{selected.load?.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {selected.load?.pickupCity} &rarr; {selected.load?.deliveryCity}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge status={selected.status} />
                <button onClick={() => setSelected(null)}
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
                  {/* Timeline */}
                  <h4 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Timeline</h4>
                  <div className="mb-4">
                    <TimelineStep label="Created" date={selected.createdAt} active={!!selected.createdAt} />
                    <TimelineStep label="Accepted" date={selected.status !== "PENDING" && selected.status !== "REJECTED" && selected.status !== "CANCELLED" ? selected.createdAt : null} active={["ACCEPTED","IN_TRANSIT","COMPLETED"].includes(selected.status)} />
                    <TimelineStep label="Picked Up" date={selected.pickedUpAt} active={!!selected.pickedUpAt} />
                    <TimelineStep label="Delivered" date={selected.deliveredAt} active={!!selected.deliveredAt} last />
                  </div>

                  {/* Info */}
                  <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Details</h4>
                  <InfoRow label="Price" value={`${selected.agreedPrice} ${selected.currency}`} />
                  <InfoRow label="Sender" value={`${selected.sender?.fullName} (${selected.sender?.phone})`} />
                  <InfoRow label="Owner" value={`${selected.owner?.fullName} (${selected.owner?.phone})`} />
                  {selected.driver && <InfoRow label="Driver" value={`${selected.driver.fullName} (${selected.driver.phone})`} />}
                  {selected.truck && (
                    <>
                      <InfoRow label="Truck Plate" value={selected.truck.plateNumber} />
                      <InfoRow label="Truck Type" value={selected.truck.truckType?.replace(/_/g, " ")} />
                    </>
                  )}

                  {/* Payment */}
                  {selected.payment && (
                    <div className="mt-5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Payment</h4>
                      <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                        <InfoRow label="Amount" value={`${selected.payment.amount} ${selected.payment.currency || selected.currency}`} />
                        <InfoRow label="Method" value={selected.payment.method || selected.payment.paymentMethod || "--"} />
                        <InfoRow label="Status" value={<Badge status={selected.payment.status} />} />
                        {selected.payment.paidAt && <InfoRow label="Paid At" value={fmtDate(selected.payment.paidAt)} />}
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
