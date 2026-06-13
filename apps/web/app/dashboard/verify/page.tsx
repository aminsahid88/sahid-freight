"use client";
import { Truck, Package, Bell, Shield, DollarSign, Globe, Clock, MapPin, CheckCircle, AlertCircle, Inbox, BellOff, Fuel, Box, Minimize2, Container } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

// Account verification — same for all users
const ACCOUNT_DOCS = [
  { key: "PROFILE_PHOTO", label: "Profile Photo", desc: "A clear recent photo of your face", required: true, icon: "📷" },
  { key: "NATIONAL_ID", label: "National ID or Passport", desc: "Clear photo of your national ID card or passport", required: true, icon: "🪪" },
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

  const docs = ACCOUNT_DOCS;
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
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: "440px", padding: "48px 32px", background: "var(--surface)", borderRadius: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ width: "72px", height: "72px", background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Shield size={36} color="#F59E0B" strokeWidth={1.5} />
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: "800", color: "var(--primary)" }}>Documents Under Review</h2>
        <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: "15px", lineHeight: "1.6" }}>Your documents have been submitted successfully. Our team will review and verify your account within 24 hours.</p>
        <div style={{ background: "#f8f7f5", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
          {["Documents submitted", "Under review by our team", "Account activated"].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: i === 0 ? "#16a34a" : i === 1 ? "#F59E0B" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {i === 0 ? <CheckCircle size={14} color="#fff" /> : <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: i === 1 ? "#fff" : "#9ca3af" }} />}
              </div>
              <span style={{ fontSize: "14px", color: i === 2 ? "var(--text-muted)" : "var(--primary)", fontWeight: i === 1 ? "600" : "400" }}>{step}</span>
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/dashboard")} style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: "700", cursor: "pointer", width: "100%" }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ background: "var(--primary)", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <img src="/logo.svg" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
        <span style={{ color: "rgba(240,235,224,0.6)", fontSize: "14px" }}>Account Verification</span>
      </div>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: "800", color: "var(--primary)" }}>
            Verify Your Account
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "15px", lineHeight: "1.6" }}>
            Upload a profile photo and your national ID or passport. Our team will verify your account within 24 hours. Truck documents are submitted separately when you add a truck.
          </p>
        </div>

        <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "20px 24px", marginBottom: "24px", border: "1px solid var(--bg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>Required documents uploaded</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#F59E0B" }}>{uploadedRequired}/{requiredDocs.length}</span>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: "99px", height: "8px", overflow: "hidden" }}>
            <div style={{ background: "#F59E0B", height: "100%", borderRadius: "99px", width: `${(uploadedRequired / requiredDocs.length) * 100}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
          {docs.map(doc => (
            <div key={doc.key} style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: `2px solid ${files[doc.key] ? "#16a34a" : "var(--bg)"}`, transition: "border 0.2s" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "28px" }}>{doc.icon}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--primary)" }}>{doc.label}</h3>
                      {doc.required
                        ? <span style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: "99px", border: "1px solid #fecaca" }}>Required</span>
                        : <span style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", background: "#f9fafb", padding: "2px 8px", borderRadius: "99px", border: "1px solid #e5e7eb" }}>Optional</span>
                      }
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>{doc.desc}</p>
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
                          <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--primary)" }}>{files[doc.key]?.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{((files[doc.key]?.size || 0) / 1024).toFixed(0)} KB</div>
                        </div>
                      </div>
                    : <img src={previews[doc.key]} alt={doc.label} style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e5e7eb" }} />
                  }
                  <button onClick={() => { setFiles(p => ({ ...p, [doc.key]: null })); setPreviews(p => ({ ...p, [doc.key]: "" })); }}
                    style={{ position: "absolute", top: "8px", right: "8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: "28px", height: "28px", fontSize: "14px", cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px", borderRadius: "10px", border: "2px dashed var(--border)", cursor: "pointer", background: "var(--bg)" }}>
                  <span style={{ fontSize: "28px" }}>📁</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>Click to upload</span>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>JPG, PNG or PDF — max 10MB</span>
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
          <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px", border: "1px solid var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>Uploading documents...</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#F59E0B" }}>{progress}%</span>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: "99px", height: "8px", overflow: "hidden" }}>
              <div style={{ background: "#F59E0B", height: "100%", borderRadius: "99px", width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={!allRequiredUploaded || uploading}
          style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "none", background: allRequiredUploaded && !uploading ? "var(--primary)" : "var(--border)", color: allRequiredUploaded && !uploading ? "#FAFAF8" : "var(--text-secondary)", fontSize: "16px", fontWeight: "700", cursor: allRequiredUploaded && !uploading ? "pointer" : "not-allowed" }}>
          {uploading ? `Uploading... ${progress}%` : "Submit for Verification →"}
        </button>
        <p style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
          You can browse the app while your documents are under review
        </p>
      </div>
    </div>
  );
}
