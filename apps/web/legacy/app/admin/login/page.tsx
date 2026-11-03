"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminStore } from "@/lib/admin-store";
import adminApi from "@/lib/admin-api";
import { formatApiError } from "@/lib/errors";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdminAuth } = useAdminStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email to continue."); return; }
    if (!password)     { setError("Enter your password to continue."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await adminApi.post("/admin/auth/login", { email, password });
      setAdminAuth(res.data.user, res.data.accessToken);
      router.push("/admin");
    } catch (err) {
      setError(formatApiError(err, "We couldn't sign you in. Please try again.", "auth"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)" }}>
      {/* Left panel */}
      <div className="hidden lg:flex w-[52%] relative overflow-hidden flex-col p-14" style={{ background: "#0F172A" }}>
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(249,115,22,0.08) 0%, transparent 50%)" }} />
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.svg" alt="Sahid Freight" className="w-10 h-10 object-contain" />
          <div>
            <div className="text-xl font-extrabold text-white tracking-tight">Sahid Freight</div>
            <div className="text-[10px] text-[#3D7BFF] tracking-[2px] -mt-0.5">ADMIN CONSOLE</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center relative z-10">
          <div className="w-12 h-[3px] bg-[#3D7BFF] rounded mb-8" />
          <h1 className="text-5xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Admin<br />
            <span className="text-[#3D7BFF]">Console</span>
          </h1>
          <p className="text-white/30 text-base leading-relaxed max-w-[360px]">
            Manage users, verify documents, monitor loads and bookings across the Sahid Freight platform.
          </p>
        </div>
        <div className="relative z-10 border-t border-white/[0.06] pt-6">
          <p className="text-white/20 text-xs">Sahid Freight Admin — Internal use only</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-[var(--bg)]">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src="/logo.svg" alt="Sahid Freight" className="w-9 h-9 object-contain" />
            <div>
              <div className="text-lg font-extrabold" style={{ color: "var(--primary)" }}>Sahid Freight</div>
              <div className="text-[10px] text-[#3D7BFF] tracking-[2px]">ADMIN</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-10 lg:p-12 shadow-sm border border-black/[0.06]">
            <h2 className="text-2xl font-extrabold mb-2" style={{ color: "var(--primary)" }}>Admin Sign In</h2>
            <p className="text-sm text-gray-500 mb-8">Sign in with your admin credentials</p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <label className="block text-[13px] font-bold mb-2" style={{ color: "var(--primary)" }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="admin@sahidfreight.com"
                  className="w-full h-[50px] rounded-lg border px-4 text-[15px] outline-none transition-all focus:ring-2 focus:ring-black/5"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--primary)" }}
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold mb-2" style={{ color: "var(--primary)" }}>Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Enter your password"
                    className="w-full h-[50px] rounded-lg border px-4 pr-12 text-[15px] outline-none transition-all focus:ring-2 focus:ring-black/5"
                    style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--primary)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full h-[50px] rounded-lg text-[15px] font-bold transition-all"
                style={{
                  background: loading ? "var(--border)" : "var(--primary)",
                  color: loading ? "#aaa" : "#FAFAF8",
                  cursor: loading ? "not-allowed" : "pointer",
                  border: "none",
                }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
