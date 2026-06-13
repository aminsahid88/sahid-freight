"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import api from "@/lib/api";

const P = "var(--primary)";
const A = "var(--accent)";

const inp = {
  width: "100%", background: "var(--bg)", border: "1.5px solid var(--border)",
  borderRadius: "10px", padding: "10px 14px", fontSize: "14px",
  color: P, outline: "none", boxSizing: "border-box" as const,
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, setAuth, logout } = useAuthStore();
  const { language, setLanguage } = useSettingsStore();

  const [editing, setEditing]   = useState(false);
  const [fullName, setFullName] = useState("");
  const [city, setCity]         = useState("");
  const [country, setCountry]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState("");

  const [showPw, setShowPw]         = useState(false);
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwLoading, setPwLoading]   = useState(false);
  const [pwErr, setPwErr]           = useState("");

  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    setFullName(user.fullName || "");
    setCity((user as any).city || "");
    setCountry((user as any).country || "");
  }, [user]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const saveProfile = async () => {
    setSaving(true); setSaveErr("");
    try {
      await api.patch("/users/me", { fullName, city, country });
      const token   = localStorage.getItem("accessToken")!;
      const refresh = localStorage.getItem("refreshToken")!;
      setAuth({ ...user!, fullName, city, country } as any, token, refresh);
      setEditing(false);
      showToast("Profile updated");
    } catch (err: any) {
      setSaveErr(err.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (newPw !== confirmPw) { setPwErr("Passwords do not match"); return; }
    if (newPw.length < 8)    { setPwErr("Minimum 8 characters"); return; }
    setPwLoading(true); setPwErr("");
    try {
      await api.patch("/users/me/password", { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setShowPw(false);
      showToast("Password changed");
    } catch (err: any) {
      setPwErr(err.response?.data?.message || "Failed to update password");
    } finally { setPwLoading(false); }
  };

  const countries = [
    { value: "ETHIOPIA", label: "Ethiopia" },
    { value: "SOMALIA",  label: "Somalia"  },
    { value: "DJIBOUTI", label: "Djibouti" },
  ];

  const langs = [
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "am", label: "አማርኛ",   flag: "🇪🇹" },
    { code: "so", label: "Soomaali", flag: "🇸🇴" },
  ];

  const avgRating   = (user as any)?.averageRating;
  const totalRatings = (user as any)?.totalRatings || 0;

  return (
    <div style={{ maxWidth: "540px" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", background: P, color: "#FAFAF8", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* ── Hero: Avatar + Name + Badges ── */}
      <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", padding: "32px 24px 24px", marginBottom: "12px", textAlign: "center" }}>
        {/* Avatar */}
        <div style={{ width: "88px", height: "88px", borderRadius: "50%", background: P, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "34px", fontWeight: "800", color: "#FAFAF8", margin: "0 auto 16px", border: "4px solid var(--border)" }}>
          {user?.fullName?.charAt(0)?.toUpperCase()}
        </div>
        <div style={{ fontSize: "20px", fontWeight: "800", color: P, marginBottom: "4px" }}>{user?.fullName}</div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>{user?.phone}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: "#F1F5F9", color: P }}>
            {user?.role?.replace(/_/g, " ")}
          </span>

          <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: user?.isVerified ? "#F0FDF4" : "#FFF7ED", color: user?.isVerified ? "#16A34A" : "#F59E0B", border: `1px solid ${user?.isVerified ? "#BBF7D0" : "#FED7AA"}` }}>
            {user?.isVerified ? "✓ Verified" : "⏳ Pending Verification"}
          </span>
          {totalRatings > 0 && avgRating && (
            <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px", background: "#FFFBEB", color: "#92400E", border: "1px solid #FCD34D" }}>
              ★ {Number(avgRating).toFixed(1)} ({totalRatings})
            </span>
          )}
        </div>
      </div>

      {/* ── Card 1: Personal Info ── */}
      <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", marginBottom: "12px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: P }}>Personal Information</span>
          {!editing ? (
            <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", color: A, fontSize: "12px", fontWeight: "700", cursor: "pointer", padding: "4px 8px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => { setEditing(false); setSaveErr(""); setFullName(user?.fullName || ""); setCity((user as any)?.city || ""); setCountry((user as any)?.country || ""); }}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: "7px", padding: "4px 12px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={saveProfile} disabled={saving}
                style={{ background: P, border: "none", borderRadius: "7px", padding: "4px 14px", fontSize: "12px", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: "700", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Fields */}
        {[
          { label: "Full Name",    value: fullName,  set: setFullName,  editable: true,  type: "text"   },
          { label: "Phone",        value: user?.phone || "", set: () => {}, editable: false, type: "text" },
          { label: "City",         value: city,      set: setCity,      editable: true,  type: "text"   },
        ].map(({ label, value, set, editable, type }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--bg)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>{label}</div>
              {editing && editable ? (
                <input type={type} value={value} onChange={e => (set as any)(e.target.value)} style={{ ...inp, padding: "6px 10px", fontSize: "13px", marginTop: "2px" }} />
              ) : (
                <div style={{ fontSize: "14px", color: editable ? P : "var(--text-muted)", fontWeight: "500" }}>{value || <span style={{ color: "#C4C4C4" }}>—</span>}</div>
              )}
            </div>
            {!editable && <div style={{ fontSize: "11px", color: "#C4C4C4" }}>locked</div>}
          </div>
        ))}

        {/* Country select */}
        <div style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: editing ? "6px" : "2px" }}>Country</div>
          {editing ? (
            <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...inp, padding: "6px 10px", fontSize: "13px" }}>
              <option value="">Select country</option>
              {countries.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: "14px", color: P, fontWeight: "500" }}>
              {countries.find(c => c.value === country)?.label || <span style={{ color: "#C4C4C4" }}>—</span>}
            </div>
          )}
        </div>

        {saveErr && (
          <div style={{ margin: "0 20px 16px", padding: "10px 14px", background: "#FEF2F2", borderRadius: "8px", fontSize: "13px", color: "#DC2626", border: "1px solid #FECACA" }}>{saveErr}</div>
        )}
      </div>

      {/* ── Card 2: Account Settings ── */}
      <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", marginBottom: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: "700", color: P }}>Account Settings</div>

        {/* Language */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Language</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {langs.map(lang => (
              <button key={lang.code} onClick={() => setLanguage(lang.code as any)}
                style={{ flex: 1, padding: "9px 6px", borderRadius: "10px", border: `2px solid ${language === lang.code ? P : "var(--border)"}`, background: language === lang.code ? P : "var(--bg)", color: language === lang.code ? "#FAFAF8" : P, fontSize: "12px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "18px" }}>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Change password toggle */}
        <button onClick={() => { setShowPw(!showPw); setPwErr(""); }}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "none", border: "none", cursor: "pointer", borderBottom: showPw ? "1px solid var(--border)" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: P }}>Change Password</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showPw ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        {showPw && (
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Current password", val: currentPw, set: setCurrentPw },
                { label: "New password",     val: newPw,     set: setNewPw     },
                { label: "Confirm password", val: confirmPw, set: setConfirmPw },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#6B7280", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
                  <input type="password" value={val} onChange={e => set(e.target.value)} style={inp} placeholder="••••••••" />
                </div>
              ))}
            </div>
            {pwErr && <div style={{ marginTop: "10px", fontSize: "12px", color: "#DC2626" }}>{pwErr}</div>}
            <button onClick={changePassword} disabled={pwLoading}
              style={{ marginTop: "14px", width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: pwLoading ? "var(--border)" : P, color: pwLoading ? "#aaa" : "#FAFAF8", fontSize: "13px", fontWeight: "700", cursor: pwLoading ? "not-allowed" : "pointer" }}>
              {pwLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      </div>

      {/* ── Card 3: Verification ── */}
      <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", marginBottom: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: "700", color: P }}>Verification</div>
        <div style={{ padding: "20px" }}>
          {user?.isVerified ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", background: "#F0FDF4", borderRadius: "12px", border: "1px solid #BBF7D0" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(22,163,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#15803D" }}>Account Verified</div>
                <div style={{ fontSize: "12px", color: "#16A34A", marginTop: "2px" }}>Your identity and documents have been confirmed</div>
              </div>
            </div>
          ) : user?.status === "DOCUMENTS_SUBMITTED" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", background: "#E8F0FF", borderRadius: "12px", border: "1px solid #BBD0FF" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(37,99,235,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3D7BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#1E40AF" }}>Under Review</div>
                <div style={{ fontSize: "12px", color: "#3D7BFF", marginTop: "2px" }}>Usually approved within 24 hours</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "16px", background: "#FFF7ED", borderRadius: "12px", border: "1px solid #FED7AA" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#92400E" }}>Not Verified</div>
                  <div style={{ fontSize: "12px", color: "#B45309", marginTop: "2px" }}>Upload documents to unlock full access</div>
                </div>
              </div>
              <button onClick={() => router.push("/dashboard/verify")}
                style={{ background: A, border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: "700", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                Upload →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Card 4: Danger Zone ── */}
      <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid #FECACA", marginBottom: "32px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #FEF2F2", fontSize: "13px", fontWeight: "700", color: "#DC2626" }}>Danger Zone</div>
        <div style={{ padding: "20px" }}>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
            You will be signed out of your Sahid Freight account on this device.
          </div>
          {!signOutConfirm ? (
            <button onClick={() => setSignOutConfirm(true)}
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", padding: "11px 20px", color: "#DC2626", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
              Sign Out
            </button>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Are you sure?</span>
              <button onClick={() => { logout(); router.push("/"); }}
                style={{ background: "#DC2626", border: "none", borderRadius: "9px", padding: "11px 20px", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                Yes, Sign Out
              </button>
              <button onClick={() => setSignOutConfirm(false)}
                style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "9px", padding: "11px 20px", color: "#6B7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
