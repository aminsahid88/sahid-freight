"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import adminApi from "@/lib/admin-api";

/* ── Types ──────────────────────────────────────────────── */
interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: string;
  status: string;
  country: string;
  city: string;
  isVerified: boolean;
  createdAt: string;
  _count: {
    loadsPosted: number;
    bookingsAsSender: number;
    bookingsAsOwner: number;
    bidsPlaced: number;
  };
}

/* ── Constants ──────────────────────────────────────────── */
const ROLES = ["ALL", "CARGO_SENDER", "TRUCK_OWNER", "DRIVER", "ADMIN"] as const;

const ROLE_COLOR: Record<string, string> = {
  CARGO_SENDER: "#2563eb",
  TRUCK_OWNER: "#E8A020",
  DRIVER: "#7c3aed",
  ADMIN: "#dc2626",
};

const STATUS_MAP: Record<string, { bg: string; fg: string; border: string }> = {
  ACTIVE:                 { bg: "#f0fdf4", fg: "#16a34a", border: "#bbf7d0" },
  SUSPENDED:              { bg: "#fef2f2", fg: "#dc2626", border: "#fecaca" },
  BANNED:                 { bg: "#fef2f2", fg: "#dc2626", border: "#fecaca" },
  PENDING_VERIFICATION:   { bg: "#fffbeb", fg: "#d97706", border: "#fde68a" },
  DOCUMENTS_SUBMITTED:    { bg: "#eff6ff", fg: "#2563eb", border: "#bfdbfe" },
};

