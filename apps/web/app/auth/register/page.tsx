"use client";
import { useState } from "react";
import { Truck, Package, Bell, Shield, DollarSign, Globe, Clock, MapPin, CheckCircle, AlertCircle, Inbox, BellOff, RefrigeratorIcon, Fuel, Container, Box, Minimize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState(1);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "",
    country: "",
    city: "",
    email: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/register", {
        fullName: form.fullName,
        phone: form.phone,
        password: form.password,
        role: form.role,
        country: form.country,
        city: form.city,
        email: form.email,
      });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      if (res.data.user.status === "PENDING_VERIFICATION") { router.push("/auth/verify"); } else { router.push("/dashboard"); }
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => ({
    width: "100%",
    background: focused === field ? "#fff" : "#faf8f4",
    border: `1.5px solid ${focused === field ? "#1a2744" : "#e8e3d8"}`,
    borderRadius: "10px",
    padding: "13px 16px",
    color: "#1a2744",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "all 0.15s",
    boxShadow: focused === field ? "0 0 0 3px rgba(26,39,68,0.08)" : "none",
  });

  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: "700" as const,
    color: "#1a2744",
    marginBottom: "8px",
    letterSpacing: "0.2px",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#f0ebe0" }}>

      {/* Left Panel */}
      <div className="auth-left" style={{ width: "44%", background: "#1a2744", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: "52px 56px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(240,220,170,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(200,144,30,0.08) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", right: "-120px", top: "50%", transform: "translateY(-50%)", width: "500px", height: "500px", borderRadius: "50%", border: "1px solid rgba(240,220,170,0.05)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
          <img src="/loadlink.png" alt="Sahid Freight" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#f0ebe0", letterSpacing: "-0.5px" }}>Sahid Freight</div>
            <div style={{ fontSize: "10px", color: "#c8901e", letterSpacing: "2px", marginTop: "-2px" }}>ETHIOPIA · SOMALIA · DJIBOUTI</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ width: "48px", height: "3px", background: "#c8901e", borderRadius: "2px", marginBottom: "32px" }} />
          <h1 style={{ fontSize: "42px", fontWeight: "800", color: "#f0ebe0", lineHeight: "1.15", margin: "0 0 24px", letterSpacing: "-1.5px" }}>
            Join the<br />
            <span style={{ color: "#c8901e" }}>network.</span>
          </h1>
          <p style={{ color: "rgba(240,235,224,0.4)", fontSize: "15px", lineHeight: "1.8", maxWidth: "300px", margin: "0 0 48px" }}>
            Whether you own trucks or need to move cargo — Sahid Freight connects you with the right partner instantly.
          </p>

          {/* Role cards */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
            {[
              { icon: "truck", title: "Truck Owner", desc: "List your trucks, accept load requests" },
              { icon: "package", title: "Cargo Sender", desc: "Post loads, find trucks, track delivery" },
            ].map((r) => (
              <div key={r.title} style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(240,235,224,0.04)", border: "1px solid rgba(240,235,224,0.06)", borderRadius: "10px", padding: "14px 16px" }}>
                {r.icon === "truck" ? <Truck size={22} color="#c8901e" />  : <Package size={22} color="#c8901e" />}
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#f0ebe0" }}>{r.title}</div>
                  <div style={{ fontSize: "12px", color: "rgba(240,235,224,0.3)", marginTop: "2px" }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(240,235,224,0.06)", paddingTop: "24px" }}>
          <p style={{ color: "rgba(240,235,224,0.2)", fontSize: "12px", margin: 0 }}>© 2025 Sahid Freight.et</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px", background: "#f0ebe0" }}>
        <div style={{ width: "100%", maxWidth: "460px" }}>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
            {[1, 2].map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: step >= s ? "#1a2744" : "#e8e3d8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", color: step >= s ? "#f0ebe0" : "#9e9890", transition: "all 0.2s" }}>
                  {s}
                </div>
                <span style={{ fontSize: "13px", color: step >= s ? "#1a2744" : "#9e9890", fontWeight: step >= s ? "600" : "400" }}>
                  {s === 1 ? "Your Info" : "Account Details"}
                </span>
                {s < 2 && <div style={{ width: "32px", height: "1px", background: step > s ? "#1a2744" : "#e8e3d8", margin: "0 4px" }} />}
              </div>
            ))}
          </div>

          {/* Card */}
          <div style={{ background: "#fff", borderRadius: "20px", padding: "44px", boxShadow: "0 2px 4px rgba(26,39,68,0.04), 0 16px 48px rgba(26,39,68,0.10)", border: "1px solid rgba(26,39,68,0.06)" }}>

            <div style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1a2744", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                {step === 1 ? "Create your account" : "Almost done"}
              </h2>
              <p style={{ color: "#9e9890", fontSize: "14px", margin: 0 }}>
                {step === 1 ? "Step 1 of 2 — Basic information" : "Step 2 of 2 — Choose your role"}
              </p>
            </div>

            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "24px" }}>
                {error}
              </div>
            )}

            <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setError(""); setStep(2); } : handleSubmit}>
              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input type="text" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Amin Abdirahman" required onFocus={() => setFocused("fullName")} onBlur={() => setFocused(null)} style={inputStyle("fullName")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+251 900 000 000" required onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)} style={{ ...inputStyle("phone"), fontFamily: "monospace" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" required onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={inputStyle("email")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Min. 8 characters" required onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} style={inputStyle("password")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder="Repeat your password" required onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)} style={inputStyle("confirm")} />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                  {/* Role selection */}
                  <div>
                    <label style={labelStyle}>I am a...</label>
                    <div style={{ display: "flex", gap: "12px" }}>
                      {[{ value: "CARGO_SENDER", label: "Cargo Sender" }, { value: "TRUCK_OWNER", label: "Truck Owner" }].map((r) => (
                        <div key={r.value} onClick={() => update("role", r.value)} style={{ flex: 1, padding: "14px", borderRadius: "10px", border: `2px solid ${form.role === r.value ? "#1a2744" : "#e8e3d8"}`, background: form.role === r.value ? "#f0ebe0" : "#fff", cursor: "pointer", textAlign: "center" as const, fontSize: "14px", fontWeight: "600", color: form.role === r.value ? "#1a2744" : "#9e9890", transition: "all 0.15s" }}>
                          {r.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Country */}
                  <div>
                    <label style={labelStyle}>Country</label>
                    <select value={form.country} onChange={(e) => update("country", e.target.value)} required onFocus={() => setFocused("country")} onBlur={() => setFocused(null)} style={{ ...inputStyle("country"), appearance: "none" as const }}>
                      <option value="">Select country</option>
                      <option value="ETHIOPIA">Ethiopia</option>
                      <option value="SOMALIA">Somalia</option>
                      <option value="DJIBOUTI">Djibouti</option>
                    </select>
                  </div>

                  {/* City */}
                  <div>
                    <label style={labelStyle}>City</label>
                    <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Addis Ababa" required onFocus={() => setFocused("city")} onBlur={() => setFocused(null)} style={inputStyle("city")} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
                {step === 2 && (
                  <button type="button" onClick={() => setStep(1)} style={{ flex: 1, background: "#f0ebe0", border: "none", borderRadius: "10px", padding: "14px", color: "#1a2744", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                    Back
                  </button>
                )}
                <button type="submit" disabled={loading || (step === 2 && !form.role)} style={{ flex: 2, background: loading || (step === 2 && !form.role) ? "#e8e3d8" : "#1a2744", border: "none", borderRadius: "10px", padding: "14px", color: loading || (step === 2 && !form.role) ? "#aaa" : "#f0ebe0", fontSize: "15px", fontWeight: "700", cursor: loading || (step === 2 && !form.role) ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {loading ? "Creating account..." : step === 1 ? "Continue" : "Create Account"}
                </button>
              </div>
            </form>

            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #f0ede6", textAlign: "center" as const }}>
              <span style={{ color: "#9e9890", fontSize: "14px" }}>Already have an account? </span>
              <a href="/auth/login" style={{ color: "#c8901e", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>Sign in</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}