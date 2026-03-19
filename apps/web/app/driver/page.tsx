"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { Navigation, Package, User, LogOut, MapPin, Truck, CheckCircle, Clock, Phone, Lock, ChevronRight, AlertCircle } from "lucide-react";

type Tab = "home" | "profile";

export default function DriverDashboard() {
  const router = useRouter();
  const { user, logout, setAuth } = useAuthStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "DRIVER") { router.push("/dashboard"); return; }
    setFullName(user.fullName || "");
    setCity((user as any).city || "");
    fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    try {
      const res = await api.get("/bookings/driver/my");
      setBookings(res.data.bookings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const saveProfile = async () => {
    setSaving(true); setProfileMsg("");
    try {
      await api.patch("/users/me", { fullName, city });
      const token = localStorage.getItem("accessToken")!;
      const refresh = localStorage.getItem("refreshToken")!;
      setAuth({ ...user!, fullName, city } as any, token, refresh);
      showToast("Profile updated");
    } catch { setProfileMsg("Failed to update profile"); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setPwError("Minimum 8 characters"); return; }
    setChangingPw(true); setPwError(""); setPwMsg("");
    try {
      await api.patch("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showToast("Password changed");
    } catch (err: any) { setPwError(err.response?.data?.message || "Failed"); }
    finally { setChangingPw(false); }
  };

  const activeBooking = bookings.find(b => b.status === "ACCEPTED" && b.load?.status === "IN_TRANSIT");
  const pendingBooking = bookings.find(b => b.status === "ACCEPTED" && b.load?.status !== "IN_TRANSIT");
  const completedCount = bookings.filter(b => b.status === "COMPLETED").length;

  const inp = { width: "100%", padding: "10px 14px", borderRadius: "9px", border: "1px solid #ede9e0", fontSize: "13px", color: "#1a2744", outline: "none", background: "#faf8f4", boxSizing: "border-box" as const };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1a2744", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", border: "3px solid rgba(240,235,224,0.2)", borderTop: "3px solid #c8901e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef", fontFamily: "'Helvetica Neue', Arial, sans-serif", paddingBottom: "72px" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {toast && <div style={{ position: "fixed" as const, top: "16px", right: "16px", background: "#1a2744", color: "#f0ebe0", padding: "12px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999 }}>{toast}</div>}

      {/* Header */}
      <div style={{ background: "#1a2744", padding: "0 20px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/loadlink.png" alt="Sahid Freight" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
          <span style={{ fontSize: "15px", fontWeight: "900", color: "#fff" }}>Sahid Freight</span>
          <span style={{ background: "#c8901e", color: "#fff", fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "5px" }}>DRIVER</span>
        </div>
        <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "#c8901e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#fff" }}>
          {user?.fullName?.charAt(0)}
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: "600px", margin: "0 auto" }}>

        {/* ── HOME TAB ── */}
        {tab === "home" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#1a2744", margin: "0 0 2px" }}>Hello, {user?.fullName?.split(" ")[0]}</h1>
              <p style={{ fontSize: "13px", color: "#9e9890", margin: 0 }}>
                {activeBooking ? "You have an active journey" : pendingBooking ? "You have a new assignment" : "No active assignments"}
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #ede9e0" }}>
                <div style={{ fontSize: "11px", color: "#9e9890", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "6px" }}>Completed</div>
                <div style={{ fontSize: "26px", fontWeight: "800", color: "#1a2744" }}>{completedCount}</div>
                <div style={{ fontSize: "11px", color: "#9e9890" }}>deliveries</div>
              </div>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #ede9e0" }}>
                <div style={{ fontSize: "11px", color: "#9e9890", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "6px" }}>Status</div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: activeBooking ? "#16a34a" : pendingBooking ? "#c8901e" : "#6b7280" }}>
                  {activeBooking ? "On Trip" : pendingBooking ? "Assigned" : "Available"}
                </div>
              </div>
            </div>

            {/* Active journey */}
            {activeBooking && (
              <div style={{ background: "#1a2744", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#4ade80", letterSpacing: "0.8px" }}>ACTIVE JOURNEY</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#f0ebe0", marginBottom: "6px" }}>{activeBooking.load?.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(240,235,224,0.5)", marginBottom: "16px" }}>
                  <MapPin size={12} />{activeBooking.load?.pickupCity} → {activeBooking.load?.deliveryCity}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  <div style={{ background: "rgba(240,235,224,0.06)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(240,235,224,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "3px" }}>Truck</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#f0ebe0", fontFamily: "monospace" }}>{activeBooking.truck?.plateNumber}</div>
                  </div>
                  <div style={{ background: "rgba(240,235,224,0.06)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(240,235,224,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "3px" }}>Type</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#f0ebe0" }}>{activeBooking.truck?.truckType?.replace(/_/g, " ")}</div>
                  </div>
                </div>
                <a href={"/tracking/" + activeBooking.id} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px", borderRadius: "10px", background: "#c8901e", color: "#fff", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>
                  <Navigation size={16} /> Continue Journey
                </a>
              </div>
            )}

            {/* Pending assignment */}
            {pendingBooking && !activeBooking && (
              <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", marginBottom: "16px", border: "1px solid #ede9e0" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#c8901e", marginBottom: "10px", letterSpacing: "0.8px" }}>NEW ASSIGNMENT</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", marginBottom: "6px" }}>{pendingBooking.load?.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#6b7280", marginBottom: "14px" }}>
                  <MapPin size={12} />{pendingBooking.load?.pickupCity} → {pendingBooking.load?.deliveryCity}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  <div style={{ background: "#faf8f4", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "#9e9890", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "3px" }}>Truck</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#1a2744", fontFamily: "monospace" }}>{pendingBooking.truck?.plateNumber}</div>
                  </div>
                  <div style={{ background: "#faf8f4", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "#9e9890", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "3px" }}>Weight</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#1a2744" }}>{pendingBooking.load?.weightTons}t</div>
                  </div>
                  <div style={{ background: "#faf8f4", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "#9e9890", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "3px" }}>Price</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#1a2744" }}>${pendingBooking.agreedPrice}</div>
                  </div>
                </div>
                <a href={"/tracking/" + pendingBooking.id} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px", borderRadius: "10px", background: "#1a2744", color: "#f0ebe0", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>
                  <Navigation size={16} /> Start Journey
                </a>
              </div>
            )}

            {/* No assignments */}
            {!activeBooking && !pendingBooking && (
              <div style={{ background: "#fff", borderRadius: "14px", padding: "48px 24px", textAlign: "center" as const, border: "1px solid #ede9e0" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#f5f3ef", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#c8c0b0" }}><Truck size={24} /></div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a2744", marginBottom: "6px" }}>No assignments yet</div>
                <div style={{ fontSize: "13px", color: "#9e9890" }}>Your fleet owner will assign you to a booking soon.</div>
              </div>
            )}

            {/* Past deliveries */}
            {bookings.filter(b => b.status === "COMPLETED").length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#9e9890", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "10px" }}>Past Deliveries</div>
                {bookings.filter(b => b.status === "COMPLETED").map((b: any) => (
                  <div key={b.id} style={{ background: "#fff", borderRadius: "10px", padding: "14px 16px", marginBottom: "8px", border: "1px solid #ede9e0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{b.load?.title}</div>
                      <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "2px" }}>{b.load?.pickupCity} → {b.load?.deliveryCity}</div>
                    </div>
                    <CheckCircle size={16} color="#16a34a" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === "profile" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#1a2744", margin: 0 }}>Profile</h1>
              <p style={{ fontSize: "13px", color: "#9e9890", margin: "3px 0 0" }}>Manage your account</p>
            </div>

            {/* Avatar card */}
            <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #ede9e0", marginBottom: "14px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "800", color: "#f0ebe0", flexShrink: 0 }}>
                {user?.fullName?.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#1a2744" }}>{user?.fullName}</div>
                <div style={{ fontSize: "12px", color: "#9e9890", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Phone size={11} />{user?.phone}
                </div>
                <div style={{ marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "99px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                    {completedCount} deliveries completed
                  </span>
                </div>
              </div>
            </div>

            {/* Personal info */}
            <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #ede9e0", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a2744", marginBottom: "14px" }}>Personal Information</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Full Name</label>
                  <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Phone</label>
                  <input style={{ ...inp, background: "#f0ede6", color: "#9e9890" }} value={user?.phone} disabled />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>City</label>
                  <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" />
                </div>
              </div>
              {profileMsg && <div style={{ fontSize: "12px", color: "#dc2626", marginTop: "10px" }}>{profileMsg}</div>}
              <button onClick={saveProfile} disabled={saving} style={{ marginTop: "14px", width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: saving ? "#e8e3d8" : "#1a2744", color: saving ? "#aaa" : "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Change password */}
            <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #ede9e0", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a2744", marginBottom: "14px" }}>Change Password</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                {[
                  { label: "Current Password", val: currentPassword, set: setCurrentPassword },
                  { label: "New Password", val: newPassword, set: setNewPassword },
                  { label: "Confirm Password", val: confirmPassword, set: setConfirmPassword },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{label}</label>
                    <input type="password" style={inp} value={val} onChange={e => set(e.target.value)} placeholder="••••••••" />
                  </div>
                ))}
              </div>
              {pwError && <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#dc2626", marginTop: "10px" }}><AlertCircle size={13} />{pwError}</div>}
              <button onClick={changePassword} disabled={changingPw} style={{ marginTop: "14px", width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: changingPw ? "#e8e3d8" : "#1a2744", color: changingPw ? "#aaa" : "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: changingPw ? "not-allowed" : "pointer" }}>
                {changingPw ? "Updating..." : "Update Password"}
              </button>
            </div>

            {/* Sign out */}
            <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#dc2626", marginBottom: "6px" }}>Sign Out</div>
              <p style={{ fontSize: "12px", color: "#9e9890", margin: "0 0 12px" }}>Sign out of your driver account.</p>
              <button onClick={() => { logout(); router.push("/auth/login"); }} style={{ width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed" as const, bottom: 0, left: 0, right: 0, height: "64px", background: "#1a2744", display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(240,235,224,0.1)", zIndex: 100 }}>
        <button onClick={() => setTab("home")} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 20px", color: tab === "home" ? "#c8901e" : "rgba(240,235,224,0.4)" }}>
          <Package size={20} />
          <span style={{ fontSize: "10px", fontWeight: tab === "home" ? "700" : "400" }}>Home</span>
        </button>
        <button onClick={() => setTab("profile")} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 20px", color: tab === "profile" ? "#c8901e" : "rgba(240,235,224,0.4)" }}>
          <User size={20} />
          <span style={{ fontSize: "10px", fontWeight: tab === "profile" ? "700" : "400" }}>Profile</span>
        </button>
      </nav>
    </div>
  );
}