/* ── Helpers ────────────────────────────────────────────── */
function statusBadge(status: string) {
  const s = STATUS_MAP[status] || { bg: "#f9fafb", fg: "#6b7280", border: "#e5e7eb" };
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function roleBadge(role: string) {
  const color = ROLE_COLOR[role] || "#6b7280";
  return (
    <span className="text-xs font-bold" style={{ color }}>
      {role.replace(/_/g, " ")}
    </span>
  );
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function Skeleton({ w, h }: { w: string; h: string }) {
  return (
    <div
      className="rounded-md animate-pulse"
      style={{ width: w, height: h, background: "var(--border)" }}
    />
  );
}

/* ── Page ───────────────────────────────────────────────── */
export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Ban modal
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  // Detail drawer
  const [detail, setDetail] = useState<User | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* Fetch users */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page) };
      if (search) params.search = search;
      if (roleFilter !== "ALL") params.role = roleFilter;
      const r = await adminApi.get("/admin/users", { params });
      setUsers(r.data.users || []);
      setTotal(r.data.total || 0);
      setTotalPages(r.data.totalPages || 1);
    } catch {
      showToast("Failed to load users", "err");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* Actions */
  const handleBan = async () => {
    if (!banTarget || !banReason.trim()) return;
    setBanLoading(true);
    try {
      await adminApi.post(`/admin/users/${banTarget.id}/ban`, { reason: banReason });
      showToast("User banned");
      setBanTarget(null);
      setBanReason("");
      fetchUsers();
    } catch {
      showToast("Failed to ban user", "err");
    } finally {
      setBanLoading(false);
    }
  };

  const handleUnban = async (id: string) => {
    try {
      await adminApi.post(`/admin/users/${id}/unban`);
      showToast("User unbanned");
      fetchUsers();
    } catch {
      showToast("Failed to unban", "err");
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await adminApi.patch(`/admin/users/${id}/approve`);
      showToast("User verified");
      fetchUsers();
    } catch {
      showToast("Failed to verify", "err");
    }
  };

  const openDetail = async (u: User) => {
    setDetail(u);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const r = await adminApi.get(`/admin/users/${u.id}`);
      setDetailData(r.data.user);
    } catch {
      showToast("Failed to load details", "err");
    } finally {
      setDetailLoading(false);
    }
  };

  const isPending = (u: User) =>
    (!u.isVerified || u.status === "PENDING_VERIFICATION" || u.status === "DOCUMENTS_SUBMITTED") &&
    u.role !== "ADMIN";

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[9999] rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ background: toast.type === "ok" ? "#16a34a" : "#dc2626" }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <h2 className="text-xl font-extrabold flex-1" style={{ color: "var(--primary)" }}>
          Users{!loading && <span className="text-sm font-medium ml-2" style={{ color: "var(--text-secondary)" }}>({total})</span>}
        </h2>
        <div className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone..."
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--primary)",
              width: "220px",
            }}
          />
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--primary)",
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "All Roles" : r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop table */}
      <div
        className="hidden md:block rounded-xl overflow-auto mb-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Name", "Role", "Status", "Joined", "Actions"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3"><Skeleton w="140px" h="16px" /></td>
                    <td className="px-4 py-3"><Skeleton w="80px" h="16px" /></td>
                    <td className="px-4 py-3"><Skeleton w="70px" h="16px" /></td>
                    <td className="px-4 py-3"><Skeleton w="50px" h="16px" /></td>
                    <td className="px-4 py-3"><Skeleton w="120px" h="28px" /></td>
                  </tr>
                ))
              : users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => openDetail(u)}
                    className="cursor-pointer transition-colors hover:bg-black/[0.02]"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: "var(--primary)" }}>
                        {u.fullName}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {u.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">{roleBadge(u.role)}</td>
                    <td className="px-4 py-3">{statusBadge(u.status)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {timeAgo(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDetail(u)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            color: "var(--primary)",
                            cursor: "pointer",
                          }}
                        >
                          View
                        </button>
                        {isPending(u) && (
                          <button
                            onClick={() => handleVerify(u.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                            style={{ background: "#16a34a", border: "none", cursor: "pointer" }}
                          >
                            Verify
                          </button>
                        )}
                        {u.status === "BANNED" ? (
                          <button
                            onClick={() => handleUnban(u.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                            style={{
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#2563eb",
                              cursor: "pointer",
                            }}
                          >
                            Unban
                          </button>
                        ) : (
                          u.role !== "ADMIN" && (
                            <button
                              onClick={() => setBanTarget(u)}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                              style={{
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#dc2626",
                                cursor: "pointer",
                              }}
                            >
                              Ban
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            No users found
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3 mb-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <Skeleton w="150px" h="16px" />
                <div className="mt-2"><Skeleton w="100px" h="14px" /></div>
                <div className="mt-2"><Skeleton w="80px" h="20px" /></div>
              </div>
            ))
          : users.map((u) => (
              <div
                key={u.id}
                onClick={() => openDetail(u)}
                className="rounded-xl p-4 cursor-pointer"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-[15px]" style={{ color: "var(--primary)" }}>
                      {u.fullName}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {u.phone}
                    </div>
                  </div>
                  {statusBadge(u.status)}
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {roleBadge(u.role)}
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    -- {u.city}, {u.country} -- {timeAgo(u.createdAt)}
                  </span>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {isPending(u) && (
                    <button
                      onClick={() => handleVerify(u.id)}
                      className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
                      style={{ background: "#16a34a", border: "none", cursor: "pointer" }}
                    >
                      Verify
                    </button>
                  )}
                  {u.status === "BANNED" ? (
                    <button
                      onClick={() => handleUnban(u.id)}
                      className="flex-1 rounded-lg py-2 text-sm font-semibold"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", cursor: "pointer" }}
                    >
                      Unban
                    </button>
                  ) : (
                    u.role !== "ADMIN" && (
                      <button
                        onClick={() => setBanTarget(u)}
                        className="flex-1 rounded-lg py-2 text-sm font-semibold"
                        style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", cursor: "pointer" }}
                      >
                        Ban
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
        {!loading && users.length === 0 && (
          <div
            className="rounded-xl py-12 text-center text-sm"
            style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
          >
            No users found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--primary)",
              cursor: page <= 1 ? "default" : "pointer",
            }}
          >
            Prev
          </button>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--primary)",
              cursor: page >= totalPages ? "default" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Ban Modal */}
      {banTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setBanTarget(null); setBanReason(""); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6"
            style={{ background: "var(--surface)", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}
          >
            <h3 className="text-lg font-bold mb-1" style={{ color: "var(--primary)" }}>
              Ban User
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              Banning <strong>{banTarget.fullName}</strong>. Provide a reason:
            </p>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. Fraudulent activity, policy violation..."
              className="w-full rounded-lg p-3 text-sm resize-none outline-none"
              style={{
                border: "1px solid var(--border)",
                height: "90px",
                fontFamily: "inherit",
              }}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setBanTarget(null); setBanReason(""); }}
                className="flex-1 rounded-lg py-3 text-sm font-semibold"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={!banReason.trim() || banLoading}
                className="flex-1 rounded-lg py-3 text-sm font-bold text-white"
                style={{
                  background: !banReason.trim() ? "var(--border)" : "#dc2626",
                  border: "none",
                  cursor: banReason.trim() && !banLoading ? "pointer" : "not-allowed",
                }}
              >
                {banLoading ? "Banning..." : "Confirm Ban"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detail && (
        <div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setDetail(null); setDetailData(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
            style={{
              background: "var(--surface)",
              maxHeight: "90vh",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
            }}
          >
            {/* Drag handle */}
            <div className="sm:hidden flex justify-center pt-3">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
            </div>

            {/* Header */}
            <div
              className="flex items-start justify-between p-5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--primary)" }}>
                  {detail.fullName}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {detail.phone}
                  {detail.email && <span> -- {detail.email}</span>}
                </p>
              </div>
              <button
                onClick={() => { setDetail(null); setDetailData(null); }}
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="text-center py-10 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Loading...
                </div>
              ) : (
                <>
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: "Role", value: roleBadge(detail.role) },
                      { label: "Status", value: statusBadge(detail.status) },
                      { label: "Location", value: <span className="text-sm" style={{ color: "var(--primary)" }}>{detail.city}, {detail.country}</span> },
                      { label: "Joined", value: <span className="text-sm" style={{ color: "var(--primary)" }}>{new Date(detail.createdAt).toLocaleDateString()}</span> },
                      { label: "Verified", value: <span className="text-sm font-semibold" style={{ color: detail.isVerified ? "#16a34a" : "#d97706" }}>{detail.isVerified ? "Yes" : "No"}</span> },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-secondary)" }}>
                          {item.label}
                        </div>
                        {item.value}
                      </div>
                    ))}
                  </div>

                  {/* Activity stats */}
                  <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>
                    Activity
                  </div>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 rounded-lg p-3"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                  >
                    {[
                      { label: "Loads Posted", val: detail._count?.loadsPosted ?? 0 },
                      { label: "Bookings (Sender)", val: detail._count?.bookingsAsSender ?? 0 },
                      { label: "Bookings (Owner)", val: detail._count?.bookingsAsOwner ?? 0 },
                      { label: "Bids Placed", val: detail._count?.bidsPlaced ?? 0 },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <div className="text-xl font-extrabold" style={{ color: "var(--primary)" }}>
                          {s.val}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Documents */}
                  {(() => {
                    const docs =
                      detailData?.senderProfile?.documents ||
                      detailData?.truckOwnerProfile?.documents ||
                      [];
                    if (docs.length === 0) return null;
                    return (
                      <>
                        <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>
                          Documents ({docs.length})
                        </div>
                        <div className="flex flex-col gap-2 mb-5">
                          {docs.map((doc: any) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between rounded-lg p-3"
                              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                            >
                              <div>
                                <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                                  {doc.documentType?.replace(/_/g, " ")}
                                </div>
                                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  {(doc.fileSize / 1024).toFixed(0)} KB
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const r = await adminApi.get("/uploads/presign?url=" + encodeURIComponent(doc.fileUrl));
                                    window.open(r.data.url, "_blank");
                                  } catch {
                                    showToast("Failed to open document", "err");
                                  }
                                }}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                style={{ background: "var(--primary)", border: "none", cursor: "pointer" }}
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    {isPending(detail) && (
                      <button
                        onClick={() => { handleVerify(detail.id); setDetail(null); }}
                        className="flex-1 rounded-lg py-3 text-sm font-bold text-white"
                        style={{ background: "#16a34a", border: "none", cursor: "pointer" }}
                      >
                        Verify User
                      </button>
                    )}
                    {detail.status === "BANNED" ? (
                      <button
                        onClick={() => { handleUnban(detail.id); setDetail(null); }}
                        className="flex-1 rounded-lg py-3 text-sm font-bold"
                        style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", cursor: "pointer" }}
                      >
                        Unban User
                      </button>
                    ) : (
                      detail.role !== "ADMIN" && (
                        <button
                          onClick={() => { setDetail(null); setBanTarget(detail); }}
                          className="flex-1 rounded-lg py-3 text-sm font-bold"
                          style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", cursor: "pointer" }}
                        >
                          Ban User
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
