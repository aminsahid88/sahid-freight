"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

export default function NewLoadPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  useEffect(() => { if (user && !user.isVerified) router.push("/dashboard"); }, [user]);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", weightTons: "",
    truckTypeNeeded: "", pickupCity: "", pickupCountry: "",
    deliveryCity: "", deliveryCountry: "",
    offeredPrice: "", currency: "USD", scheduledDate: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/loads", { ...form, weightTons: parseFloat(form.weightTons), offeredPrice: parseFloat(form.offeredPrice) });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => ({
    width: "100%", background: focused === field ? "#fff" : "#faf8f4",
    border: `1.5px solid ${focused === field ? "#1a2744" : "#e8e3d8"}`,
    borderRadius: "10px", padding: "13px 16px", color: "#1a2744",
    fontSize: "15px", outline: "none", boxSizing: "border-box" as const,
    transition: "all 0.15s", boxShadow: focused === field ? "0 0 0 3px rgba(26,39,68,0.08)" : "none",
  });

  const labelStyle = { display: "block", fontSize: "13px", fontWeight: "700" as const, color: "#1a2744", marginBottom: "8px" };

  const truckTypes = ["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "OPEN_BODY", "MINI_TRUCK"];
  const countries = [{ value: "ETHIOPIA", label: "Ethiopia" }, { value: "SOMALIA", label: "Somalia" }, { value: "DJIBOUTI", label: "Djibouti" }];

  return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>

      {/* Nav */}
      <div style={{ background: "#1a2744", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src="/loadlink.png" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
        </div>
        <button onClick={() => router.push("/dashboard")} style={{ background: "rgba(240,235,224,0.08)", border: "none", borderRadius: "8px", padding: "8px 16px", color: "rgba(240,235,224,0.6)", fontSize: "14px", cursor: "pointer" }}>
          ← Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1a2744", margin: "0 0 4px", letterSpacing: "-1px" }}>Post a New Load</h1>
          <p style={{ color: "#9e9890", fontSize: "15px", margin: 0 }}>Fill in the details and truck owners will apply</p>
        </div>

        <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", boxShadow: "0 2px 4px rgba(26,39,68,0.04), 0 16px 48px rgba(26,39,68,0.08)", border: "1px solid rgba(26,39,68,0.06)" }}>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "28px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Section: Load Info */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "#1a2744", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#f0ebe0", fontWeight: "700" }}>1</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", margin: 0 }}>Load Information</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Load Title</label>
                  <input type="text" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Cement bags to Dire Dawa" required onFocus={() => setFocused("title")} onBlur={() => setFocused(null)} style={inputStyle("title")} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description <span style={{ fontWeight: "400", color: "#9e9890" }}>(optional)</span></label>
                  <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Any special handling instructions..." rows={3} onFocus={() => setFocused("desc")} onBlur={() => setFocused(null)} style={{ ...inputStyle("desc"), resize: "none" as const, fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={labelStyle}>Weight (tons)</label>
                  <input type="number" value={form.weightTons} onChange={(e) => update("weightTons", e.target.value)} placeholder="e.g. 10" required min="0.1" step="0.1" onFocus={() => setFocused("weight")} onBlur={() => setFocused(null)} style={inputStyle("weight")} />
                </div>
                <div>
                  <label style={labelStyle}>Truck Type Needed</label>
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
                <div style={{ width: "28px", height: "28px", background: "#1a2744", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#f0ebe0", fontWeight: "700" }}>2</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", margin: 0 }}>Route</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Pickup City</label>
                  <input type="text" value={form.pickupCity} onChange={(e) => update("pickupCity", e.target.value)} placeholder="e.g. Addis Ababa" required onFocus={() => setFocused("pickupCity")} onBlur={() => setFocused(null)} style={inputStyle("pickupCity")} />
                </div>
                <div>
                  <label style={labelStyle}>Pickup Country</label>
                  <select value={form.pickupCountry} onChange={(e) => update("pickupCountry", e.target.value)} required onFocus={() => setFocused("pickupCountry")} onBlur={() => setFocused(null)} style={{ ...inputStyle("pickupCountry"), appearance: "none" as const }}>
                    <option value="">Select country</option>
                    {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Delivery City</label>
                  <input type="text" value={form.deliveryCity} onChange={(e) => update("deliveryCity", e.target.value)} placeholder="e.g. Mogadishu" required onFocus={() => setFocused("deliveryCity")} onBlur={() => setFocused(null)} style={inputStyle("deliveryCity")} />
                </div>
                <div>
                  <label style={labelStyle}>Delivery Country</label>
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
                <div style={{ width: "28px", height: "28px", background: "#1a2744", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#f0ebe0", fontWeight: "700" }}>3</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", margin: 0 }}>Price & Schedule</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Offered Price</label>
                  <input type="number" value={form.offeredPrice} onChange={(e) => update("offeredPrice", e.target.value)} placeholder="e.g. 1500" required min="1" onFocus={() => setFocused("price")} onBlur={() => setFocused(null)} style={inputStyle("price")} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={(e) => update("currency", e.target.value)} onFocus={() => setFocused("currency")} onBlur={() => setFocused(null)} style={{ ...inputStyle("currency"), appearance: "none" as const }}>
                    <option value="USD">🇺🇸 USD</option>
                    <option value="ETB">ETB</option>
                    <option value="SOS">🇸🇴 SOS</option>
                    <option value="DJF">DJF</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Scheduled Date</label>
                  <input type="date" value={form.scheduledDate} onChange={(e) => update("scheduledDate", e.target.value)} required onFocus={() => setFocused("date")} onBlur={() => setFocused(null)} style={inputStyle("date")} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => router.push("/dashboard")} style={{ flex: 1, background: "#f0ebe0", border: "none", borderRadius: "10px", padding: "15px", color: "#1a2744", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{ flex: 2, background: loading ? "#e8e3d8" : "#1a2744", border: "none", borderRadius: "10px", padding: "15px", color: loading ? "#aaa" : "#f0ebe0", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                {loading ? "Posting..." : "Post Load"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
