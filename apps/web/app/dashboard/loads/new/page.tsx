"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useGateStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { AlertTriangle, ShieldCheck, Lightbulb } from "lucide-react";

export default function NewLoadPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { openGate } = useGateStore();
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [priceSuggestion, setPriceSuggestion] = useState<{ count: number; min: number; max: number; avg: number } | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", weightTons: "",
    truckTypeNeeded: "", pickupCity: "", pickupCountry: "",
    deliveryCity: "", deliveryCountry: "",
    offeredPrice: "", currency: "USD", scheduledDate: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  // Fetch price suggestion when truck type + either country is selected
  useEffect(() => {
    const { truckTypeNeeded, pickupCountry, deliveryCountry } = form;
    if (!truckTypeNeeded || (!pickupCountry && !deliveryCountry)) { setPriceSuggestion(null); return; }
    const params = new URLSearchParams();
    if (truckTypeNeeded) params.set("truckType", truckTypeNeeded);
    if (pickupCountry)   params.set("pickupCountry", pickupCountry);
    if (deliveryCountry) params.set("deliveryCountry", deliveryCountry);
    const t = setTimeout(() => {
      api.get(`/loads/price-suggestion?${params.toString()}`)
        .then(r => setPriceSuggestion(r.data.count > 0 ? r.data : null))
        .catch(() => setPriceSuggestion(null));
    }, 600);
    return () => clearTimeout(t);
  }, [form.truckTypeNeeded, form.pickupCountry, form.deliveryCountry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/loads", { ...form, weightTons: parseFloat(form.weightTons), offeredPrice: parseFloat(form.offeredPrice) });
      router.push("/dashboard");
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't post your load. Please check the details and try again.", "load"));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => ({
    width: "100%", background: focused === field ? "var(--surface)" : "var(--bg)",
    border: `1.5px solid ${focused === field ? "var(--primary)" : "var(--border)"}`,
    borderRadius: "10px", padding: "13px 16px", color: "var(--primary)",
    fontSize: "15px", outline: "none", boxSizing: "border-box" as const,
    transition: "all 0.15s", boxShadow: focused === field ? "0 0 0 3px rgba(26,39,68,0.08)" : "none",
  });

  const labelStyle = { display: "block", fontSize: "13px", fontWeight: "700" as const, color: "var(--primary)", marginBottom: "8px" };

  const truckTypes = ["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "OPEN_BODY", "MINI_TRUCK"];
  const countries = [{ value: "ETHIOPIA", label: "Ethiopia" }, { value: "SOMALIA", label: "Somalia" }, { value: "DJIBOUTI", label: "Djibouti" }];

  if (user && user.role !== "CARGO_SENDER") return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "40px 24px", textAlign: "center" as const }}>
      <div style={{ width: "64px", height: "64px", background: "#fef2f2", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
        <AlertTriangle size={28} />
      </div>
      <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary)", margin: 0 }}>Cargo owners only</h2>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "320px", lineHeight: "1.6", margin: 0 }}>
        Only <strong>cargo owner</strong> accounts can post loads. You're signed in as a <strong>{user.role.replace(/_/g, " ").toLowerCase()}</strong>.
        {user.role === "TRUCK_OWNER" && " As a truck owner, you can browse available loads instead."}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={() => router.push("/dashboard/loads")} style={{ background: "var(--primary)", color: "#FAFAF8", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>
          {user.role === "TRUCK_OWNER" ? "Browse available loads" : "Back to dashboard"}
        </button>
      </div>
    </div>
  );

  if (!user?.isVerified) return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "40px 24px", textAlign: "center" as const }}>
      <div style={{ width: "64px", height: "64px", background: "#fff7ed", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
        <ShieldCheck size={28} />
      </div>
      <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary)", margin: 0 }}>Verify your account first</h2>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "300px", lineHeight: "1.6", margin: 0 }}>
        {user?.status === "DOCUMENTS_SUBMITTED"
          ? "Your documents are under review. You'll be able to post loads once verified — usually within 24 hours."
          : "You need to verify your account before posting loads. Upload your documents to get started."}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        {user?.status !== "DOCUMENTS_SUBMITTED" && (
          <button onClick={() => router.push("/dashboard/verify")} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>Upload documents</button>
        )}
        <button onClick={() => router.push("/dashboard")} style={{ background: "var(--primary)", color: "#FAFAF8", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>Back to dashboard</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter, system-ui, sans-serif" }}>
      <style>{`@media(max-width:640px){.price-grid{grid-template-columns:1fr!important;}}`}</style>

      {/* Nav */}
      <div style={{ background: "var(--primary)", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
        </div>
        <button onClick={() => router.push("/dashboard")} style={{ background: "rgba(240,235,224,0.08)", border: "none", borderRadius: "8px", padding: "8px 16px", color: "rgba(240,235,224,0.6)", fontSize: "14px", cursor: "pointer" }}>
          ← Back to dashboard
        </button>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary)", margin: "0 0 4px", letterSpacing: "-1px" }}>Post a new load</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>Fill in the details — a broker will dispatch a verified truck.</p>
        </div>

        <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "40px", boxShadow: "0 2px 4px rgba(26,39,68,0.04), 0 16px 48px rgba(26,39,68,0.08)", border: "1px solid rgba(26,39,68,0.06)" }}>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px 16px", marginBottom: "28px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0, marginTop: "1px", color: "#dc2626" }}><AlertTriangle size={18} /></div>
              <div>
                <div style={{ color: "#dc2626", fontSize: "14px", fontWeight: "600" }}>{error}</div>
                {error.includes("verif") && (
                  <button onClick={() => router.push("/dashboard/verify")} style={{ marginTop: "8px", background: "none", border: "none", padding: 0, color: "#dc2626", fontSize: "13px", fontWeight: "700", cursor: "pointer", textDecoration: "underline" }}>
                    Go to verification
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Section: Load Info */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#FAFAF8", fontWeight: "700" }}>1</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>Load information</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Load title</label>
                  <input type="text" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Cement bags to Dire Dawa" required onFocus={() => setFocused("title")} onBlur={() => setFocused(null)} style={inputStyle("title")} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description <span style={{ fontWeight: "400", color: "var(--text-secondary)" }}>(optional)</span></label>
                  <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Any special handling instructions…" rows={3} onFocus={() => setFocused("desc")} onBlur={() => setFocused(null)} style={{ ...inputStyle("desc"), resize: "none" as const, fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={labelStyle}>Weight (tons)</label>
                  <input type="number" value={form.weightTons} onChange={(e) => update("weightTons", e.target.value)} placeholder="e.g. 10" required min="0.1" step="0.1" onFocus={() => setFocused("weight")} onBlur={() => setFocused(null)} style={inputStyle("weight")} />
                </div>
                <div>
                  <label style={labelStyle}>Truck type needed</label>
                  <select value={form.truckTypeNeeded} onChange={(e) => update("truckTypeNeeded", e.target.value)} required onFocus={() => setFocused("truckType")} onBlur={() => setFocused(null)} style={{ ...inputStyle("truckType"), appearance: "none" as const }}>
                    <option value="">Select truck type</option>
                    {truckTypes.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Route */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#FAFAF8", fontWeight: "700" }}>2</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>Route</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Pickup city</label>
                  <input type="text" value={form.pickupCity} onChange={(e) => update("pickupCity", e.target.value)} placeholder="e.g. Addis Ababa" required onFocus={() => setFocused("pickupCity")} onBlur={() => setFocused(null)} style={inputStyle("pickupCity")} />
                </div>
                <div>
                  <label style={labelStyle}>Pickup country</label>
                  <select value={form.pickupCountry} onChange={(e) => update("pickupCountry", e.target.value)} required onFocus={() => setFocused("pickupCountry")} onBlur={() => setFocused(null)} style={{ ...inputStyle("pickupCountry"), appearance: "none" as const }}>
                    <option value="">Select country</option>
                    {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Delivery city</label>
                  <input type="text" value={form.deliveryCity} onChange={(e) => update("deliveryCity", e.target.value)} placeholder="e.g. Mogadishu" required onFocus={() => setFocused("deliveryCity")} onBlur={() => setFocused(null)} style={inputStyle("deliveryCity")} />
                </div>
                <div>
                  <label style={labelStyle}>Delivery country</label>
                  <select value={form.deliveryCountry} onChange={(e) => update("deliveryCountry", e.target.value)} required onFocus={() => setFocused("deliveryCountry")} onBlur={() => setFocused(null)} style={{ ...inputStyle("deliveryCountry"), appearance: "none" as const }}>
                    <option value="">Select country</option>
                    {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Price */}
            <div style={{ marginBottom: "36px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#FAFAF8", fontWeight: "700" }}>3</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>Price and schedule</h3>
              </div>
              <div className="price-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Offered price</label>
                  <input type="number" value={form.offeredPrice} onChange={(e) => update("offeredPrice", e.target.value)} placeholder="e.g. 1500" required min="1" onFocus={() => setFocused("price")} onBlur={() => setFocused(null)} style={inputStyle("price")} />
                  {priceSuggestion && (
                    <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(245,158,11,0.08)", borderRadius: "8px", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <Lightbulb size={14} color="#C2791A" />
                      <span style={{ fontSize: "12px", color: "#92400E" }}>
                        <strong>Market range:</strong> ${priceSuggestion.min.toLocaleString()} – ${priceSuggestion.max.toLocaleString()} · avg <strong>${priceSuggestion.avg.toLocaleString()}</strong>
                        <span style={{ color: "#B45309", marginLeft: "4px" }}>({priceSuggestion.count} similar loads)</span>
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={(e) => update("currency", e.target.value)} onFocus={() => setFocused("currency")} onBlur={() => setFocused(null)} style={{ ...inputStyle("currency"), appearance: "none" as const }}>
                    <option value="USD">USD</option>
                    <option value="ETB">ETB</option>
                    <option value="SOS">SOS</option>
                    <option value="DJF">DJF</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Scheduled date</label>
                  <input type="date" value={form.scheduledDate} onChange={(e) => update("scheduledDate", e.target.value)} required onFocus={() => setFocused("date")} onBlur={() => setFocused(null)} style={inputStyle("date")} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => router.push("/dashboard")} style={{ flex: 1, background: "var(--bg)", border: "none", borderRadius: "10px", padding: "15px", color: "var(--primary)", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{ flex: 2, background: loading ? "var(--border)" : "var(--primary)", border: "none", borderRadius: "10px", padding: "15px", color: loading ? "#aaa" : "#FAFAF8", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                {loading ? "Posting your load…" : "Post load"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
