"use client";
import { useState, useRef } from "react";
import { Truck, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatApiError } from "@/lib/errors";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState(1);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  // OTP step state
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    countryCode: "+251",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    role: "",
    country: "",
    city: "",
    email: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const startCountdown = () => {
    setCanResend(false);
    setCountdown(60);
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(id); setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const requestOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/request-otp", { identifier: form.email, purpose: "REGISTER" });
      setOtp(["", "", "", "", "", ""]);
      setStep(2);
      startCountdown();
      setTimeout(() => otpInputs.current[0]?.focus(), 50);
    } catch (err) {
      setError(formatApiError(err, "We couldn't send your code. Please try again.", "auth"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setError("");
    try {
      await api.post("/auth/request-otp", { identifier: form.email, purpose: "REGISTER" });
      setOtp(["", "", "", "", "", ""]);
      startCountdown();
      otpInputs.current[0]?.focus();
    } catch (err) {
      setError(formatApiError(err, "We couldn't resend your code. Please try again.", "auth"));
    } finally {
      setResending(false);
    }
  };

  const verifyOtp = async (code?: string) => {
    const finalOtp = code ?? otp.join("");
    if (finalOtp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-otp", {
        identifier: form.email,
        code: finalOtp,
        purpose: "REGISTER",
      });
      setVerificationToken(res.data.verificationToken);
      setStep(3);
    } catch (err) {
      setError(formatApiError(err, "That code doesn't look right. Check your email and try again.", "auth"));
      setOtp(["", "", "", "", "", ""]);
      otpInputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpInputs.current[index + 1]?.focus();
    if (next.every((d) => d !== "")) verifyOtp(next.join(""));
  };

  const handleOtpKey = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      setOtp(paste.split(""));
      verifyOtp(paste);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    try {
      const fullPhone = form.countryCode + form.phoneNumber.replace(/^0+/, "");
      const res = await api.post("/auth/register", {
        verificationToken,
        fullName: form.fullName,
        phone: fullPhone,
        password: form.password,
        role: form.role,
        country: form.country,
        city: form.city,
      });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      if (res.data.user.role === "DRIVER") {
        router.push("/driver");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(formatApiError(err, "We couldn't create your account. Please try again.", "auth"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (form.password !== form.confirmPassword) { setError("The two passwords don't match."); return; }
      return requestOtp();
    }
    if (step === 2) return verifyOtp();
    if (step === 3) return handleRegister();
  };

  const P = "var(--primary)";
  const A = "var(--accent)";

  const inputStyle = (field: string) => ({
    width: "100%",
    background: focused === field ? "var(--surface)" : "var(--bg)",
    border: `1.5px solid ${focused === field ? P : "var(--border)"}`,
    borderRadius: "10px",
    padding: "13px 16px",
    color: P,
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "all 0.15s",
    boxShadow: focused === field ? "0 0 0 3px rgba(10,31,68,0.08)" : "none",
  });

  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: "700" as const,
    color: P,
    marginBottom: "8px",
    letterSpacing: "0.2px",
  };

  const stepLabels: Record<number, string> = { 1: "Your info", 2: "Verify email", 3: "Account details" };
  const headerTitle = step === 1 ? "Create your account" : step === 2 ? "Verify your email" : "Almost there";
  const headerSub =
    step === 1 ? "A few basics to get you started." :
    step === 2 ? "We just sent a 6-digit code to your inbox." :
    "Pick your role and where you're based.";
  const submitDisabled =
    loading ||
    (step === 2 && otp.some((d) => !d)) ||
    (step === 3 && !form.role);
  const submitLabel =
    loading ? (step === 3 ? "Creating your account…" : step === 2 ? "Checking code…" : "Sending code…") :
    step === 1 ? "Continue" :
    step === 2 ? "Verify code" :
    "Create account";

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter, system-ui, sans-serif", background: "var(--bg)" }}>

      {/* Left Panel */}
      <div className="auth-left" style={{ width: "44%", background: "#0A1F44", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: "52px 56px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(61,123,255,0.08) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", right: "-120px", top: "50%", transform: "translateY(-50%)", width: "500px", height: "500px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.5px" }}>Sahid Freight</div>
            <div style={{ fontSize: "10px", color: "#3D7BFF", letterSpacing: "2px", marginTop: "-2px" }}>ETHIOPIA · SOMALIA · DJIBOUTI</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ width: "48px", height: "3px", background: "#3D7BFF", borderRadius: "2px", marginBottom: "32px" }} />
          <h1 style={{ fontSize: "42px", fontWeight: "800", color: "#FFFFFF", lineHeight: "1.15", margin: "0 0 24px", letterSpacing: "-1.5px" }}>
            Join the<br />
            <span style={{ color: "#3D7BFF" }}>network.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", lineHeight: "1.8", maxWidth: "300px", margin: "0 0 48px" }}>
            Whether you move cargo, drive a truck, or dispatch loads for others — you belong on Sahid.
          </p>

          {/* Role cards */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
            {[
              { icon: "truck", title: "Truck owner", desc: "List your trucks and accept dispatched loads." },
              { icon: "package", title: "Cargo owner", desc: "Post loads and track them from pickup to delivery." },
            ].map((r) => (
              <div key={r.title} style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px 16px" }}>
                {r.icon === "truck" ? <Truck size={22} color="#3D7BFF" />  : <Package size={22} color="#3D7BFF" />}
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#FFFFFF" }}>{r.title}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", margin: 0 }}>© {new Date().getFullYear()} Sahid Freight</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px", background: "var(--bg)" }}>
        <div style={{ width: "100%", maxWidth: "460px" }}>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: step >= s ? P : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", color: step >= s ? "var(--bg)" : "var(--text-secondary)", transition: "all 0.2s" }}>
                  {s}
                </div>
                <span style={{ fontSize: "13px", color: step >= s ? P : "var(--text-secondary)", fontWeight: step >= s ? "600" : "400" }}>
                  {stepLabels[s]}
                </span>
                {s < 3 && <div style={{ width: "24px", height: "1px", background: step > s ? P : "var(--border)", margin: "0 4px" }} />}
              </div>
            ))}
          </div>

          {/* Card */}
          <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "44px", boxShadow: "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.10)", border: "1px solid rgba(10,31,68,0.06)" }}>

            <div style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: P, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
                {headerTitle}
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
                {headerSub}
              </p>
            </div>

            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "var(--danger)", fontSize: "14px", marginBottom: "24px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                  <div>
                    <label style={labelStyle}>Full name</label>
                    <input type="text" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Ahmed Hassan" required onFocus={() => setFocused("fullName")} onBlur={() => setFocused(null)} style={inputStyle("fullName")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone number</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select value={form.countryCode} onChange={(e) => { update("countryCode", e.target.value); update("phone", e.target.value + form.phoneNumber.replace(/^0/, "")); }} style={{ ...inputStyle("countryCode"), width: "140px", flexShrink: 0, appearance: "none" as const, fontFamily: "monospace" }}>
                        <option value="+251">🇪🇹 +251</option>
                        <option value="+252">🇸🇴 +252</option>
                        <option value="+253">🇩🇯 +253</option>
                      </select>
                      <input type="tel" value={form.phoneNumber} onChange={(e) => { const clean = e.target.value.replace(/[^0-9]/g, ""); update("phoneNumber", clean); update("phone", form.countryCode + clean.replace(/^0+/, "")); }} placeholder="911 234 567" required onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)} style={{ ...inputStyle("phone"), fontFamily: "monospace", flex: 1 }} />
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "6px 0 0 0" }}>Skip the country code — it's already selected.</p>
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" required onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={inputStyle("email")} />
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "6px 0 0 0" }}>We'll send a 6-digit code here to confirm it's you.</p>
                  </div>
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" required onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} style={inputStyle("password")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm password</label>
                    <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder="Type it again" required onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)} style={inputStyle("confirm")} />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "20px" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0, lineHeight: 1.6 }}>
                    Check <strong style={{ color: P }}>{form.email}</strong> for a 6-digit code. Enter it below to continue.
                  </p>

                  <div style={{ display: "flex", gap: "10px" }} onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpInputs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKey(i, e)}
                        style={{
                          width: "48px",
                          height: "56px",
                          textAlign: "center" as const,
                          fontSize: "22px",
                          fontWeight: "800",
                          color: P,
                          background: "var(--bg)",
                          border: `2px solid ${digit ? P : "var(--border)"}`,
                          borderRadius: "12px",
                          outline: "none",
                          transition: "all 0.15s",
                          fontFamily: "monospace",
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ textAlign: "center" as const }}>
                    {canResend ? (
                      <button type="button" onClick={handleResend} disabled={resending} style={{ background: "none", border: "none", color: A, fontSize: "14px", fontWeight: "700", cursor: resending ? "not-allowed" : "pointer" }}>
                        {resending ? "Sending a new code…" : "Send a new code"}
                      </button>
                    ) : (
                      <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
                        Didn't get it? Try again in <span style={{ fontWeight: "700", color: P }}>{countdown}s</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                  {/* Role selection */}
                  <div>
                    <label style={labelStyle}>I am a…</label>
                    <div style={{ display: "flex", gap: "12px" }}>
                      {[{ value: "CARGO_SENDER", label: "Cargo owner" }, { value: "TRUCK_OWNER", label: "Truck owner" }].map((r) => (
                        <div key={r.value} onClick={() => update("role", r.value)} style={{ flex: 1, padding: "14px", borderRadius: "10px", border: `2px solid ${form.role === r.value ? P : "var(--border)"}`, background: form.role === r.value ? "var(--bg)" : "var(--surface)", cursor: "pointer", textAlign: "center" as const, fontSize: "14px", fontWeight: "600", color: form.role === r.value ? P : "var(--text-secondary)", transition: "all 0.15s" }}>
                          {r.label}
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "8px 0 0 0" }}>Brokers are added by the Sahid team — reach out from your inbox to request a broker account.</p>
                  </div>

                  {/* Country */}
                  <div>
                    <label style={labelStyle}>Country</label>
                    <select value={form.country} onChange={(e) => update("country", e.target.value)} required onFocus={() => setFocused("country")} onBlur={() => setFocused(null)} style={{ ...inputStyle("country"), appearance: "none" as const }}>
                      <option value="">Select a country</option>
                      <option value="ETHIOPIA">Ethiopia</option>
                      <option value="SOMALIA">Somalia</option>
                      <option value="DJIBOUTI">Djibouti</option>
                    </select>
                  </div>

                  {/* City */}
                  <div>
                    <label style={labelStyle}>City</label>
                    <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Addis Ababa" required onFocus={() => setFocused("city")} onBlur={() => setFocused(null)} style={inputStyle("city")} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
                {step > 1 && (
                  <button type="button" onClick={() => { setError(""); setStep((s) => s - 1); }} style={{ flex: 1, background: "var(--bg)", border: "none", borderRadius: "10px", padding: "14px", color: P, fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                    Back
                  </button>
                )}
                <button type="submit" disabled={submitDisabled} style={{ flex: 2, background: submitDisabled ? "var(--border)" : A, border: "none", borderRadius: "10px", padding: "14px", color: submitDisabled ? "#aaa" : "#FFFFFF", fontSize: "15px", fontWeight: "700", cursor: submitDisabled ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {submitLabel}
                </button>
              </div>
            </form>

            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #E2E8F0", textAlign: "center" as const }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Already registered? </span>
              <a href="/auth/login" style={{ color: A, fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>Sign in</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
