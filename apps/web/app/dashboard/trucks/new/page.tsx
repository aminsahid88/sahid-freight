"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function NewTruckPage() {
  const router = useRouter();
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    plateNumber: "", truckType: "", capacityTons: "",
    lengthMeters: "", currentCity: "", currentCountry: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/trucks", {
        ...form,
        capacityTons: parseFloat(form.capacityTons),
        lengthMeters: form.lengthMeters ? parseFloat(form.lengthMeters) : undefined,
      });
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

  const truckTypes = [
    { value: "FLATBED", label: "Flatbed", desc: "Open flat surface, good for large cargo" },
    { value: "REFRIGERATED", label: "Refrigerated", desc: "Temperature controlled, for perishables" },
    { value: "TANKER", label: "Tanker", desc: "For liquids like fuel or water" },
    { value: "CONTAINER", label: "Container", desc: "Standard shipping containers" },
    { value: "OPEN_BODY", label: "Open Body", desc: "Open top, flexible loading" },
    { value: "MINI_TRUCK", label: "Mini Truck", desc: "Small loads, urban deliveries" },
  ];

  const countries = [
    { value: "ETHIOPIA", label: "Ethiopia" },
    { value: "SOMALIA", label: "Somalia" },
    { value: "DJIBOUTI", label: "Djibouti" },
  ];

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
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1a2744", margin: "0 0 4px", letterSpacing: "-1px" }}>Add Your Truck</h1>
          <p style={{ color: "#9e9890", fontSize: "15px", margin: 0 }}>Register your truck to start receiving load requests</p>
        </div>

        <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", boxShadow: "0 2px 4px rgba(26,39,68,0.04), 0 16px 48px rgba(26,39,68,0.08)", border: "1px solid rgba(26,39,68,0.06)" }}>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "28px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Section 1: Truck Details */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "#1a2744", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#f0ebe0", fontWeight: "700" }}>1</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", margin: 0 }}>Truck Details</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Plate Number</label>
                  <input type="text" value={form.plateNumber} onChange={(e) => update("plateNumber", e.target.value)} placeholder="e.g. AA-12345" required onFocus={() => setFocused("plate")} onBlur={() => setFocused(null)} style={{ ...inputStyle("plate"), fontFamily: "monospace", textTransform: "uppercase" as const }} />
                </div>
                <div>
                  <label style={labelStyle}>Capacity (tons)</label>
                  <input type="number" value={form.capacityTons} onChange={(e) => update("capacityTons", e.target.value)} placeholder="e.g. 20" required min="0.5" step="0.5" onFocus={() => setFocused("capacity")} onBlur={() => setFocused(null)} style={inputStyle("capacity")} />
                </div>
                <div>
                  <label style={labelStyle}>Length (meters) <span style={{ fontWeight: "400", color: "#9e9890" }}>(optional)</span></label>
                  <input type="number" value={form.lengthMeters} onChange={(e) => update("lengthMeters", e.target.value)} placeholder="e.g. 12" min="1" step="0.5" onFocus={() => setFocused("length")} onBlur={() => setFocused(null)} style={inputStyle("length")} />
                </div>
              </div>
            </div>

            {/* Section 2: Truck Type */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "#1a2744", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#f0ebe0", fontWeight: "700" }}>2</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", margin: 0 }}>Truck Type</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                {truckTypes.map((t) => (
                  <div key={t.value} onClick={() => update("truckType", t.value)} style={{ padding: "16px", borderRadius: "10px", border: `2px solid ${form.truckType === t.value ? "#1a2744" : "#e8e3d8"}`, background: form.truckType === t.value ? "#f0ebe0" : "#fff", cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: form.truckType === t.value ? "#1a2744" : "#374151", marginBottom: "4px" }}>{t.label}</div>
                    <div style={{ fontSize: "12px", color: "#9e9890", lineHeight: "1.4" }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Location */}
            <div style={{ marginBottom: "36px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "#1a2744", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#f0ebe0", fontWeight: "700" }}>3</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", margin: 0 }}>Current Location</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input type="text" value={form.currentCity} onChange={(e) => update("currentCity", e.target.value)} placeholder="e.g. Addis Ababa" required onFocus={() => setFocused("city")} onBlur={() => setFocused(null)} style={inputStyle("city")} />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <select value={form.currentCountry} onChange={(e) => update("currentCountry", e.target.value)} required onFocus={() => setFocused("country")} onBlur={() => setFocused(null)} style={{ ...inputStyle("country"), appearance: "none" as const }}>
                    <option value="">Select country</option>
                    {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => router.push("/dashboard")} style={{ flex: 1, background: "#f0ebe0", border: "none", borderRadius: "10px", padding: "15px", color: "#1a2744", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={loading || !form.truckType} style={{ flex: 2, background: loading || !form.truckType ? "#e8e3d8" : "#1a2744", border: "none", borderRadius: "10px", padding: "15px", color: loading || !form.truckType ? "#aaa" : "#f0ebe0", fontSize: "15px", fontWeight: "700", cursor: loading || !form.truckType ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                {loading ? "Adding truck..." : "Add Truck"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
