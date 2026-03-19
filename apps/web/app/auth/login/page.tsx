"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (user && token) router.push("/dashboard");
  }, []);
  const { setAuth } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { phone, password });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      if (res.data.user.status === "PENDING_VERIFICATION") {
        router.push("/auth/verify");
      } else if (res.data.user.role === "DRIVER") {
        router.push("/driver");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
<div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#f0ebe0" }}>
      <div className="auth-left" style={{ width: "52%", background: "#1a2744", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: "52px 60px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(240,220,170,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(200,144,30,0.08) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", right: "-120px", top: "50%", transform: "translateY(-50%)", width: "500px", height: "500px", borderRadius: "50%", border: "1px solid rgba(240,220,170,0.05)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
          <div style={{ width: "38px", height: "38px", background: "#c8901e", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M1 3h15v13H1z" stroke="#1a2744" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M16 8h4l3 3v5h-7V8z" stroke="#1a2744" strokeWidth="1.8" strokeLinejoin="round"/>
              <circle cx="5.5" cy="18.5" r="2.5" stroke="#1a2744" strokeWidth="1.8"/>
              <circle cx="18.5" cy="18.5" r="2.5" stroke="#1a2744" strokeWidth="1.8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#f0ebe0", letterSpacing: "-0.5px" }}>Sahid Freight</div>
            <div style={{ fontSize: "10px", color: "#c8901e", letterSpacing: "2px", marginTop: "-2px" }}>ETHIOPIA · SOMALIA · DJIBOUTI</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ width: "48px", height: "3px", background: "#c8901e", borderRadius: "2px", marginBottom: "32px" }} />
          <h1 style={{ fontSize: "50px", fontWeight: "800", color: "#f0ebe0", lineHeight: "1.12", margin: "0 0 24px", letterSpacing: "-2px" }}>
            Move freight.<br />
            <span style={{ color: "#c8901e" }}>Move forward.</span>
          </h1>
          <p style={{ color: "rgba(240,235,224,0.4)", fontSize: "16px", lineHeight: "1.75", maxWidth: "360px", margin: "0 0 48px" }}>
            Connect with verified truck owners. Post loads. Track shipments live across Ethiopia, Somalia, and Djibouti.
          </p>
          <div style={{ display: "flex", gap: "0" }}>
            {[["3", "Countries"], ["Live", "GPS"], ["100%", "Verified"]].map(([val, label], i) => (
              <div key={label} style={{ paddingRight: "32px", marginRight: "32px", borderRight: i < 2 ? "1px solid rgba(240,235,224,0.08)" : "none" }}>
                <div style={{ fontSize: "26px", fontWeight: "800", color: "#f0ebe0", letterSpacing: "-1px" }}>{val}</div>
                <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.3)", letterSpacing: "2px", textTransform: "uppercase" as const, marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(240,235,224,0.06)", paddingTop: "24px" }}>
          <p style={{ color: "rgba(240,235,224,0.2)", fontSize: "12px", margin: 0 }}>© 2025 Sahid Freight.et · Ethiopia · Somalia · Djibouti</p>
        </div>
      </div>

      <div className="auth-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px", background: "#f0ebe0" }}>
        <div className="auth-card" style={{ width: "100%", maxWidth: "400px" }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "48px 44px", boxShadow: "0 2px 4px rgba(26,39,68,0.04), 0 16px 48px rgba(26,39,68,0.10)", border: "1px solid rgba(26,39,68,0.06)" }}>
            <div style={{ marginBottom: "36px" }}>
              <h2 style={{ fontSize: "26px", fontWeight: "800", color: "#1a2744", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Welcome back</h2>
              <p style={{ color: "#9e9890", fontSize: "14px", margin: 0 }}>Sign in to your account</p>
            </div>

            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "24px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1a2744", marginBottom: "8px" }}>Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 900 000 000" required onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)} style={{ width: "100%", background: focused === "phone" ? "#fff" : "#faf8f4", border: `1.5px solid ${focused === "phone" ? "#1a2744" : "#e8e3d8"}`, borderRadius: "10px", padding: "13px 16px", color: "#1a2744", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, fontFamily: "monospace", transition: "all 0.15s", boxShadow: focused === "phone" ? "0 0 0 3px rgba(26,39,68,0.08)" : "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1a2744", marginBottom: "8px" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} style={{ width: "100%", background: focused === "password" ? "#fff" : "#faf8f4", border: `1.5px solid ${focused === "password" ? "#1a2744" : "#e8e3d8"}`, borderRadius: "10px", padding: "13px 16px", color: "#1a2744", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s", boxShadow: focused === "password" ? "0 0 0 3px rgba(26,39,68,0.08)" : "none" }} />
              </div>
              <button type="submit" disabled={loading} style={{ marginTop: "6px", width: "100%", background: loading ? "#e8e3d8" : "#1a2744", border: "none", borderRadius: "10px", padding: "15px", color: loading ? "#aaa" : "#f0ebe0", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.2px", transition: "all 0.2s" }}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid #f0ede6", textAlign: "center" as const }}>
              <span style={{ color: "#9e9890", fontSize: "14px" }}>No account? </span>
              <a href="/auth/register" style={{ color: "#c8901e", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>Register here</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  
  );
}