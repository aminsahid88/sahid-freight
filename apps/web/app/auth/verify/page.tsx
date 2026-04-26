"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

export default function VerifyPage() {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.status === "ACTIVE") { router.push("/dashboard"); return; }
    // OTP already sent during registration
    startCountdown();
  }, []);

  const startCountdown = () => {
    setCanResend(false);
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    try {
      await api.post("/auth/send-otp", { phone: user?.phone });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setError("");
    try {
      await api.post("/auth/send-otp", { phone: user?.phone });
      startCountdown();
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== "")) handleVerify(newOtp.join(""));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      setOtp(paste.split(""));
      handleVerify(paste);
    }
  };

  const handleVerify = async (code?: string) => {
    const finalOtp = code || otp.join("");
    if (finalOtp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-otp", { phone: user?.phone, otp: finalOtp });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP");
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const P = "var(--primary)";
  const A = "var(--accent)";

  return (
    <>
    <style>{`
      @media(max-width:768px){
        .verify-left{display:none !important;}
        .verify-right{padding:32px 20px !important;width:100% !important;}
        .verify-card{padding:32px 24px !important;}
        .otp-input{width:40px !important;height:48px !important;font-size:18px !important;}
      }
    `}</style>
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter, system-ui, sans-serif", background: "var(--bg)" }}>

      {/* Left panel */}
      <div className="verify-left" style={{ width: "52%", background: "#1B3A2D", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: "52px 60px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(240,220,170,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(200,144,30,0.08) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", right: "-120px", top: "50%", transform: "translateY(-50%)", width: "500px", height: "500px", borderRadius: "50%", border: "1px solid rgba(240,220,170,0.05)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
          <div style={{ width: "38px", height: "38px", background: "#E8A020", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M1 3h15v13H1z" stroke="#1B3A2D" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M16 8h4l3 3v5h-7V8z" stroke="#1B3A2D" strokeWidth="1.8" strokeLinejoin="round"/>
              <circle cx="5.5" cy="18.5" r="2.5" stroke="#1B3A2D" strokeWidth="1.8"/>
              <circle cx="18.5" cy="18.5" r="2.5" stroke="#1B3A2D" strokeWidth="1.8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#FAFAF8", letterSpacing: "-0.5px" }}>Sahid Freight</div>
            <div style={{ fontSize: "10px", color: "#E8A020", letterSpacing: "2px", marginTop: "-2px" }}>ETHIOPIA · SOMALIA · DJIBOUTI</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ width: "48px", height: "3px", background: "#E8A020", borderRadius: "2px", marginBottom: "32px" }} />
          <h1 style={{ fontSize: "42px", fontWeight: "800", color: "#FAFAF8", lineHeight: "1.15", margin: "0 0 24px", letterSpacing: "-1.5px" }}>
            One step<br />
            <span style={{ color: "#E8A020" }}>away.</span>
          </h1>
          <p style={{ color: "rgba(240,235,224,0.4)", fontSize: "15px", lineHeight: "1.8", maxWidth: "300px" }}>
            We sent a 6-digit code to your email. Enter it to verify your account and start using Sahid Freight.
          </p>

          <div style={{ marginTop: "48px", background: "rgba(240,235,224,0.04)", border: "1px solid rgba(240,235,224,0.06)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "11px", color: "#E8A020", letterSpacing: "2px", textTransform: "uppercase" as const, marginBottom: "8px" }}>Sent to</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#FAFAF8", fontFamily: "monospace" }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(240,235,224,0.06)", paddingTop: "24px" }}>
          <p style={{ color: "rgba(240,235,224,0.2)", fontSize: "12px", margin: 0 }}>© 2025 Sahid Freight.et</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="verify-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <div className="verify-card" style={{ background: "var(--surface)", borderRadius: "20px", padding: "48px 44px", boxShadow: "0 2px 4px rgba(26,39,68,0.04), 0 16px 48px rgba(26,39,68,0.10)", border: "1px solid rgba(26,39,68,0.06)" }}>

            {/* Icon */}
            <div style={{ width: "56px", height: "56px", background: "var(--bg)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", color: P }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div>

            <h2 style={{ fontSize: "24px", fontWeight: "800", color: P, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
              Verify your number
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 36px", lineHeight: "1.6" }}>
              Enter the 6-digit code sent to <strong style={{ color: P }}>{user?.email}</strong>
            </p>

            {/* OTP inputs */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }} onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
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

            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "var(--danger)", fontSize: "14px", marginBottom: "20px" }}>
                {error}
              </div>
            )}

            <button
              onClick={() => handleVerify()}
              disabled={loading || otp.some((d) => d === "")}
              style={{ width: "100%", background: loading || otp.some((d) => d === "") ? "var(--border)" : P, border: "none", borderRadius: "10px", padding: "15px", color: loading || otp.some((d) => d === "") ? "#aaa" : "var(--bg)", fontSize: "15px", fontWeight: "700", cursor: loading || otp.some((d) => d === "") ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: "20px" }}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>

            <div style={{ textAlign: "center" as const }}>
              {canResend ? (
                <button onClick={handleResend} disabled={resending} style={{ background: "none", border: "none", color: A, fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>
                  {resending ? "Sending..." : "Resend code"}
                </button>
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
                  Resend code in <span style={{ fontWeight: "700", color: P }}>{countdown}s</span>
                </p>
              )}
            </div>

            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f0ede6", textAlign: "center" as const }}>
              <a href="/auth/login" style={{ color: "var(--text-secondary)", fontSize: "13px", textDecoration: "none" }}>
                Wrong number? <span style={{ color: A, fontWeight: "600" }}>Sign in again</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  
    </>
  );
}