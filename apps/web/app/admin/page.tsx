"use client";
import { Truck, Package, Bell, Shield, DollarSign, Globe, Clock, MapPin, CheckCircle, AlertCircle, Inbox, BellOff, Fuel, Box, Minimize2, Container } from "lucide-react";
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

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "ADMIN") { router.push("/dashboard"); return; }
    fetchAll();
  }, [mounted, user]);

  const fetchAll = async () => {
    try {
      const [statsRes, usersRes, loadsRes, bookingsRes, trucksRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/loads"),
        api.get("/admin/bookings"),
        api.get("/admin/trucks"),
      ]);
      setStats(statsRes.data.stats);
      setUsers(usersRes.data.users || []);
      setLoads(loadsRes.data.loads || []);
      setBookings(bookingsRes.data.bookings || []);
      setTrucks(trucksRes?.data?.trucks || []);
      setTrucks(trucksRes.data.trucks || []);
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

  const approve = async (id: string) => {
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

  const suspend = async (id: string) => {
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
      PENDING_VERIFICATION: { bg: "#fff7ed", color: "#c8901e", border: "#fed7aa" },
      PENDING:              { bg: "#fff7ed", color: "#c8901e", border: "#fed7aa" },
      APPROVED:             { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
      REJECTED:             { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
      OPEN:                 { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
      BOOKED:               { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
      IN_TRANSIT:           { bg: "#fff7ed", color: "#c8901e", border: "#fed7aa" },
      DELIVERED:            { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
      CANCELLED:            { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
      ACCEPTED:             { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
      COMPLETED:            { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    };
    const s = map[status] || { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" };
    return (
      <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "20px", padding: "3px 10px", fontSize: "12px", fontWeight: "600" }}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const pendingCount = users.filter(u => u.status === "PENDING_VERIFICATION").length;
  const pendingTrucks = trucks.filter(t => !t.isVerified).length;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users",    label: `Users${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}` },
    { key: "trucks",   label: `Trucks${pendingTrucks > 0 ? ` (${pendingTrucks} unverified)` : ""}` },
    { key: "loads",    label: "Loads" },
    { key: "bookings", label: "Bookings" },
  ];

  if (!mounted || loading) return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid #e8e3d8", borderTop: "3px solid #c8901e", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#9e9890", fontSize: "14px" }}>Loading admin panel...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: toast.type === "success" ? "#16a34a" : "#dc2626", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "640px", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #f0ebe0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: "700", color: "#1a2744" }}>{selectedUser.fullName}</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#9e9890" }}>{selectedUser.role.replace("_", " ")} · {selectedUser.phone} · {selectedUser.city}, {selectedUser.country}</p>
              </div>
              <button onClick={() => { setSelectedUser(null); setUserDetail(null); }} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "14px", color: "#6b7280" }}>✕ Close</button>
            </div>
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {loadingDetail ? (
                <div style={{ textAlign: "center", padding: "48px", color: "#9e9890" }}>Loading documents...</div>
              ) : (
                <>
                  <h4 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#1a2744", textTransform: "uppercase", letterSpacing: "0.5px" }}>Uploaded Documents</h4>
                  {(() => {
                    const docs = userDetail?.senderProfile?.documents || userDetail?.truckOwnerProfile?.documents || [];
                    if (docs.length === 0) return <p style={{ color: "#9e9890", fontSize: "14px" }}>No documents uploaded yet.</p>;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {docs.map((doc: any) => (
                          <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f9f7f4", borderRadius: "10px", border: "1px solid #f0ebe0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a2744", flexShrink: 0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                              <div>
                                <div style={{ fontWeight: "600", fontSize: "14px", color: "#1a2744" }}>{doc.documentType.replace(/_/g, " ")}</div>
                                <div style={{ fontSize: "12px", color: "#9e9890" }}>{doc.fileName} · {(doc.fileSize / 1024).toFixed(0)} KB</div>
                              </div>
                            </div>
                            <button onClick={async () => {
                              try {
                                const res = await api.get("/uploads/presign?url=" + encodeURIComponent(doc.fileUrl));
                                window.open(res.data.url, "_blank");
                              } catch { alert("Failed to open document"); }
                            }} style={{ padding: "7px 14px", borderRadius: "8px", background: "#1a2744", color: "#f0ebe0", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer" }}>View →</button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f0ebe0", display: "flex", gap: "12px" }}>
                    {selectedUser.status === "PENDING_VERIFICATION" && <>
                      <button onClick={() => { approve(selectedUser.id); setSelectedUser(null); setUserDetail(null); }} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#16a34a", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Approve</button>
                      <button onClick={() => { setRejectModal({ id: selectedUser.id, name: selectedUser.fullName }); setSelectedUser(null); setUserDetail(null); }} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#dc2626", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Reject</button>
                    </>}
                    {selectedUser.status === "ACTIVE" && selectedUser.role !== "ADMIN" && (
                      <button onClick={() => { suspend(selectedUser.id); setSelectedUser(null); setUserDetail(null); }} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Suspend User</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", width: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "700", color: "#1a2744" }}>Reject Verification</h3>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#6b7280" }}>Rejecting <strong>{rejectModal.name}</strong>. Please provide a reason:</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Document unclear, ID expired, information mismatch..."
              style={{ width: "100%", height: "100px", padding: "12px", borderRadius: "8px", border: "1px solid #e8e3d8", fontSize: "14px", resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #e8e3d8", background: "#fff", color: "#6b7280", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={reject} disabled={!rejectReason.trim()} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: !rejectReason.trim() ? "#e8e3d8" : "#dc2626", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: rejectReason.trim() ? "pointer" : "not-allowed" }}>
                {actionLoading ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <div style={{ background: "#1a2744", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img src="/loadlink.png" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
          <span style={{ background: "#c8901e", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", letterSpacing: "0.5px" }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ background: activeTab === tab.key ? "rgba(240,235,224,0.15)" : "transparent", border: "none", borderRadius: "8px", padding: "8px 16px", color: activeTab === tab.key ? "#f0ebe0" : "rgba(240,235,224,0.5)", fontSize: "14px", fontWeight: activeTab === tab.key ? "600" : "400", cursor: "pointer", transition: "all 0.15s" }}>
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => { logout(); router.push("/auth/login"); }} style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", padding: "8px 16px", color: "#fca5a5", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
          Sign Out
        </button>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>

        {/* OVERVIEW */}
        {activeTab === "overview" && stats && (
          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: "800", color: "#1a2744" }}>Admin Dashboard</h1>
            <p style={{ margin: "0 0 32px", color: "#9e9890", fontSize: "14px" }}>Welcome back, {user?.fullName}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
              {[
                { label: "Total Users",           value: stats.totalUsers,           icon: "users", color: "#2563eb" },
                { label: "Total Trucks",           value: stats.totalTrucks,          icon: "truck", color: "#c8901e" },
                { label: "Total Loads",            value: stats.totalLoads,           icon: "package", color: "#7c3aed" },
                { label: "Total Bookings",         value: stats.totalBookings,        icon: "bookmark", color: "#16a34a" },
                { label: "Pending Verifications",  value: stats.pendingVerifications, icon: "clock", color: "#dc2626" },
                { label: "Active Loads",           value: stats.activeLoads,          icon: "circle", color: "#15803d" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #f0ebe0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ marginBottom: "12px", color: s.color }}>{s.icon === "users" ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> : s.icon === "truck" ? <Truck size={24} /> : s.icon === "package" ? <Package size={24} /> : s.icon === "bookmark" ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg> : s.icon === "clock" ? <Clock size={24} /> : <CheckCircle size={24} />}</div>
                  <div style={{ fontSize: "32px", fontWeight: "800", color: s.color, marginBottom: "4px" }}>{s.value}</div>
                  <div style={{ fontSize: "13px", color: "#9e9890", fontWeight: "500" }}>{s.label}</div>
                </div>
              ))}
            </div>
            {pendingCount > 0 && (
              <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #fed7aa" }}>
                <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "700", color: "#1a2744" }}>Pending Verifications</h2>
                {users.filter(u => u.status === "PENDING_VERIFICATION").map(u => (
                  <div key={u.id} onClick={() => openUserDetail(u)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #faf8f4", cursor: "pointer" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "14px", color: "#1a2744" }}>{u.fullName}</div>
                      <div style={{ fontSize: "12px", color: "#9e9890" }}>{u.role.replace("_", " ")} · {u.phone} · {u.city}, {u.country}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => approve(u.id)} disabled={actionLoading === u.id + "_approve"} style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#16a34a", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                        {actionLoading === u.id + "_approve" ? "..." : "Approve"}
                      </button>
                      <button onClick={() => setRejectModal({ id: u.id, name: u.fullName })} style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#dc2626", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* USERS */}
        {activeTab === "users" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1a2744" }}>All Users ({users.length})</h1>
              <input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Search name, phone, email..." style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #e8e3d8", fontSize: "14px", width: "280px", outline: "none", background: "#fff" }} />
            </div>
            <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #f0ebe0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9f7f4" }}>
                    {["Name", "Phone", "Role", "Location", "Status", "Verification", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#9e9890", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #f0ebe0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => {
                    const verif = u.senderProfile?.verificationStatus || u.truckOwnerProfile?.verificationStatus;
                    return (
                      <tr key={u.id} onClick={() => openUserDetail(u)} style={{ borderBottom: "1px solid #faf8f4", background: i % 2 === 0 ? "#fff" : "#fdfcfb", cursor: "pointer" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: "600", fontSize: "14px", color: "#1a2744" }}>{u.fullName}</div>
                          <div style={{ fontSize: "12px", color: "#9e9890" }}>{u.email || "—"}</div>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{u.phone}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: u.role === "TRUCK_OWNER" ? "#c8901e" : u.role === "ADMIN" ? "#7c3aed" : "#2563eb" }}>
                            {u.role.replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{u.city}, {u.country}</td>
                        <td style={{ padding: "14px 16px" }}>{statusBadge(u.status)}</td>
                        <td style={{ padding: "14px 16px" }}>{verif ? statusBadge(verif) : <span style={{ color: "#d1d5db", fontSize: "12px" }}>—</span>}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {u.status === "PENDING_VERIFICATION" && <>
                              <button onClick={() => approve(u.id)} disabled={actionLoading === u.id + "_approve"} style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: "#16a34a", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                                {actionLoading === u.id + "_approve" ? "..." : "Approve"}
                              </button>
                              <button onClick={() => setRejectModal({ id: u.id, name: u.fullName })} style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: "#dc2626", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Reject</button>
                            </>}
                            {u.status === "ACTIVE" && u.role !== "ADMIN" && (
                              <button onClick={() => suspend(u.id)} disabled={actionLoading === u.id + "_suspend"} style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                                {actionLoading === u.id + "_suspend" ? "..." : "Suspend"}
                              </button>
                            )}
                            {u.status === "SUSPENDED" && <span style={{ fontSize: "12px", color: "#9e9890" }}>Suspended</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "#9e9890" }}>No users found</div>}
            </div>
          </div>
        )}

        {/* LOADS */}
        {activeTab === "loads" && (
          <div>
            <h1 style={{ margin: "0 0 24px", fontSize: "22px", fontWeight: "800", color: "#1a2744" }}>All Loads ({loads.length})</h1>
            <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #f0ebe0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9f7f4" }}>
                    {["Title", "Sender", "Route", "Weight", "Price", "Status", "Bookings"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#9e9890", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #f0ebe0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loads.map((l, i) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid #faf8f4", background: i % 2 === 0 ? "#fff" : "#fdfcfb" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: "600", fontSize: "14px", color: "#1a2744" }}>{l.title}</div>
                        <div style={{ fontSize: "12px", color: "#9e9890" }}>{new Date(l.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{l.sender?.fullName}</div>
                        <div style={{ fontSize: "12px", color: "#9e9890" }}>{l.sender?.phone}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{l.pickupCity} → {l.deliveryCity}</td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{l.weightTons}t</td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{l.offeredPrice} {l.currency}</td>
                      <td style={{ padding: "14px 16px" }}>{statusBadge(l.status)}</td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563", textAlign: "center" }}>{l.bookings?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loads.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "#9e9890" }}>No loads found</div>}
            </div>
          </div>
        )}

        {/* TRUCKS */}
        {activeTab === "trucks" && (
          <div>
            <h1 style={{ margin: "0 0 24px", fontSize: "22px", fontWeight: "800", color: "#1a2744" }}>All Trucks ({trucks.length})</h1>
            <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #f0ebe0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9f7f4" }}>
                    {["Plate", "Type", "Capacity", "Owner", "Location", "Verified", "Action"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#9e9890", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #f0ebe0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((t: any, i: number) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #faf8f4", background: i % 2 === 0 ? "#fff" : "#fdfcfb" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: "700", fontSize: "14px", color: "#1a2744", fontFamily: "monospace" }}>{t.plateNumber}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{t.truckType?.replace(/_/g, " ")}</td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{t.capacityTons}t</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{t.owner?.fullName}</div>
                        <div style={{ fontSize: "12px", color: "#9e9890" }}>{t.owner?.phone}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{t.currentCity}, {t.currentCountry}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px", background: t.isVerified ? "#f0fdf4" : "#fff7ed", color: t.isVerified ? "#16a34a" : "#c8901e", border: `1px solid ${t.isVerified ? "#bbf7d0" : "#fed7aa"}` }}>
                          {t.isVerified ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {!t.isVerified && (
                          <button onClick={async () => {
                            try {
                              await api.patch("/admin/trucks/" + t.id + "/verify");
                              showToast("Truck verified");
                              fetchAll();
                            } catch { showToast("Failed", "error"); }
                          }} style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: "#16a34a", color: "#fff", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                            Verify
                          </button>
                        )}
                        {t.isVerified && <span style={{ fontSize: "12px", color: "#9e9890" }}>Verified</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trucks.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "#9e9890" }}>No trucks found</div>}
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {activeTab === "bookings" && (
          <div>
            <h1 style={{ margin: "0 0 24px", fontSize: "22px", fontWeight: "800", color: "#1a2744" }}>All Bookings ({bookings.length})</h1>
            <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #f0ebe0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9f7f4" }}>
                    {["Load", "Route", "Sender", "Truck Owner", "Truck", "Price", "Status"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#9e9890", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #f0ebe0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: "1px solid #faf8f4", background: i % 2 === 0 ? "#fff" : "#fdfcfb" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: "600", fontSize: "14px", color: "#1a2744" }}>{b.load?.title}</div>
                        <div style={{ fontSize: "12px", color: "#9e9890" }}>{new Date(b.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{b.load?.pickupCity} → {b.load?.deliveryCity}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{b.sender?.fullName}</div>
                        <div style={{ fontSize: "12px", color: "#9e9890" }}>{b.sender?.phone}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{b.owner?.fullName}</div>
                        <div style={{ fontSize: "12px", color: "#9e9890" }}>{b.owner?.phone}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#4b5563" }}>{b.truck?.plateNumber}</td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{b.agreedPrice} {b.currency}</td>
                      <td style={{ padding: "14px 16px" }}>{statusBadge(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookings.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "#9e9890" }}>No bookings found</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

