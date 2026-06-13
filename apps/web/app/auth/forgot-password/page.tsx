"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const COUNTRIES = [
  { code: "ET", name: "Ethiopia",  dial: "+251", flag: "🇪🇹" },
  { code: "SO", name: "Somalia",   dial: "+252", flag: "🇸🇴" },
  { code: "DJ", name: "Djibouti", dial: "+253", flag: "🇩🇯" },
];

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp" | "password">("phone");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const fullPhone = `${country.dial}${phone.replace(/^0+/, "")}`;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true); setError("");
    try {
      await api.post("/auth/forgot-password", { phone: fullPhone });
      setStep("otp");
      startCountdown();
      setTimeout(() => inputs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== "")) handleVerifyOtp(newOtp.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async (code?: string) => {
    const finalOtp = code || otp.join("");
    if (finalOtp.length !== 6) return;
    setStep("password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/reset-password", { phone: fullPhone, otp: otp.join(""), newPassword });
      router.push("/auth/login");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
      if (err.response?.data?.message?.includes("code") || err.response?.data?.message?.includes("OTP")) {
        setStep("otp");
        setOtp(["", "", "", "", "", ""]);
      }
    } finally { setLoading(false); }
  };

  const LeftPanel = () => (
    <div className="fp-left" style={{ width: "52%", background: "#0A1F44", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: "52px 60px" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(61,123,255,0.08) 0%, transparent 50%)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
        <img src="/logo.svg" alt="Sahid Freight" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#F8FAFC", letterSpacing: "-0.5px" }}>Sahid Freight</div>
          <div style={{ fontSize: "10px", color: "#3D7BFF", letterSpacing: "2px", marginTop: "-2px" }}>ETHIOPIA · SOMALIA · DJIBOUTI</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ width: "48px", height: "3px", background: "#3D7BFF", borderRadius: "2px", marginBottom: "32px" }} />
        <h1 style={{ fontSize: "42px", fontWeight: "800", color: "#F8FAFC", lineHeight: "1.15", margin: "0 0 24px", letterSpacing: "-1.5px" }}>
          Reset your<br /><span style={{ color: "#3D7BFF" }}>password.</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", lineHeight: "1.8", maxWidth: "300px" }}>
          Enter your phone number and we'll send a reset code to your registered email address.
        </p>
      </div>
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", margin: 0 }}>© 2025 Sahid Freight.et</p>
      </div>
    </div>
  );

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: "#fff", borderRadius: "20px", padding: "48px 44px", boxShadow: "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.10)", border: "1px solid rgba(10,31,68,0.06)" }}>
      {children}
    </div>
  );

  return (
    <>
    <style>{`@media(max-width:768px){.fp-left{display:none !important;}.fp-right{padding:32px 20px !important;}}`}</style>
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#F8FAFC" }}>
      <LeftPanel />

      <div className="fp-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>

          {/* ── STEP 1: Phone ── */}
          {step === "phone" && (
            <Card>
              <div style={{ width: "56px", height: "56px", background: "#F8FAFC", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A1F44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
                </svg>
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0A1F44", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Forgot password?</h2>
              <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 32px", lineHeight: "1.6" }}>Enter your phone number and we'll send a reset code to your email.</p>

              {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}

              <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0A1F44", marginBottom: "8px" }}>Phone Number</label>
                  <div style={{ display: "flex", gap: "8px" }}>

                    {/* Country dropdown */}
                    <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
                      <button type="button" onClick={() => setDropdownOpen(!dropdownOpen)}
                        style={{ height: "50px", padding: "0 12px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", minWidth: "110px" }}>
                        <span style={{ fontSize: "18px" }}>{country.flag}</span>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: "#3D7BFF" }}>{country.dial}</span>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: "auto", transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                          <path d="M1 3l4 4 4-4" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {dropdownOpen && (
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, width: "200px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "12px", overflow: "hidden", zIndex: 50, boxShadow: "0 8px 32px rgba(10,31,68,0.12)" }}>
                          {COUNTRIES.map((c) => (
                            <button key={c.code} type="button"
                              onClick={() => { setCountry(c); setDropdownOpen(false); setTimeout(() => phoneInputRef.current?.focus(), 50); }}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: country.code === c.code ? "#F8FAFC" : "#fff", border: "none", borderBottom: "1px solid #E2E8F0", cursor: "pointer", textAlign: "left" as const }}>
                              <span style={{ fontSize: "20px" }}>{c.flag}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0A1F44" }}>{c.name}</div>
                                <div style={{ fontSize: "12px", color: "#3D7BFF" }}>{c.dial}</div>
                              </div>
                              {country.code === c.code && (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="#3D7BFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone input — ref keeps focus stable */}
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="900 000 000"
                      required
                      onFocus={() => setFocused("phone")}
                      onBlur={() => setFocused(null)}
                      style={{ flex: 1, height: "50px", background: focused === "phone" ? "#fff" : "#F8FAFC", border: `1.5px solid ${focused === "phone" ? "#0A1F44" : "#E2E8F0"}`, borderRadius: "10px", padding: "0 16px", color: "#0A1F44", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, fontFamily: "monospace", transition: "all 0.15s" }}
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading || phone.length < 7}
                  style={{ width: "100%", height: "50px", background: loading || phone.length < 7 ? "#E2E8F0" : "#3D7BFF", border: "none", borderRadius: "10px", color: loading || phone.length < 7 ? "#aaa" : "#FFFFFF", fontSize: "15px", fontWeight: "700", cursor: loading || phone.length < 7 ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {loading ? "Sending..." : "Send Reset Code →"}
                </button>
              </form>

              <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid #E2E8F0", textAlign: "center" as const }}>
                <a href="/auth/login" style={{ color: "#94A3B8", fontSize: "14px", textDecoration: "none" }}>
                  Remember it? <span style={{ color: "#3D7BFF", fontWeight: "700" }}>Sign in</span>
                </a>
              </div>
            </Card>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === "otp" && (
            <Card>
              <div style={{ width: "56px", height: "56px", background: "#F8FAFC", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A1F44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0A1F44", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Enter reset code</h2>
              <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 32px", lineHeight: "1.6" }}>
                We sent a 6-digit code to your registered email for <strong style={{ color: "#0A1F44" }}>{fullPhone}</strong>
              </p>

              {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}

              <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }}>
                {otp.map((digit, i) => (
                  <input key={i} ref={(el) => { inputs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{ width: "48px", height: "56px", textAlign: "center" as const, fontSize: "22px", fontWeight: "800", color: "#0A1F44", background: digit ? "#E8F0FF" : "#F8FAFC", border: `2px solid ${digit ? "#0A1F44" : "#E2E8F0"}`, borderRadius: "12px", outline: "none", transition: "all 0.15s", fontFamily: "monospace" }} />
                ))}
              </div>

              <button onClick={() => handleVerifyOtp()} disabled={loading || otp.some((d) => d === "")}
                style={{ width: "100%", height: "50px", background: loading || otp.some((d) => d === "") ? "#E2E8F0" : "#3D7BFF", border: "none", borderRadius: "10px", color: loading || otp.some((d) => d === "") ? "#aaa" : "#FFFFFF", fontSize: "15px", fontWeight: "700", cursor: loading || otp.some((d) => d === "") ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: "20px" }}>
                {loading ? "Verifying..." : "Verify Code →"}
              </button>

              <div style={{ textAlign: "center" as const }}>
                {countdown > 0 ? (
                  <p style={{ color: "#94A3B8", fontSize: "14px", margin: 0 }}>Resend code in <span style={{ fontWeight: "700", color: "#0A1F44" }}>{countdown}s</span></p>
                ) : (
                  <button onClick={() => handleSendCode()} style={{ background: "none", border: "none", color: "#3D7BFF", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>Resend code</button>
                )}
              </div>
            </Card>
          )}

          {/* ── STEP 3: New password ── */}
          {step === "password" && (
            <Card>
              <div style={{ width: "56px", height: "56px", background: "#F8FAFC", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A1F44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0A1F44", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Set new password</h2>
              <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 32px", lineHeight: "1.6" }}>Choose a strong password for your account.</p>

              {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}

              <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0A1F44", marginBottom: "8px" }}>New Password</label>
                  <div style={{ position: "relative" }}>
                    <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" required
                      onFocus={() => setFocused("new")} onBlur={() => setFocused(null)}
                      style={{ width: "100%", height: "50px", background: focused === "new" ? "#fff" : "#F8FAFC", border: `1.5px solid ${focused === "new" ? "#0A1F44" : "#E2E8F0"}`, borderRadius: "10px", padding: "0 44px 0 16px", color: "#0A1F44", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s" }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0A1F44", marginBottom: "8px" }}>Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required
                    onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)}
                    style={{ width: "100%", height: "50px", background: focused === "confirm" ? "#fff" : "#F8FAFC", border: `1.5px solid ${focused === "confirm" ? "#0A1F44" : (confirmPassword && confirmPassword !== newPassword ? "#fecaca" : "#E2E8F0")}`, borderRadius: "10px", padding: "0 16px", color: "#0A1F44", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s" }} />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p style={{ color: "#dc2626", fontSize: "12px", margin: "6px 0 0" }}>Passwords do not match</p>
                  )}
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: "100%", height: "50px", background: loading ? "#E2E8F0" : "#3D7BFF", border: "none", borderRadius: "10px", color: loading ? "#aaa" : "#FFFFFF", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {loading ? "Saving..." : "Reset Password →"}
                </button>
              </form>
            </Card>
          )}

        </div>
      </div>
    </div>
    </>
  );
}
