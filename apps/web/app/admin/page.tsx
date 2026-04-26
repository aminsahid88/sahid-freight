"use client";
import { Truck, Package, Clock, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

type Tab = "overview" | "users" | "trucks" | "loads" | "bookings";

export default function AdminPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "ADMIN") { router.push("/dashboard"); return; }
    fetchAll();
  }, [mounted, user]);

  const fetchAll = async () => {
    try {
      const [statsRes, usersRes, loadsRes, bookingsRes, trucksRes] = await Promise.allSettled([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/loads"),
        api.get("/admin/bookings"),
        api.get("/admin/trucks"),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.stats);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value.data.users || []);
      if (loadsRes.status === "fulfilled") setLoads(loadsRes.value.data.loads || []);
      if (bookingsRes.status === "fulfilled") setBookings(bookingsRes.value.data.bookings || []);
      if (trucksRes.status === "fulfilled") setTrucks(trucksRes.value.data.trucks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUserDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin/users/${id}`);
      setUserDetail(res.data.user);
    } catch { showToast("Failed to load user details", "error"); }
    finally { setLoadingDetail(false); }
  };

  const openUserDetail = (u: any) => {
    setSelectedUser(u);
    fetchUserDetail(u.id);
  };

  const approve = async (id: string, e?: any) => {
    e?.stopPropagation();
    setActionLoading(id + "_approve");
    try {
      await api.patch(`/admin/users/${id}/approve`);
      showToast("User approved successfully");
      fetchAll();
    } catch { showToast("Failed to approve", "error"); }
    finally { setActionLoading(null); }
  };

  const reject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id + "_reject");
    try {
      await api.patch(`/admin/users/${rejectModal.id}/reject`, { reason: rejectReason });
      showToast("Verification rejected");
      setRejectModal(null);
      setRejectReason("");
      fetchAll();
    } catch { showToast("Failed to reject", "error"); }
    finally { setActionLoading(null); }
  };

  const suspend = async (id: string, e?: any) => {
    e?.stopPropagation();
    if (!confirm("Suspend this user?")) return;
    setActionLoading(id + "_suspend");
    try {
      await api.patch(`/admin/users/${id}/suspend`);
      showToast("User suspended");
      fetchAll();
    } catch { showToast("Failed to suspend", "error"); }
    finally { setActionLoading(null); }
  };

  const filteredUsers = users.filter(u =>
    u.fullName?.toLowerCase().includes(userFilter.toLowerCase()) ||
    u.phone?.includes(userFilter) ||
    u.email?.toLowerCase().includes(userFilter.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: any = {
      ACTIVE:               { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
      SUSPENDED:            { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
      PENDING_VERIFICATION: { bg: "#fff7ed", color: "#E8A020", border: "#fed7aa" },
      PENDING:              { bg: "#fff7ed", color: "#E8A020", border: "#fed7aa" },
      APPROVED:             { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
      REJECTED:             { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
      OPEN:                 { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
      BOOKED:               { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
      IN_TRANSIT:           { bg: "#fff7ed", color: "#E8A020", border: "#fed7aa" },
      DELIVERED:            { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
      CANCELLED:            { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
      ACCEPTED:             { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
      COMPLETED:            { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    };
    const s = map[status] || { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" };
    return (
      <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "20px", padding: "3px 10px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const pendingCount = users.filter(u => !u.isVerified && u.role !== "ADMIN").length;
  const pendingTrucks = trucks.filter(t => !t.isVerified).length;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "users",    label: "Users",    badge: pendingCount > 0 ? pendingCount : undefined },
    { key: "trucks",   label: "Trucks",   badge: pendingTrucks > 0 ? pendingTrucks : undefined },
    { key: "loads",    label: "Loads" },
    { key: "bookings", label: "Bookings" },
  ];

  if (!mounted || loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid var(--border)", borderTop: "3px solid #E8A020", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading admin panel...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--bg); background: var(--bg); white-space: nowrap; }
        .admin-table td { padding: 12px 16px; text-align: left; font-size: 13px; border-bottom: 1px solid var(--bg); vertical-align: middle; }
        .admin-table tr:hover td { background: var(--bg); }
        .action-btn { padding: 6px 12px; border-radius: 7px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
        }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 9999, background: toast.type === "success" ? "#16a34a" : "#dc2626", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease" }}>
          {toast.msg}
        </div>
      )}

      {selectedUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => { setSelectedUser(null); setUserDetail(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "640px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "40px", height: "4px", background: "#e5e7eb", borderRadius: "2px", margin: "12px auto 0" }} />
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bg)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: "700", color: "var(--primary)" }}>{selectedUser.fullName}</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>{selectedUser.role.replace("_", " ")} · {selectedUser.phone}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>{selectedUser.city}, {selectedUser.country}</p>
              </div>
              <button onClick={() => { setSelectedUser(null); setUserDetail(null); }} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "14px", color: "#6b7280", flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              {loadingDetail ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Loading...</div>
              ) : (
                <>
                  <h4 style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Uploaded Documents</h4>
                  {(() => {
                    const docs = userDetail?.senderProfile?.documents || userDetail?.truckOwnerProfile?.documents || [];
                    if (docs.length === 0) return <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>No documents uploaded yet.</p>;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {docs.map((doc: any) => (
                          <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f9f7f4", borderRadius: "10px", border: "1px solid var(--bg)", gap: "10px" }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: "600", fontSize: "13px", color: "var(--primary)" }}>{doc.documentType.replace(/_/g, " ")}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{(doc.fileSize / 1024).toFixed(0)} KB</div>
                            </div>
                            <button onClick={async () => {
                              try {
                                const res = await api.get("/uploads/presign?url=" + encodeURIComponent(doc.fileUrl));
                                window.open(res.data.url, "_blank");
                              } catch { alert("Failed to open document"); }
                            }} style={{ padding: "7px 14px", borderRadius: "8px", background: "var(--primary)", color: "#FAFAF8", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer", flexShrink: 0 }}>View</button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--bg)", display: "flex", gap: "10px" }}>
                    {(selectedUser.status === "PENDING_VERIFICATION" || selectedUser.status === "DOCUMENTS_SUBMITTED" || !selectedUser.isVerified) && selectedUser.role !== "ADMIN" && (
                      <>
                        <button onClick={() => { approve(selectedUser.id); setSelectedUser(null); setUserDetail(null); }} style={{ flex: 1, padding: "13px", borderRadius: "10px", border: "none", background: "#16a34a", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>✓ Approve</button>
                        <button onClick={() => { setRejectModal({ id: selectedUser.id, name: selectedUser.fullName }); setSelectedUser(null); setUserDetail(null); }} style={{ flex: 1, padding: "13px", borderRadius: "10px", border: "none", background: "#dc2626", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>✕ Reject</button>
                      </>
                    )}
                    {selectedUser.status === "ACTIVE" && selectedUser.isVerified && selectedUser.role !== "ADMIN" && (
                      <button onClick={() => { suspend(selectedUser.id); setSelectedUser(null); setUserDetail(null); }} style={{ flex: 1, padding: "13px", borderRadius: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>Suspend</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxWidth: "480px", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "40px", height: "4px", background: "#e5e7eb", borderRadius: "2px", margin: "0 auto 20px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "700", color: "var(--primary)" }}>Reject Verification</h3>
            <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#6b7280" }}>Rejecting <strong>{rejectModal.name}</strong>. Reason:</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Document unclear, ID expired..." style={{ width: "100%", height: "90px", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", fontSize: "14px", resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }} style={{ flex: 1, padding: "13px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "#6b7280", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={reject} disabled={!rejectReason.trim()} style={{ flex: 1, padding: "13px", borderRadius: "10px", border: "none", background: !rejectReason.trim() ? "var(--border)" : "#dc2626", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: rejectReason.trim() ? "pointer" : "not-allowed" }}>
                {actionLoading ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "#1B3A2D", padding: "0 20px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ height: "34px", objectFit: "contain" }} />
          <span style={{ background: "#E8A020", color: "#fff", fontSize: "10px", fontWeight: "700", padding: "3px 7px", borderRadius: "5px", letterSpacing: "0.5px" }}>ADMIN</span>
        </div>
        <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ background: activeTab === tab.key ? "rgba(240,235,224,0.15)" : "transparent", border: "none", borderRadius: "8px", padding: "6px 10px", color: activeTab === tab.key ? "#FAFAF8" : "rgba(240,235,224,0.5)", fontSize: "12px", fontWeight: activeTab === tab.key ? "600" : "400", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
              {tab.label}
              {tab.badge && <span style={{ background: "#dc2626", color: "#fff", fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "10px" }}>{tab.badge}</span>}
            </button>
          ))}
          <button onClick={() => { logout(); router.push("/auth/login"); }} style={{ marginLeft: "8px", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", padding: "7px 14px", color: "#fca5a5", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Sign Out</button>
        </div>
        <button className="mobile-only" style={{ display: "none", background: "rgba(240,235,224,0.1)", border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", color: "#FAFAF8" }} onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-only" style={{ display: "none", background: "#1B3A2D", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "8px 16px 12px" }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: activeTab === tab.key ? "rgba(240,235,224,0.12)" : "transparent", border: "none", borderRadius: "8px", padding: "11px 14px", color: "#FAFAF8", fontSize: "15px", fontWeight: activeTab === tab.key ? "600" : "400", cursor: "pointer", marginBottom: "4px" }}>
              {tab.label}
              {tab.badge && <span style={{ background: "#dc2626", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px" }}>{tab.badge}</span>}
            </button>
          ))}
          <button onClick={() => { logout(); router.push("/auth/login"); }} style={{ display: "flex", width: "100%", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", padding: "11px 14px", color: "#fca5a5", fontSize: "15px", fontWeight: "600", cursor: "pointer", marginTop: "8px" }}>Sign Out</button>
        </div>
      )}

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 14px" }}>

        {activeTab === "overview" && stats && (
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: "800", color: "var(--primary)" }}>Dashboard</h1>
            <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: "14px" }}>Welcome, {user?.fullName}</p>
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "24px" }}>
              {[
                { label: "Total Users",          value: stats.totalUsers,           color: "#2563eb" },
                { label: "Total Trucks",          value: stats.totalTrucks,          color: "#E8A020" },
                { label: "Total Loads",           value: stats.totalLoads,           color: "#7c3aed" },
                { label: "Total Bookings",        value: stats.totalBookings,        color: "#16a34a" },
                { label: "Pending Verifications", value: stats.pendingVerifications, color: "#dc2626" },
                { label: "Active Loads",          value: stats.activeLoads,          color: "#15803d" },
              ].map((s, i) => (
                <div key={i} style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--bg)" }}>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500", marginTop: "4px" }}>{s.label}</div>
                </div>
              ))}
            </div>
            {pendingCount > 0 && (
              <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid #fed7aa" }}>
                <h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: "700", color: "var(--primary)" }}>⏳ Pending Verifications ({pendingCount})</h2>
                {users.filter(u => !u.isVerified && u.role !== "ADMIN").slice(0, 5).map(u => (
                  <div key={u.id} onClick={() => openUserDetail(u)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--bg)", cursor: "pointer", gap: "10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--primary)" }}>{u.fullName}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{u.role.replace("_", " ")} · {u.phone}</div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); approve(u.id); }} disabled={actionLoading === u.id + "_approve"} style={{ padding: "6px 12px", borderRadius: "7px", border: "none", background: "#16a34a", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                        {actionLoading === u.id + "_approve" ? "..." : "Approve"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setRejectModal({ id: u.id, name: u.fullName }); }} style={{ padding: "6px 12px", borderRadius: "7px", border: "none", background: "#dc2626", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "var(--primary)", flex: 1 }}>Users ({filteredUsers.length})</h1>
              <input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Search..." style={{ padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--border)", fontSize: "14px", width: "200px", outline: "none", background: "var(--surface)" }} />
            </div>
            <div className="desktop-only" style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--bg)", overflow: "auto" }}>
              <table className="admin-table">
                <thead><tr>{["Name", "Phone", "Role", "Location", "Status", "Verification", "Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredUsers.map((u, i) => {
                    const verif = u.senderProfile?.verificationStatus || u.truckOwnerProfile?.verificationStatus;
                    return (
                      <tr key={u.id} onClick={() => openUserDetail(u)} style={{ cursor: "pointer", background: i % 2 === 0 ? "var(--surface)" : "#fdfcfb" }}>
                        <td><div style={{ fontWeight: "600", color: "var(--primary)" }}>{u.fullName}</div><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{u.email || "—"}</div></td>
                        <td style={{ color: "#4b5563" }}>{u.phone}</td>
                        <td><span style={{ fontSize: "12px", fontWeight: "600", color: u.role === "TRUCK_OWNER" ? "#E8A020" : u.role === "ADMIN" ? "#7c3aed" : "#2563eb" }}>{u.role.replace("_", " ")}</span></td>
                        <td style={{ color: "#4b5563" }}>{u.city}, {u.country}</td>
                        <td>{statusBadge(u.status)}</td>
                        <td>{verif ? statusBadge(verif) : <span style={{ color: "#d1d5db", fontSize: "12px" }}>—</span>}</td>
                        <td>
                          <div style={{ display: "flex", gap: "5px" }}>
                            {(u.status === "PENDING_VERIFICATION" || u.status === "DOCUMENTS_SUBMITTED" || !u.isVerified) && u.role !== "ADMIN" && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); approve(u.id); }} disabled={actionLoading === u.id + "_approve"} className="action-btn" style={{ background: "#16a34a", color: "#fff" }}>
                                  {actionLoading === u.id + "_approve" ? "..." : "Approve"}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setRejectModal({ id: u.id, name: u.fullName }); }} className="action-btn" style={{ background: "#dc2626", color: "#fff" }}>Reject</button>
                              </>
                            )}
                            {u.status === "ACTIVE" && u.isVerified && u.role !== "ADMIN" && (
                              <button onClick={(e) => suspend(u.id, e)} disabled={actionLoading === u.id + "_suspend"} className="action-btn" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626" }}>
                                {actionLoading === u.id + "_suspend" ? "..." : "Suspend"}
                              </button>
                            )}
                            {u.status === "SUSPENDED" && <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Suspended</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>No users found</div>}
            </div>
            <div className="mobile-only" style={{ display: "none" }}>
              {filteredUsers.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", background: "var(--surface)", borderRadius: "14px" }}>No users found</div>}
              {filteredUsers.map(u => {
                const verif = u.senderProfile?.verificationStatus || u.truckOwnerProfile?.verificationStatus;
                const needsAction = (!u.isVerified || u.status === "PENDING_VERIFICATION" || u.status === "DOCUMENTS_SUBMITTED") && u.role !== "ADMIN";
                return (
                  <div key={u.id} onClick={() => openUserDetail(u)} style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--bg)", marginBottom: "10px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--primary)" }}>{u.fullName}</div>
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>{u.phone}</div>
                      </div>
                      {statusBadge(u.status)}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: needsAction ? "12px" : "0" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: u.role === "TRUCK_OWNER" ? "#E8A020" : u.role === "ADMIN" ? "#7c3aed" : "#2563eb" }}>{u.role.replace("_", " ")}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>· {u.city}, {u.country}</span>
                      {verif && statusBadge(verif)}
                    </div>
                    {needsAction && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={(e) => { e.stopPropagation(); approve(u.id); }} disabled={actionLoading === u.id + "_approve"} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#16a34a", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                          {actionLoading === u.id + "_approve" ? "..." : "✓ Approve"}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setRejectModal({ id: u.id, name: u.fullName }); }} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#dc2626", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>✕ Reject</button>
                      </div>
                    )}
                    {u.status === "ACTIVE" && u.isVerified && u.role !== "ADMIN" && (
                      <button onClick={(e) => suspend(u.id, e)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>Suspend</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "trucks" && (
          <div>
            <h1 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: "800", color: "var(--primary)" }}>Trucks ({trucks.length})</h1>
            <div className="desktop-only" style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--bg)", overflow: "auto" }}>
              <table className="admin-table">
                <thead><tr>{["Plate", "Type", "Capacity", "Owner", "Location", "Status", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {trucks.map((t: any, i: number) => (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "#fdfcfb" }}>
                      <td><span style={{ fontWeight: "700", color: "var(--primary)", fontFamily: "monospace" }}>{t.plateNumber}</span></td>
                      <td>{t.truckType?.replace(/_/g, " ")}</td>
                      <td>{t.capacityTons}t</td>
                      <td><div style={{ fontWeight: "600", color: "var(--primary)" }}>{t.owner?.fullName}</div><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{t.owner?.phone}</div></td>
                      <td>{t.currentCity}, {t.currentCountry}</td>
                      <td><span style={{ fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", background: t.isVerified ? "#f0fdf4" : "#fff7ed", color: t.isVerified ? "#16a34a" : "#E8A020", border: `1px solid ${t.isVerified ? "#bbf7d0" : "#fed7aa"}` }}>{t.isVerified ? "Verified" : "Pending"}</span></td>
                      <td>{!t.isVerified ? <button onClick={async () => { try { await api.patch("/admin/trucks/" + t.id + "/verify"); showToast("Truck verified"); fetchAll(); } catch { showToast("Failed", "error"); } }} className="action-btn" style={{ background: "#16a34a", color: "#fff" }}>Verify</button> : <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>✓</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trucks.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>No trucks found</div>}
            </div>
            <div className="mobile-only" style={{ display: "none" }}>
              {trucks.map((t: any) => (
                <div key={t.id} style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--bg)", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--primary)", fontFamily: "monospace" }}>{t.plateNumber}</span>
                    <span style={{ fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", background: t.isVerified ? "#f0fdf4" : "#fff7ed", color: t.isVerified ? "#16a34a" : "#E8A020", border: `1px solid ${t.isVerified ? "#bbf7d0" : "#fed7aa"}` }}>{t.isVerified ? "Verified" : "Pending"}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#4b5563", marginBottom: "4px" }}>{t.truckType?.replace(/_/g, " ")} · {t.capacityTons}t</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary)" }}>{t.owner?.fullName}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: t.isVerified ? "0" : "12px" }}>{t.currentCity}, {t.currentCountry}</div>
                  {!t.isVerified && <button onClick={async () => { try { await api.patch("/admin/trucks/" + t.id + "/verify"); showToast("Truck verified"); fetchAll(); } catch { showToast("Failed", "error"); } }} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: "#16a34a", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>Verify Truck</button>}
                </div>
              ))}
              {trucks.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", background: "var(--surface)", borderRadius: "14px" }}>No trucks</div>}
            </div>
          </div>
        )}

        {activeTab === "loads" && (
          <div>
            <h1 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: "800", color: "var(--primary)" }}>Loads ({loads.length})</h1>
            <div className="desktop-only" style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--bg)", overflow: "auto" }}>
              <table className="admin-table">
                <thead><tr>{["Title", "Sender", "Route", "Weight", "Price", "Status", "Bookings"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {loads.map((l, i) => (
                    <tr key={l.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "#fdfcfb" }}>
                      <td><div style={{ fontWeight: "600", color: "var(--primary)" }}>{l.title}</div><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{new Date(l.createdAt).toLocaleDateString()}</div></td>
                      <td><div style={{ fontWeight: "600", color: "var(--primary)" }}>{l.sender?.fullName}</div><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{l.sender?.phone}</div></td>
                      <td>{l.pickupCity} → {l.deliveryCity}</td>
                      <td>{l.weightTons}t</td>
                      <td style={{ fontWeight: "600", color: "var(--primary)" }}>{l.offeredPrice} {l.currency}</td>
                      <td>{statusBadge(l.status)}</td>
                      <td style={{ textAlign: "center" }}>{l.bookings?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loads.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>No loads found</div>}
            </div>
            <div className="mobile-only" style={{ display: "none" }}>
              {loads.map(l => (
                <div key={l.id} style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--bg)", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--primary)", flex: 1, marginRight: "10px" }}>{l.title}</div>
                    {statusBadge(l.status)}
                  </div>
                  <div style={{ fontSize: "13px", color: "#4b5563", marginBottom: "4px" }}>📍 {l.pickupCity} → {l.deliveryCity}</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary)", marginBottom: "4px" }}>{l.sender?.fullName}</div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-secondary)" }}>
                    <span>⚖️ {l.weightTons}t</span>
                    <span>💰 {l.offeredPrice} {l.currency}</span>
                    <span>📋 {l.bookings?.length || 0} bookings</span>
                  </div>
                </div>
              ))}
              {loads.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", background: "var(--surface)", borderRadius: "14px" }}>No loads</div>}
            </div>
          </div>
        )}

        {activeTab === "bookings" && (
          <div>
            <h1 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: "800", color: "var(--primary)" }}>Bookings ({bookings.length})</h1>
            <div className="desktop-only" style={{ background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--bg)", overflow: "auto" }}>
              <table className="admin-table">
                <thead><tr>{["Load", "Route", "Sender", "Truck Owner", "Truck", "Price", "Status"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {bookings.map((b, i) => (
                    <tr key={b.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "#fdfcfb" }}>
                      <td><div style={{ fontWeight: "600", color: "var(--primary)" }}>{b.load?.title}</div><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{new Date(b.createdAt).toLocaleDateString()}</div></td>
                      <td>{b.load?.pickupCity} → {b.load?.deliveryCity}</td>
                      <td><div style={{ fontWeight: "600", color: "var(--primary)" }}>{b.sender?.fullName}</div><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{b.sender?.phone}</div></td>
                      <td><div style={{ fontWeight: "600", color: "var(--primary)" }}>{b.owner?.fullName}</div><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{b.owner?.phone}</div></td>
                      <td style={{ fontFamily: "monospace" }}>{b.truck?.plateNumber}</td>
                      <td style={{ fontWeight: "600", color: "var(--primary)" }}>{b.agreedPrice} {b.currency}</td>
                      <td>{statusBadge(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookings.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>No bookings found</div>}
            </div>
            <div className="mobile-only" style={{ display: "none" }}>
              {bookings.map(b => (
                <div key={b.id} style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--bg)", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--primary)", flex: 1, marginRight: "10px" }}>{b.load?.title}</div>
                    {statusBadge(b.status)}
                  </div>
                  <div style={{ fontSize: "13px", color: "#4b5563", marginBottom: "6px" }}>📍 {b.load?.pickupCity} → {b.load?.deliveryCity}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px" }}>
                    <div><span style={{ color: "var(--text-secondary)" }}>Sender</span><div style={{ fontWeight: "600", color: "var(--primary)" }}>{b.sender?.fullName}</div></div>
                    <div><span style={{ color: "var(--text-secondary)" }}>Owner</span><div style={{ fontWeight: "600", color: "var(--primary)" }}>{b.owner?.fullName}</div></div>
                    <div><span style={{ color: "var(--text-secondary)" }}>Truck</span><div style={{ fontWeight: "600", color: "var(--primary)", fontFamily: "monospace" }}>{b.truck?.plateNumber}</div></div>
                    <div><span style={{ color: "var(--text-secondary)" }}>Price</span><div style={{ fontWeight: "600", color: "var(--primary)" }}>{b.agreedPrice} {b.currency}</div></div>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", background: "var(--surface)", borderRadius: "14px" }}>No bookings</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
