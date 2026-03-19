"use client";
import { Truck, Package, Bell, Shield, DollarSign, Globe, Clock, MapPin, CheckCircle, AlertCircle, Inbox, BellOff, Fuel, Box, Minimize2, Container } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

const TRUCK_OWNER_DOCS = [
  { key: "NATIONAL_ID", label: "National ID or Passport", desc: "Clear photo of your national ID card or passport", required: true, icon: "🪪" },
  { key: "DRIVERS_LICENSE", label: "Driver's License", desc: "Front and back of your valid driver's license", required: true, icon: "🚗" },
  { key: "TRUCK_REGISTRATION", label: "Truck Registration", desc: "Official truck registration certificate", required: true, icon: "📄" },
  { key: "TRUCK_INSURANCE", label: "Truck Insurance", desc: "Valid truck insurance document", required: true, icon: "shield" },
  { key: "PLATE_NUMBER_PHOTO", label: "Plate Number Photo", desc: "Clear photo of your truck's plate number", required: true, icon: "truck" },
];

const SENDER_DOCS = [
  { key: "NATIONAL_ID", label: "National ID or Passport", desc: "Clear photo of your national ID card or passport", required: true, icon: "🪪" },
  { key: "TRADE_LICENSE", label: "Trade License", desc: "Your business trade license (companies only)", required: false, icon: "📋" },
  { key: "COMPANY_REGISTRATION", label: "Company Registration", desc: "Company registration certificate (companies only)", required: false, icon: "🏢" },
];

