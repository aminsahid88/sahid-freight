"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { Lock, Mail, ShieldCheck, CheckCircle2, Eye, EyeOff } from "lucide-react";

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verificationToken, setVerificationToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const normalizedEmail = () => email.trim().toLowerCase();

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
      await api.post("/auth/request-otp", { identifier: normalizedEmail(), purpose: "RESET_PASSWORD" });
      setStep("otp");
      setOtp(["", "", "", "", "", ""]);
      startCountdown();
      setTimeout(() => inputs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't send the reset code. Please try again.", "auth"));
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true); setError("");
    try {
      await api.post("/auth/request-otp", { identifier: normalizedEmail(), purpose: "RESET_PASSWORD" });
      setOtp(["", "", "", "", "", ""]);
      startCountdown();
      inputs.current[0]?.focus();
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't resend the reset code. Please try again.", "auth"));
    } finally { setResending(false); }
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

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      setOtp(paste.split(""));
      handleVerifyOtp(paste);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const finalOtp = code || otp.join("");
    if (finalOtp.length !== 6) return;
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-otp", {
        identifier: normalizedEmail(),
        code: finalOtp,
        purpose: "RESET_PASSWORD",
      });
      setVerificationToken(res.data.verificationToken);
      setStep("password");
    } catch (err: any) {
      setError(formatApiError(err, "That code isn't right. Please try again.", "auth"));
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Those passwords don't match. Please retype them."); return; }
    if (newPassword.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/reset-password", { verificationToken, newPassword });
      setStep("success");
      setTimeout(() => router.push("/auth/login?reset=success"), 1500);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError("Your verification expired. Please request a new code.");
        setVerificationToken("");
        setOtp(["", "", "", "", "", ""]);
        setNewPassword("");
        setConfirmPassword("");
        setStep("email");
      } else {
        setError(formatApiError(err, "We couldn't save your new password. Please try again.", "auth"));
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
          Enter your email and we'll send a 6-digit reset code.
        </p>
      </div>
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", margin: 0 }}>© {new Date().getFullYear()} Sahid Freight</p>
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

          {/* ── STEP 1: Email ── */}
          {step === "email" && (
            <Card>
              <div style={{ width: "56px", height: "56px", background: "#F8FAFC", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                <Lock size={22} color="#0A1F44" strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0A1F44", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Forgot your password?</h2>
              <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 32px", lineHeight: "1.6" }}>Enter the email on your account and we'll send a 6-digit code to reset it.</p>

              {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}

              <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0A1F44", marginBottom: "8px" }}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    style={{ width: "100%", height: "50px", background: focused === "email" ? "#fff" : "#F8FAFC", border: `1.5px solid ${focused === "email" ? "#0A1F44" : "#E2E8F0"}`, borderRadius: "10px", padding: "0 16px", color: "#0A1F44", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s" }}
                  />
                </div>
                <button type="submit" disabled={loading || !email.trim()}
                  style={{ width: "100%", height: "50px", background: loading || !email.trim() ? "#E2E8F0" : "#3D7BFF", border: "none", borderRadius: "10px", color: loading || !email.trim() ? "#aaa" : "#FFFFFF", fontSize: "15px", fontWeight: "700", cursor: loading || !email.trim() ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {loading ? "Sending code…" : "Send reset code →"}
                </button>
              </form>

              <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid #E2E8F0", textAlign: "center" as const }}>
                <a href="/auth/login" style={{ color: "#94A3B8", fontSize: "14px", textDecoration: "none" }}>
                  Remembered it? <span style={{ color: "#3D7BFF", fontWeight: "700" }}>Sign in</span>
                </a>
              </div>
            </Card>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === "otp" && (
            <Card>
              <div style={{ width: "56px", height: "56px", background: "#F8FAFC", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                <Mail size={22} color="#0A1F44" strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0A1F44", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Enter your reset code</h2>
              <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 32px", lineHeight: "1.6" }}>
                We sent a 6-digit code to <strong style={{ color: "#0A1F44" }}>{normalizedEmail()}</strong>.
              </p>

              {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}

              <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }} onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input key={i} ref={(el) => { inputs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{ width: "48px", height: "56px", textAlign: "center" as const, fontSize: "22px", fontWeight: "800", color: "#0A1F44", background: digit ? "#E8F0FF" : "#F8FAFC", border: `2px solid ${digit ? "#0A1F44" : "#E2E8F0"}`, borderRadius: "12px", outline: "none", transition: "all 0.15s", fontFamily: "monospace" }} />
                ))}
              </div>

              <button onClick={() => handleVerifyOtp()} disabled={loading || otp.some((d) => d === "")}
                style={{ width: "100%", height: "50px", background: loading || otp.some((d) => d === "") ? "#E2E8F0" : "#3D7BFF", border: "none", borderRadius: "10px", color: loading || otp.some((d) => d === "") ? "#aaa" : "#FFFFFF", fontSize: "15px", fontWeight: "700", cursor: loading || otp.some((d) => d === "") ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: "20px" }}>
                {loading ? "Verifying…" : "Verify code →"}
              </button>

              <div style={{ textAlign: "center" as const }}>
                {countdown > 0 ? (
                  <p style={{ color: "#94A3B8", fontSize: "14px", margin: 0 }}>Resend code in <span style={{ fontWeight: "700", color: "#0A1F44" }}>{countdown}s</span></p>
                ) : (
                  <button type="button" onClick={handleResend} disabled={resending} style={{ background: "none", border: "none", color: "#3D7BFF", fontSize: "14px", fontWeight: "700", cursor: resending ? "not-allowed" : "pointer" }}>
                    {resending ? "Sending code…" : "Resend code"}
                  </button>
                )}
              </div>

              <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #E2E8F0", textAlign: "center" as const }}>
                <button type="button" onClick={() => { setStep("email"); setError(""); }} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "13px", cursor: "pointer" }}>
                  Wrong email? <span style={{ color: "#3D7BFF", fontWeight: "600" }}>Change it</span>
                </button>
              </div>
            </Card>
          )}

          {/* ── STEP 3: New password ── */}
          {step === "password" && (
            <Card>
              <div style={{ width: "56px", height: "56px", background: "#F8FAFC", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                <ShieldCheck size={22} color="#0A1F44" strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0A1F44", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Set a new password</h2>
              <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 32px", lineHeight: "1.6" }}>Choose something strong you'll remember.</p>

              {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}

              <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column" as const, gap: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0A1F44", marginBottom: "8px" }}>New password</label>
                  <div style={{ position: "relative" }}>
                    <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" required
                      onFocus={() => setFocused("new")} onBlur={() => setFocused(null)}
                      style={{ width: "100%", height: "50px", background: focused === "new" ? "#fff" : "#F8FAFC", border: `1.5px solid ${focused === "new" ? "#0A1F44" : "#E2E8F0"}`, borderRadius: "10px", padding: "0 44px 0 16px", color: "#0A1F44", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s" }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", alignItems: "center" }}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0A1F44", marginBottom: "8px" }}>Confirm password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Retype your new password" required
                    onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)}
                    style={{ width: "100%", height: "50px", background: focused === "confirm" ? "#fff" : "#F8FAFC", border: `1.5px solid ${focused === "confirm" ? "#0A1F44" : (confirmPassword && confirmPassword !== newPassword ? "#fecaca" : "#E2E8F0")}`, borderRadius: "10px", padding: "0 16px", color: "#0A1F44", fontSize: "15px", outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s" }} />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p style={{ color: "#dc2626", fontSize: "12px", margin: "6px 0 0" }}>Those passwords don't match yet.</p>
                  )}
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: "100%", height: "50px", background: loading ? "#E2E8F0" : "#3D7BFF", border: "none", borderRadius: "10px", color: loading ? "#aaa" : "#FFFFFF", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                  {loading ? "Saving password…" : "Save new password →"}
                </button>
              </form>
            </Card>
          )}

          {/* ── STEP 4: Success ── */}
          {step === "success" && (
            <Card>
              <div style={{ width: "56px", height: "56px", background: "#E8F0FF", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                <CheckCircle2 size={26} color="#3D7BFF" strokeWidth={2.5} />
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0A1F44", margin: "0 0 8px", letterSpacing: "-0.5px" }}>Password updated</h2>
              <p style={{ color: "#94A3B8", fontSize: "14px", margin: "0 0 24px", lineHeight: "1.6" }}>
                Your new password is saved. Taking you to sign in…
              </p>
              <a href="/auth/login?reset=success" style={{ display: "block", width: "100%", height: "50px", lineHeight: "50px", background: "#3D7BFF", borderRadius: "10px", color: "#FFFFFF", fontSize: "15px", fontWeight: "700", textAlign: "center" as const, textDecoration: "none" }}>
                Go to sign in →
              </a>
            </Card>
          )}

        </div>
      </div>
    </div>
    </>
  );
}
