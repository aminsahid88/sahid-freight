"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore, useGateStore } from "@/lib/store";
import { useEffect } from "react";

export default function NewTruckPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { openGate } = useGateStore();
  useEffect(() => {
    if (user && !user.isVerified) {
      
      router.push("/dashboard/trucks");
    }
  }, [user]);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [truckFiles, setTruckFiles] = useState<Record<string, File | null>>({});
  const [truckPreviews, setTruckPreviews] = useState<Record<string, string>>({});

  const TRUCK_DOCS = [
    { key: "TRUCK_REGISTRATION", label: "Truck Registration", desc: "Official registration certificate", required: true },
    { key: "TRUCK_INSURANCE", label: "Truck Insurance", desc: "Valid insurance document", required: true },
    { key: "PLATE_NUMBER_PHOTO", label: "Plate Number Photo", desc: "Clear photo of the plate", required: true },
  ];

  const handleTruckFile = (key: string, file: File | null) => {
    if (!file) return;
    setTruckFiles(prev => ({ ...prev, [key]: file }));
    const reader = new FileReader();
    reader.onload = () => setTruckPreviews(prev => ({ ...prev, [key]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const allTruckDocsUploaded = TRUCK_DOCS.filter(d => d.required).every(d => truckFiles[d.key]);
  const [form, setForm] = useState({
    plateNumber: "", truckType: "", capacityTons: "",
    lengthMeters: "", currentCity: "", currentCountry: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allTruckDocsUploaded) { setError("Please upload all required truck documents"); return; }
    setLoading(true);
    setError("");
    try {
      const truckRes = await api.post("/trucks", {
        ...form,
        capacityTons: parseFloat(form.capacityTons),
        lengthMeters: form.lengthMeters ? parseFloat(form.lengthMeters) : undefined,
      });
      const truckId = truckRes.data.truck?.id || truckRes.data.id;
      for (const [documentType, file] of Object.entries(truckFiles)) {
        if (!file) continue;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", documentType);
        formData.append("profileType", "TRUCK_OWNER");
        formData.append("truckId", truckId);
        await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      }
      router.push("/dashboard/trucks");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => ({
    width: "100%", background: focused === field ? "var(--surface)" : "var(--bg)",
    border: `1.5px solid ${focused === field ? "var(--primary)" : "var(--border)"}`,
    borderRadius: "10px", padding: "13px 16px", color: "var(--primary)",
    fontSize: "15px", outline: "none", boxSizing: "border-box" as const,
    transition: "all 0.15s", boxShadow: focused === field ? "0 0 0 3px rgba(10,31,68,0.08)" : "none",
  });

  const labelStyle = { display: "block", fontSize: "13px", fontWeight: "700" as const, color: "var(--primary)", marginBottom: "8px" };

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
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter, system-ui, sans-serif" }}>

      {/* Nav */}
      <div style={{ background: "var(--primary)", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
        </div>
        <button onClick={() => router.push("/dashboard")} style={{ background: "rgba(240,235,224,0.08)", border: "none", borderRadius: "8px", padding: "8px 16px", color: "rgba(240,235,224,0.6)", fontSize: "14px", cursor: "pointer" }}>
          ← Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary)", margin: "0 0 4px", letterSpacing: "-1px" }}>Add Your Truck</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>Register your truck to start receiving load requests</p>
        </div>

        <div style={{ background: "var(--surface)", borderRadius: "20px", padding: "40px", boxShadow: "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.08)", border: "1px solid rgba(10,31,68,0.06)" }}>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "28px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Section 1: Truck Details */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#FAFAF8", fontWeight: "700" }}>1</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>Truck Details</h3>
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
                  <label style={labelStyle}>Length (meters) <span style={{ fontWeight: "400", color: "var(--text-secondary)" }}>(optional)</span></label>
                  <input type="number" value={form.lengthMeters} onChange={(e) => update("lengthMeters", e.target.value)} placeholder="e.g. 12" min="1" step="0.5" onFocus={() => setFocused("length")} onBlur={() => setFocused(null)} style={inputStyle("length")} />
                </div>
              </div>
            </div>

            {/* Section 2: Truck Type */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#FAFAF8", fontWeight: "700" }}>2</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>Truck Type</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                {truckTypes.map((t) => (
                  <div key={t.value} onClick={() => update("truckType", t.value)} style={{ padding: "16px", borderRadius: "10px", border: `2px solid ${form.truckType === t.value ? "var(--primary)" : "var(--border)"}`, background: form.truckType === t.value ? "var(--bg)" : "var(--surface)", cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: form.truckType === t.value ? "var(--primary)" : "#374151", marginBottom: "4px" }}>{t.label}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Location */}
            <div style={{ marginBottom: "36px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "28px", height: "28px", background: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#FAFAF8", fontWeight: "700" }}>3</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>Current Location</h3>
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

            {/* Section 4: Truck Documents */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{ width: "28px", height: "28px", background: "var(--primary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#FAFAF8", fontWeight: "700" }}>4</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", margin: 0 }}>Truck Documents</h3>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px 38px" }}>Upload registration, insurance and plate photo for verification.</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
                {TRUCK_DOCS.map(doc => (
                  <div key={doc.key} style={{ background: truckFiles[doc.key] ? "#f0fdf4" : "var(--bg)", borderRadius: "12px", padding: "16px", border: `1.5px solid ${truckFiles[doc.key] ? "#bbf7d0" : "var(--border)"}`, transition: "all 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: truckPreviews[doc.key] ? "12px" : "0" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary)" }}>{doc.label}</span>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: "99px" }}>Required</span>
                        </div>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{doc.desc}</span>
                      </div>
                      {truckFiles[doc.key] ? (
                        <button type="button" onClick={() => { setTruckFiles(p => ({ ...p, [doc.key]: null })); setTruckPreviews(p => ({ ...p, [doc.key]: "" })); }}
                          style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: "26px", height: "26px", fontSize: "13px", cursor: "pointer", flexShrink: 0 }}>✕</button>
                      ) : (
                        <label style={{ background: "var(--primary)", color: "#FAFAF8", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer", flexShrink: 0 }}>
                          Upload
                          <input type="file" accept="image/jpeg,image/png,application/pdf" style={{ display: "none" }} onChange={e => handleTruckFile(doc.key, e.target.files?.[0] || null)} />
                        </label>
                      )}
                    </div>
                    {truckPreviews[doc.key] && (
                      truckFiles[doc.key]?.type === "application/pdf"
                        ? <div style={{ fontSize: "13px", color: "#16a34a", fontWeight: "600" }}>📄 {truckFiles[doc.key]?.name}</div>
                        : <img src={truckPreviews[doc.key]} alt={doc.label} style={{ width: "100%", maxHeight: "140px", objectFit: "cover", borderRadius: "8px" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={() => router.push("/dashboard")} style={{ flex: 1, background: "var(--bg)", border: "none", borderRadius: "10px", padding: "15px", color: "var(--primary)", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={loading || !form.truckType || !allTruckDocsUploaded} style={{ flex: 2, background: loading || !form.truckType || !allTruckDocsUploaded ? "var(--border)" : "var(--primary)", border: "none", borderRadius: "10px", padding: "15px", color: loading || !form.truckType || !allTruckDocsUploaded ? "#aaa" : "#FAFAF8", fontSize: "15px", fontWeight: "700", cursor: loading || !form.truckType || !allTruckDocsUploaded ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                {loading ? "Saving..." : "Add Truck & Submit Documents →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