export default function VerifyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    if (!user) router.push("/auth/login");
  }, [mounted]);

  if (!mounted) return null;

  const docs = user?.role === "TRUCK_OWNER" ? TRUCK_OWNER_DOCS : SENDER_DOCS;
  const requiredDocs = docs.filter(d => d.required);
  const uploadedRequired = requiredDocs.filter(d => files[d.key]).length;
  const allRequiredUploaded = uploadedRequired === requiredDocs.length;

  const handleFile = (key: string, file: File | null) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [key]: file }));
    const reader = new FileReader();
    reader.onload = () => setPreviews(prev => ({ ...prev, [key]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!allRequiredUploaded) return;
    setUploading(true);
    setError("");
    const profileType = user?.role === "TRUCK_OWNER" ? "TRUCK_OWNER" : "SENDER";
    const entries = Object.entries(files).filter(([_, f]) => f !== null);
    let done = 0;
    try {
      for (const [documentType, file] of entries) {
        const formData = new FormData();
        if (!file) continue;
        formData.append("file", file);
        formData.append("documentType", documentType);
        formData.append("profileType", profileType);
        await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
        done++;
        setProgress(Math.round((done / entries.length) * 100));
      }
      setSubmitted(true);
      setTimeout(() => router.push("/dashboard"), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Helvetica Neue, Arial, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: "400px", padding: "48px 32px", background: "#fff", borderRadius: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ marginBottom: "24px", color: "#16a34a", display: "flex", justifyContent: "center" }}><CheckCircle size={64} strokeWidth={1.5} /></div>
        <h2 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: "800", color: "#1a2744" }}>Documents Submitted!</h2>
        <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "15px", lineHeight: "1.6" }}>Your verification documents have been submitted successfully.</p>
        <p style={{ margin: 0, color: "#9e9890", fontSize: "14px" }}>Redirecting to dashboard...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0ebe0", fontFamily: "Helvetica Neue, Arial, sans-serif" }}>
      <div style={{ background: "#1a2744", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <img src="/loadlink.png" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
        <span style={{ color: "rgba(240,235,224,0.6)", fontSize: "14px" }}>Account Verification</span>
      </div>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: "800", color: "#1a2744" }}>
            {user?.role === "TRUCK_OWNER" ? "Verify Your Truck Owner Account" : "Verify Your Sender Account"}
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "15px", lineHeight: "1.6" }}>
            Upload your documents below. Our team will review and verify your account within 24 hours. You can browse the app while waiting.
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: "16px", padding: "20px 24px", marginBottom: "24px", border: "1px solid #f0ebe0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a2744" }}>Required documents uploaded</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#c8901e" }}>{uploadedRequired}/{requiredDocs.length}</span>
          </div>
          <div style={{ background: "#f0ebe0", borderRadius: "99px", height: "8px", overflow: "hidden" }}>
            <div style={{ background: "#c8901e", height: "100%", borderRadius: "99px", width: `${(uploadedRequired / requiredDocs.length) * 100}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
          {docs.map(doc => (
            <div key={doc.key} style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: `2px solid ${files[doc.key] ? "#16a34a" : "#f0ebe0"}`, transition: "border 0.2s" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "28px" }}>{doc.icon}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#1a2744" }}>{doc.label}</h3>
                      {doc.required
                        ? <span style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: "99px", border: "1px solid #fecaca" }}>Required</span>
                        : <span style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", background: "#f9fafb", padding: "2px 8px", borderRadius: "99px", border: "1px solid #e5e7eb" }}>Optional</span>
                      }
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#9e9890" }}>{doc.desc}</p>
                  </div>
                </div>
                {files[doc.key] && <CheckCircle size={18} color="#16a34a" />}
              </div>
              {previews[doc.key] ? (
                <div style={{ position: "relative" }}>
                  {files[doc.key]?.type === "application/pdf"
                    ? <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "12px", border: "1px solid #e5e7eb" }}>
                        <span style={{ fontSize: "32px" }}>📄</span>
                        <div>
                          <div style={{ fontWeight: "600", fontSize: "14px", color: "#1a2744" }}>{files[doc.key]?.name}</div>
                          <div style={{ fontSize: "12px", color: "#9e9890" }}>{((files[doc.key]?.size || 0) / 1024).toFixed(0)} KB</div>
                        </div>
                      </div>
                    : <img src={previews[doc.key]} alt={doc.label} style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e5e7eb" }} />
                  }
                  <button onClick={() => { setFiles(p => ({ ...p, [doc.key]: null })); setPreviews(p => ({ ...p, [doc.key]: "" })); }}
                    style={{ position: "absolute", top: "8px", right: "8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: "28px", height: "28px", fontSize: "14px", cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px", borderRadius: "10px", border: "2px dashed #e8e3d8", cursor: "pointer", background: "#faf8f4" }}>
                  <span style={{ fontSize: "28px" }}>📁</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a2744" }}>Click to upload</span>
                  <span style={{ fontSize: "12px", color: "#9e9890" }}>JPG, PNG or PDF — max 10MB</span>
                  <input type="file" accept="image/jpeg,image/png,application/pdf" style={{ display: "none" }} onChange={e => handleFile(doc.key, e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", color: "#dc2626", fontSize: "14px" }}>
            {error}
          </div>
        )}

        {uploading && (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px", border: "1px solid #f0ebe0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a2744" }}>Uploading documents...</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#c8901e" }}>{progress}%</span>
            </div>
            <div style={{ background: "#f0ebe0", borderRadius: "99px", height: "8px", overflow: "hidden" }}>
              <div style={{ background: "#c8901e", height: "100%", borderRadius: "99px", width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={!allRequiredUploaded || uploading}
          style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "none", background: allRequiredUploaded && !uploading ? "#1a2744" : "#e8e3d8", color: allRequiredUploaded && !uploading ? "#f0ebe0" : "#9e9890", fontSize: "16px", fontWeight: "700", cursor: allRequiredUploaded && !uploading ? "pointer" : "not-allowed" }}>
          {uploading ? `Uploading... ${progress}%` : "Submit for Verification →"}
        </button>
        <p style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "#9e9890" }}>
          You can browse the app while your documents are under review
        </p>
      </div>
    </div>
  );
}
