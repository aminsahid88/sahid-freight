"use client";
import { useEffect, useState, useCallback } from "react";
import adminApi from "@/lib/admin-api";

type Status = "PENDING" | "APPROVED" | "REJECTED";
const TABS: { label: string; value: Status | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:  { bg: "bg-amber-50",  text: "text-amber-600",  border: "border-amber-200" },
  APPROVED: { bg: "bg-green-50",  text: "text-green-600",  border: "border-green-200" },
  REJECTED: { bg: "bg-red-50",    text: "text-red-600",    border: "border-red-200" },
};

const fmtType = (t: string) =>
  t.replace(/_/g, " ").replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase());

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const fmtSize = (bytes: number) =>
  bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : (bytes / 1024).toFixed(0) + " KB";

const roleBadge = (role: string) => (
  <span className={`text-[11px] font-semibold ${
    role === "TRUCK_OWNER" ? "text-amber-600" : role === "ADMIN" ? "text-purple-600" : "text-blue-600"
  }`}>{role.replace(/_/g, " ")}</span>
);

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page };
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await adminApi.get("/admin/documents", { params });
      setDocs(res.data.documents || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch { showToast("Failed to load documents", "error"); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const openDetail = async (doc: any) => {
    setSelected(doc);
    setRejectMode(false);
    setRejectReason("");
    setDetailLoading(true);
    try {
      const res = await adminApi.get(`/admin/documents/${doc.id}`);
      setDetail(res.data.document || res.data);
    } catch { showToast("Failed to load document", "error"); }
    finally { setDetailLoading(false); }
  };

  const closeModal = () => {
    setSelected(null);
    setDetail(null);
    setRejectMode(false);
    setRejectReason("");
  };

  const approve = async () => {
    if (!selected) return;
    setActionLoading("approve");
    try {
      await adminApi.post(`/admin/documents/${selected.id}/approve`);
      showToast("Document approved");
      closeModal();
      fetchDocs();
    } catch { showToast("Failed to approve", "error"); }
    finally { setActionLoading(null); }
  };

  const reject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setActionLoading("reject");
    try {
      await adminApi.post(`/admin/documents/${selected.id}/reject`, { reason: rejectReason.trim() });
      showToast("Document rejected");
      closeModal();
      fetchDocs();
    } catch { showToast("Failed to reject", "error"); }
    finally { setActionLoading(null); }
  };

  const statusBadge = (status: string) => {
    const c = STATUS_COLORS[status] || { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" };
    return (
      <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-lg"
          style={{ background: toast.type === "success" ? "#16a34a" : "#dc2626" }}>{toast.msg}</div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl border overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {TABS.map(tab => (
          <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer border-none transition-all"
            style={{
              background: statusFilter === tab.value ? "var(--primary)" : "transparent",
              color: statusFilter === tab.value ? "#FAFAF8" : "var(--text-secondary)",
            }}>{tab.label}</button>
        ))}
      </div>

      <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>{total} document{total !== 1 ? "s" : ""}</div>

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
                  {["User", "Document Type", "Uploaded", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => (
                  <tr key={d.id} onClick={() => openDetail(d)} className="border-b cursor-pointer hover:bg-black/[0.02]"
                    style={{ borderColor: "var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--bg)" }}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{d.user?.fullName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">{roleBadge(d.user?.role)}<span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{d.user?.phone}</span></div>
                    </td>
                    <td className="px-4 py-3 text-sm">{fmtType(d.documentType)}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{fmtDate(d.uploadedAt || d.createdAt)}</td>
                    <td className="px-4 py-3">{statusBadge(d.status)}</td>
                    <td className="px-4 py-3">
                      <button className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer"
                        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--primary)" }}>Review</button>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>No documents found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-2.5">
            {docs.length === 0 && (
              <div className="text-center py-16 text-sm rounded-xl" style={{ color: "var(--text-secondary)", background: "var(--surface)" }}>No documents found</div>
            )}
            {docs.map(d => (
              <div key={d.id} onClick={() => openDetail(d)}
                className="rounded-xl border p-4 cursor-pointer" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{d.user?.fullName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">{roleBadge(d.user?.role)}</div>
                  </div>
                  {statusBadge(d.status)}
                </div>
                <div className="text-[13px] font-medium mb-1" style={{ color: "var(--primary)" }}>{fmtType(d.documentType)}</div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{fmtDate(d.uploadedAt || d.createdAt)}</div>
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

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={closeModal}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-[640px] max-h-[92vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl"
            style={{ background: "var(--surface)" }}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden" />

            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-[17px] font-bold" style={{ color: "var(--primary)" }}>Document Review</h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{fmtType(selected.documentType)}</p>
              </div>
              <button onClick={closeModal}
                className="px-3 py-2 rounded-lg border text-sm cursor-pointer" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>X</button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="text-center py-10" style={{ color: "var(--text-secondary)" }}>Loading...</div>
              ) : (
                <>
                  {/* Image preview */}
                  {detail?.presignedUrl && (
                    <div className="mb-5 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                      <img src={detail.presignedUrl} alt={selected.documentType}
                        className="w-full max-h-[360px] object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                  {detail && !detail.presignedUrl && (
                    <div className="mb-5 rounded-xl border p-10 text-center text-sm" style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-secondary)" }}>
                      No preview available
                    </div>
                  )}

                  {/* User context */}
                  <div className="mb-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>User</h4>
                    <div className="rounded-lg border p-3 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{(detail?.user || selected.user)?.fullName}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{(detail?.user || selected.user)?.phone}</div>
                      </div>
                      {roleBadge((detail?.user || selected.user)?.role)}
                    </div>
                  </div>

                  {/* Doc info */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                      <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>Type</div>
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{fmtType(selected.documentType)}</div>
                    </div>
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                      <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>Uploaded</div>
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{fmtDate(selected.uploadedAt || selected.createdAt)}</div>
                    </div>
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                      <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>File Name</div>
                      <div className="text-sm font-medium truncate" style={{ color: "var(--primary)" }}>{selected.fileName || "--"}</div>
                    </div>
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                      <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>File Size</div>
                      <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{selected.fileSize ? fmtSize(selected.fileSize) : "--"}</div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Status:</span>
                    {statusBadge(selected.status)}
                    {selected.rejectionReason && (
                      <span className="text-xs" style={{ color: "var(--danger, #dc2626)" }}>- {selected.rejectionReason}</span>
                    )}
                  </div>

                  {/* Actions */}
                  {selected.status === "PENDING" && (
                    <div className="border-t pt-4 mt-2" style={{ borderColor: "var(--border)" }}>
                      {!rejectMode ? (
                        <div className="flex gap-3">
                          <button onClick={approve} disabled={actionLoading === "approve"}
                            className="flex-1 py-3 rounded-xl border-none text-[15px] font-bold text-white cursor-pointer disabled:opacity-60"
                            style={{ background: "#16a34a" }}>
                            {actionLoading === "approve" ? "Approving..." : "Approve"}
                          </button>
                          <button onClick={() => setRejectMode(true)}
                            className="flex-1 py-3 rounded-xl border-none text-[15px] font-bold text-white cursor-pointer"
                            style={{ background: "#dc2626" }}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div>
                          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (e.g. Document unclear, ID expired...)"
                            className="w-full h-20 p-3 rounded-lg border text-sm resize-none outline-none mb-3"
                            style={{ borderColor: "var(--border)", fontFamily: "inherit" }} />
                          <div className="flex gap-3">
                            <button onClick={() => { setRejectMode(false); setRejectReason(""); }}
                              className="flex-1 py-3 rounded-xl border text-sm font-semibold cursor-pointer"
                              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
                              Cancel
                            </button>
                            <button onClick={reject} disabled={!rejectReason.trim() || actionLoading === "reject"}
                              className="flex-1 py-3 rounded-xl border-none text-sm font-bold text-white cursor-pointer disabled:opacity-40"
                              style={{ background: "#dc2626" }}>
                              {actionLoading === "reject" ? "Rejecting..." : "Confirm Reject"}
                            </button>
                          </div>
                        </div>
                      )}
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
