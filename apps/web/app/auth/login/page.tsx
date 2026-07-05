"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatApiError } from "@/lib/errors";

const COUNTRIES = [
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "SO", name: "Somalia",  dial: "+252" },
  { code: "DJ", name: "Djibouti", dial: "+253" },
];

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        const dest = parsed.role === "DRIVER" ? "/driver"
                   : parsed.role === "BROKER" ? "/dashboard/broker"
                   : "/dashboard";
        router.push(dest);
      } catch { router.push("/dashboard"); }
    }
  }, [router]);

  const [country, setCountry] = useState(COUNTRIES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fullPhone = `${country.dial}${phone.replace(/^0+/, "")}`;
      const res = await api.post("/auth/login", { phone: fullPhone, password });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      if (res.data.user.status === "PENDING_VERIFICATION") {
        router.push("/auth/verify");
      } else if (res.data.user.role === "DRIVER") {
        router.push("/driver");
      } else if (res.data.user.role === "BROKER") {
        router.push("/dashboard/broker");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(formatApiError(err, "We couldn't sign you in. Please try again.", "auth"));
    } finally {
      setLoading(false);
    }
  };

  const P = "var(--primary)";
  const A = "var(--accent)";

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter, system-ui, sans-serif", background: "var(--bg)" }}>

      {/* ── LEFT PANEL — untouched ── */}
      <div className="auth-left" style={{ width: "52%", background: "#0A1F44", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: "52px 60px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(61,123,255,0.08) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", right: "-120px", top: "50%", transform: "translateY(-50%)", width: "500px", height: "500px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.5px" }}>Sahid Freight</div>
            <div style={{ fontSize: "10px", color: "#3D7BFF", letterSpacing: "2px", marginTop: "-2px" }}>ETHIOPIA · SOMALIA · DJIBOUTI</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ width: "48px", height: "3px", background: "#3D7BFF", borderRadius: "2px", marginBottom: "32px" }} />
          <h1 style={{ fontSize: "50px", fontWeight: "800", color: "#FFFFFF", lineHeight: "1.12", margin: "0 0 24px", letterSpacing: "-2px" }}>
            Move a load.<br />
            <span style={{ color: "#3D7BFF" }}>Watch it move.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", lineHeight: "1.75", maxWidth: "360px", margin: "0 0 48px" }}>
            A broker dispatches a verified truck. You see live GPS from pickup to delivery across Ethiopia, Somalia, and Djibouti.
          </p>
          <div style={{ display: "flex", gap: "0" }}>
            {[["3", "Countries"], ["Live", "GPS"], ["Verified", "Fleet"]].map(([val, label], i) => (
              <div key={label} style={{ paddingRight: "32px", marginRight: "32px", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <div style={{ fontSize: "26px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-1px" }}>{val}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase" as const, marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", margin: 0 }}>© {new Date().getFullYear()} Sahid Freight · Ethiopia · Somalia · Djibouti</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px", background: "var(--bg)" }}>
        <div className="auth-card" style={{ width: "100%", maxWidth: "400px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "48px 44px", boxShadow: "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.10)", border: "1px solid rgba(10,31,68,0.06)" }}>

            <div style={{ marginBottom: "36px" }}>
              <h2 style={{ fontSize: "26px", fontWeight: "800", color: P, margin: "0 0 8px", letterSpacing: "-0.5px" }}>Welcome back</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>Sign in to keep dispatching loads.</p>
            </div>

            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "var(--danger)", fontSize: "14px", marginBottom: "24px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>

              {/* Phone Number */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: P, marginBottom: "8px" }}>Phone number</label>
                <div style={{ display: "flex", gap: "8px" }}>

                  {/* Country dropdown */}
                  <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      style={{
                        height: "50px", padding: "0 12px",
                        background: focused === "phone" ? "var(--surface)" : "var(--bg)",
                        border: `1.5px solid ${focused === "phone" ? P : "var(--border)"}`,
                        borderRadius: "10px", display: "flex", alignItems: "center",
                        gap: "6px", cursor: "pointer", minWidth: "110px", transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.5px" }}>{country.code}</span>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: A, fontFamily: "monospace" }}>{country.dial}</span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                        style={{ marginLeft: "auto", transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M1 3l4 4 4-4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 4px)", left: 0, width: "200px",
                        background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "12px",
                        overflow: "hidden", zIndex: 50, boxShadow: "0 8px 32px rgba(10,31,68,0.12)",
                      }}>
                        {COUNTRIES.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => { setCountry(c); setDropdownOpen(false); }}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: "10px",
                              padding: "12px 16px", background: country.code === c.code ? "var(--bg)" : "var(--surface)",
                              border: "none", borderBottom: "1px solid #E2E8F0", cursor: "pointer", textAlign: "left" as const,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "13px", fontWeight: "700", color: P }}>{c.name}</div>
                              <div style={{ fontSize: "12px", color: A, fontFamily: "monospace" }}>{c.dial}</div>
                            </div>
                            {country.code === c.code && (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 7l4 4 6-6" stroke={A} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Number input */}
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="911 234 567"
                    required
                    onFocus={() => setFocused("phone")}
                    onBlur={() => setFocused(null)}
                    style={{
                      flex: 1, height: "50px",
                      background: focused === "phone" ? "var(--surface)" : "var(--bg)",
                      border: `1.5px solid ${focused === "phone" ? P : "var(--border)"}`,
                      borderRadius: "10px", padding: "0 16px", color: P,
                      fontSize: "15px", outline: "none", boxSizing: "border-box" as const,
                      fontFamily: "monospace", transition: "all 0.15s",
                      boxShadow: focused === "phone" ? "0 0 0 3px rgba(10,31,68,0.08)" : "none",
                    }}
                  />
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "6px 0 0 0" }}>Skip the country code — it's already selected on the left.</p>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: P }}>Password</label>
                  <a href="/auth/forgot-password" style={{ fontSize: "12px", color: A, textDecoration: "none", fontWeight: "600" }}>Forgot password?</a>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    style={{
                      width: "100%", height: "50px",
                      background: focused === "password" ? "var(--surface)" : "var(--bg)",
                      border: `1.5px solid ${focused === "password" ? P : "var(--border)"}`,
                      borderRadius: "10px", padding: "0 44px 0 16px", color: P,
                      fontSize: "15px", outline: "none", boxSizing: "border-box" as const,
                      transition: "all 0.15s",
                      boxShadow: focused === "password" ? "0 0 0 3px rgba(10,31,68,0.08)" : "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-secondary)" }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                        <line x1="2" y1="2" x2="16" y2="16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Keep me signed in */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  onClick={() => setKeepSignedIn(!keepSignedIn)}
                  style={{
                    width: "18px", height: "18px", borderRadius: "5px", cursor: "pointer", flexShrink: 0,
                    background: keepSignedIn ? P : "var(--surface)",
                    border: `2px solid ${keepSignedIn ? P : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                  }}
                >
                  {keepSignedIn && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l3 3 4-4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" as const }}
                  onClick={() => setKeepSignedIn(!keepSignedIn)}>
                  Keep me signed in
                </span>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "4px", width: "100%", height: "50px",
                  background: loading ? "var(--border)" : A,
                  border: "none", borderRadius: "10px",
                  color: loading ? "#aaa" : "#FFFFFF",
                  fontSize: "15px", fontWeight: "700",
                  cursor: loading ? "not-allowed" : "pointer",
                  letterSpacing: "0.5px", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                {loading ? "Signing in…" : "Sign in →"}
              </button>

            </form>

            <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid #E2E8F0", textAlign: "center" as const }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>New here? </span>
              <a href="/auth/register" style={{ color: A, fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>Create an account</a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
