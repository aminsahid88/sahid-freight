"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { Shield, CheckCircle, Clock, User, Lock, LogOut, FileText, Bell, ChevronRight, AlertCircle } from "lucide-react";

const inputStyle = { width: "100%", background: "#faf8f4", border: "1.5px solid #e8e3d8", borderRadius: "10px", padding: "11px 14px", fontSize: "14px", color: "#1a2744", outline: "none", boxSizing: "border-box" as const };
const labelStyle = { display: "block" as const, fontSize: "12px", fontWeight: "600" as const, color: "#6b7280", marginBottom: "6px", textTransform: "uppercase" as const, letterSpacing: "0.5px" };
const cardStyle = { background: "#fff", borderRadius: "14px", border: "1px solid #ede9e0", marginBottom: "16px" };

export default function ProfilePage() {
  const router = useRouter();
  const { user, setAuth, logout } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [toast, setToast] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    setFullName(user.fullName || "");
    setCity((user as any).city || "");
    setCountry((user as any).country || "");
  }, [user]);



  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSaveProfile = async () => {
    setSaving(true); setProfileError(""); setProfileSuccess("");
    try {
      await api.patch("/users/me", { fullName, city, country });
      const updatedUser = { ...user!, fullName, city, country };
      const token = localStorage.getItem("accessToken")!;
      const refresh = localStorage.getItem("refreshToken")!;
      setAuth(updatedUser, token, refresh);
      showToast("Profile updated successfully");
    } catch (err: any) {
      setProfileError(err.response?.data?.message || "Failed to update profile");
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters"); return; }
    setChangingPassword(true); setPasswordError(""); setPasswordSuccess("");
    try {
      await api.patch("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setShowPasswordSection(false);
      showToast("Password changed successfully");
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || "Failed to change password");
    } finally { setChangingPassword(false); }
  };

  const completeness = () => {
    let score = 0;
    if (user?.fullName) score += 25;
    if ((user as any)?.city) score += 25;
    if ((user as any)?.country) score += 25;
    if (user?.isVerified) score += 25;
    return score;
  };

  const countries = [
    { value: "ETHIOPIA", label: "Ethiopia" },
    { value: "SOMALIA", label: "Somalia" },
    { value: "DJIBOUTI", label: "Djibouti" },
  ];

  const verificationStatus = user?.isVerified ? "verified" : "pending";

  return (
    <div style={{ maxWidth: "720px" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed" as const, top: "24px", right: "24px", background: "#1a2744", color: "#f0ebe0", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle size={16} color="#4ade80" />{toast}
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1a2744", letterSpacing: "-0.5px" }}>Profile</h1>
        <div style={{ fontSize: "13px", color: "#9e9890", marginTop: "3px" }}>Manage your account and preferences</div>
      </div>

      {/* Identity card */}
      <div style={{ ...cardStyle, padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "20px" }}>
          <div style={{ width: "68px", height: "68px", borderRadius: "16px", background: "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", fontWeight: "800", color: "#f0ebe0", flexShrink: 0 }}>
            {user?.fullName?.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a2744" }}>{user?.fullName}</div>
            <div style={{ fontSize: "13px", color: "#9e9890", marginTop: "2px" }}>{user?.phone}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" as const }}>
              <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: "#f0ebe0", color: "#1a2744" }}>
                {user?.role?.replace(/_/g, " ")}
              </span>
              <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: verificationStatus === "verified" ? "#f0fdf4" : "#fff7ed", color: verificationStatus === "verified" ? "#16a34a" : "#c8901e", border: `1px solid ${verificationStatus === "verified" ? "#bbf7d0" : "#fed7aa"}`, display: "flex", alignItems: "center", gap: "4px" }}>
                {verificationStatus === "verified" ? <CheckCircle size={11} /> : <Clock size={11} />}
                {verificationStatus === "verified" ? "Verified" : "Pending Verification"}
              </span>
            </div>
          </div>
        </div>



        {/* Profile completeness */}
        <div style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Profile Completeness</span>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#1a2744" }}>{completeness()}%</span>
          </div>
          <div style={{ height: "6px", background: "#f0ede6", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${completeness()}%`, background: completeness() === 100 ? "#16a34a" : "#c8901e", borderRadius: "99px", transition: "width 0.3s" }} />
          </div>
          {completeness() < 100 && (
            <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "5px" }}>
              {!user?.isVerified && "Upload verification documents to complete your profile."}
              {user?.isVerified && !(user as any)?.city && "Add your city to complete your profile."}
            </div>
          )}
        </div>
      </div>

      {/* Verification status */}
      {!user?.isVerified && (
        <div style={{ ...cardStyle, padding: "18px 20px", background: "#fff7ed", border: "1px solid #fed7aa" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(200,144,30,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8901e", flexShrink: 0 }}>
                <Shield size={18} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#92400e" }}>Account Not Verified</div>
                <div style={{ fontSize: "12px", color: "#b45309", marginTop: "1px" }}>Upload your documents to unlock full access</div>
              </div>
            </div>
            <button onClick={() => router.push("/dashboard/verify")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#c8901e", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" as const }}>
              Upload Docs <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {user?.isVerified && (
        <div style={{ ...cardStyle, padding: "18px 20px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(22,163,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a", flexShrink: 0 }}>
              <CheckCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#15803d" }}>Account Verified</div>
              <div style={{ fontSize: "12px", color: "#16a34a", marginTop: "1px" }}>Your identity and documents have been verified</div>
            </div>
          </div>
        </div>
      )}

      {/* Personal information */}
      <div style={{ ...cardStyle, padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <User size={16} color="#1a2744" />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#1a2744" }}>Personal Information</h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} placeholder="Your full name" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Phone Number</label>
            <input value={user?.phone} disabled style={{ ...inputStyle, background: "#f0ede6", color: "#9e9890", fontFamily: "monospace" }} />
            <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "4px" }}>Phone number cannot be changed</div>
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} placeholder="Your city" />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <select value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}>
              <option value="">Select country</option>
              {countries.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {profileError && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", marginTop: "14px", fontSize: "13px", color: "#dc2626" }}>
            <AlertCircle size={14} />{profileError}
          </div>
        )}

        <button onClick={handleSaveProfile} disabled={saving} style={{ marginTop: "18px", background: saving ? "#e8e3d8" : "#1a2744", border: "none", borderRadius: "9px", padding: "11px 22px", color: saving ? "#aaa" : "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Change password */}
      <div style={cardStyle}>
        <button onClick={() => setShowPasswordSection(!showPasswordSection)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Lock size={16} color="#1a2744" />
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#1a2744" }}>Change Password</span>
          </div>
          <ChevronRight size={16} color="#9e9890" style={{ transform: showPasswordSection ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </button>

        {showPasswordSection && (
          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
              {[
                { label: "Current Password", value: currentPassword, setter: setCurrentPassword },
                { label: "New Password", value: newPassword, setter: setNewPassword },
                { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <input type="password" value={value} onChange={e => setter(e.target.value)} style={inputStyle} placeholder="••••••••" />
                </div>
              ))}
            </div>

            {passwordError && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", marginTop: "12px", fontSize: "13px", color: "#dc2626" }}>
                <AlertCircle size={14} />{passwordError}
              </div>
            )}

            <button onClick={handleChangePassword} disabled={changingPassword} style={{ marginTop: "16px", background: changingPassword ? "#e8e3d8" : "#1a2744", border: "none", borderRadius: "9px", padding: "11px 22px", color: changingPassword ? "#aaa" : "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: changingPassword ? "not-allowed" : "pointer" }}>
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>

      {/* Notification preferences */}
      <div style={{ ...cardStyle, padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
          <Bell size={16} color="#1a2744" />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#1a2744" }}>Notification Preferences</h3>
        </div>
        {[
          { label: "Booking updates", desc: "When your booking is accepted or rejected" },
          { label: "New load alerts", desc: "When new loads match your truck type" },
          { label: "Payment notifications", desc: "When payments are processed" },
          { label: "System announcements", desc: "Platform updates and news" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < 3 ? "1px solid #faf8f4" : "none" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a2744" }}>{item.label}</div>
              <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "1px" }}>{item.desc}</div>
            </div>
            <div style={{ width: "40px", height: "22px", borderRadius: "99px", background: "#1a2744", position: "relative" as const, cursor: "pointer", flexShrink: 0 }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff", position: "absolute" as const, top: "3px", right: "3px", transition: "all 0.2s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Documents */}
      <div style={{ ...cardStyle, padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={16} color="#1a2744" />
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#1a2744" }}>Verification Documents</h3>
          </div>
          <button onClick={() => router.push("/dashboard/verify")} style={{ fontSize: "12px", fontWeight: "600", color: "#c8901e", background: "none", border: "none", cursor: "pointer" }}>
            Manage →
          </button>
        </div>
        <div style={{ background: "#faf8f4", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          {user?.isVerified ? (
            <>
              <CheckCircle size={20} color="#16a34a" />
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#15803d" }}>All documents verified</div>
                <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "1px" }}>Your account has full access</div>
              </div>
            </>
          ) : (
            <>
              <Clock size={20} color="#c8901e" />
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#92400e" }}>Documents under review</div>
                <div style={{ fontSize: "11px", color: "#9e9890", marginTop: "1px" }}>Usually takes 24 hours</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div style={{ ...cardStyle, padding: "24px", border: "1px solid #fecaca" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <LogOut size={16} color="#dc2626" />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#dc2626" }}>Sign Out</h3>
        </div>
        <p style={{ color: "#9e9890", fontSize: "13px", margin: "0 0 14px" }}>You will be signed out of your Sahid Freight account on this device.</p>
        {!signOutConfirm ? (
          <button onClick={() => setSignOutConfirm(true)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "9px", padding: "10px 20px", color: "#dc2626", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
            Sign Out
          </button>
        ) : (
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>Are you sure?</span>
            <button onClick={() => { logout(); router.push("/"); }} style={{ background: "#dc2626", border: "none", borderRadius: "9px", padding: "10px 20px", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
              Yes, Sign Out
            </button>
            <button onClick={() => setSignOutConfirm(false)} style={{ background: "#f5f3ef", border: "none", borderRadius: "9px", padding: "10px 20px", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
