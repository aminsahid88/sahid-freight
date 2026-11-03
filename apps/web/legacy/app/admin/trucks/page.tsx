"use client";
import { useEffect, useState, useCallback } from "react";
import adminApi from "@/lib/admin-api";

const TYPES = ["ALL", "FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "OPEN_BODY", "MINI_TRUCK"] as const;
const VERIFIED_OPTS = ["All", "Verified", "Pending"] as const;

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page };
      if (typeFilter !== "ALL") params.type = typeFilter;
      if (verifiedFilter === "Verified") params.verified = "true";
      else if (verifiedFilter === "Pending") params.verified = "false";
      if (search.trim()) params.search = search.trim();
      const res = await adminApi.get("/admin/trucks", { params });
      setTrucks(res.data.trucks || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch { showToast("Failed to load trucks", "error"); }
    finally { setLoading(false); }
  }, [page, typeFilter, verifiedFilter, search]);

  useEffect(() => { fetchTrucks(); }, [fetchTrucks]);

  const openDetail = async (truck: any) => {
    setSelected(truck);
    setDetailLoading(true);
    try {
      const res = await adminApi.get(`/admin/trucks/${truck.id}`);
      setDetail(res.data.truck || res.data);
    } catch { showToast("Failed to load details", "error"); }
    finally { setDetailLoading(false); }
  };

  const verify = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionLoading(id);
    try {
      await adminApi.patch(`/admin/trucks/${id}/verify`);
      showToast("Truck verified");
      fetchTrucks();
      if (selected?.id === id) setSelected(null);
    } catch { showToast("Failed to verify", "error"); }
    finally { setActionLoading(null); }
  };

  const badge = (verified: boolean) => (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
      verified
        ? "bg-green-50 text-green-600 border-green-200"
        : "bg-amber-50 text-amber-600 border-amber-200"
    }`}>{verified ? "Verified" : "Pending"}</span>
  );

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-lg animate-fade-in"
          style={{ background: toast.type === "success" ? "#16a34a" : "#dc2626" }}>{toast.msg}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search plate, owner..."
          className="flex-1 px-3.5 py-2.5 rounded-lg border text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {TYPES.map(t => <option key={t} value={t}>{t === "ALL" ? "All Types" : t.replace(/_/g, " ")}</option>)}
        </select>
        <select value={verifiedFilter} onChange={e => { setVerifiedFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {VERIFIED_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>{total} truck{total !== 1 ? "s" : ""}</div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border overflow-auto" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  {["Plate", "Type", "Capacity", "Owner", "Location", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trucks.map((t, i) => (
                  <tr key={t.id} onClick={() => openDetail(t)} className="border-b cursor-pointer hover:bg-black/[0.02]"
                    style={{ borderColor: "var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td className="px-4 py-3 font-bold text-sm font-mono" style={{ color: "var(--primary)" }}>{t.plateNumber}</td>
                    <td className="px-4 py-3 text-sm">{t.truckType?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-sm">{t.capacityTons}t{t.lengthMeters ? ` / ${t.lengthMeters}m` : ""}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{t.owner?.fullName}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t.owner?.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{t.currentCity}, {t.currentCountry}</td>
                    <td className="px-4 py-3">{badge(t.isVerified)}</td>
                    <td className="px-4 py-3">
                      {!t.isVerified ? (
                        <button onClick={e => verify(t.id, e)} disabled={actionLoading === t.id}
                          className="px-3 py-1.5 rounded-lg border-none text-xs font-semibold text-white cursor-pointer"
                          style={{ background: "#16a34a" }}>
                          {actionLoading === t.id ? "..." : "Verify"}
                        </button>
                      ) : <span className="text-xs" style={{ color: "var(--text-secondary)" }}>--</span>}
                    </td>
                  </tr>
                ))}
                {trucks.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>No trucks found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-2.5">
            {trucks.length === 0 && (
              <div className="text-center py-16 text-sm rounded-xl" style={{ color: "var(--text-secondary)", background: "var(--surface)" }}>No trucks found</div>
            )}
            {trucks.map(t => (
              <div key={t.id} onClick={() => openDetail(t)}
                className="rounded-xl border p-4 cursor-pointer" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-[15px] font-mono" style={{ color: "var(--primary)" }}>{t.plateNumber}</span>
                  {badge(t.isVerified)}
                </div>
                <div className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>{t.truckType?.replace(/_/g, " ")} &middot; {t.capacityTons}t</div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--primary)" }}>{t.owner?.fullName}</div>
                <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{t.currentCity}, {t.currentCountry}</div>
                {!t.isVerified && (
                  <button onClick={e => verify(t.id, e)} disabled={actionLoading === t.id}
                    className="w-full py-2.5 rounded-lg border-none text-sm font-semibold text-white cursor-pointer"
                    style={{ background: "#16a34a" }}>
                    {actionLoading === t.id ? "Verifying..." : "Verify Truck"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--primary)" }}>Prev</button>
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--primary)" }}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { setSelected(null); setDetail(null); }}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl"
            style={{ background: "var(--surface)" }}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-lg font-bold font-mono" style={{ color: "var(--primary)" }}>{selected.plateNumber}</h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {selected.truckType?.replace(/_/g, " ")} &middot; {selected.capacityTons}t
                  {selected.lengthMeters ? ` / ${selected.lengthMeters}m` : ""}
                </p>
              </div>
              <button onClick={() => { setSelected(null); setDetail(null); }}
                className="px-3 py-2 rounded-lg border text-sm cursor-pointer" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>X</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="text-center py-10" style={{ color: "var(--text-secondary)" }}>Loading...</div>
              ) : (
                <>
                  {/* Owner */}
                  <div className="mb-5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>Owner</h4>
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{selected.owner?.fullName}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{selected.owner?.phone}</div>
                      {selected.owner?.isVerified !== undefined && (
                        <div className="mt-1.5">{badge(selected.owner.isVerified)}</div>
                      )}
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: "Location", value: `${selected.currentCity}, ${selected.currentCountry}` },
                      { label: "Available", value: selected.isAvailable ? "Yes" : "No" },
                      { label: "Verified", value: selected.isVerified ? "Yes" : "No" },
                      { label: "Registered", value: fmtDate(selected.createdAt) },
                    ].map(item => (
                      <div key={item.label} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                        <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>{item.label}</div>
                        <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent bookings */}
                  {detail?.bookings && detail.bookings.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>Recent Bookings</h4>
                      <div className="flex flex-col gap-2">
                        {detail.bookings.map((b: any) => (
                          <div key={b.id} className="rounded-lg border p-3 flex justify-between items-center" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{b.load?.title || b.load?.pickupCity + " -> " + b.load?.deliveryCity}</div>
                              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{fmtDate(b.createdAt)}</div>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                              b.status === "COMPLETED" || b.status === "DELIVERED" ? "bg-green-50 text-green-600 border-green-200" :
                              b.status === "CANCELLED" ? "bg-gray-50 text-gray-500 border-gray-200" :
                              "bg-amber-50 text-amber-600 border-amber-200"
                            }`}>{b.status?.replace(/_/g, " ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verify action */}
                  {!selected.isVerified && (
                    <button onClick={() => verify(selected.id)}
                      disabled={actionLoading === selected.id}
                      className="w-full mt-5 py-3 rounded-xl border-none text-[15px] font-bold text-white cursor-pointer"
                      style={{ background: "#16a34a" }}>
                      {actionLoading === selected.id ? "Verifying..." : "Verify This Truck"}
                    </button>
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
