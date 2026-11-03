"use client";
import { ShieldCheck, CheckCircle2, Camera, IdCard, FileText, FolderUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";

// Account verification — same for all users
const ACCOUNT_DOCS = [
  { key: "PROFILE_PHOTO", label: "Profile photo", desc: "A clear, recent photo of your face", required: true, Icon: Camera },
  { key: "NATIONAL_ID", label: "National ID or passport", desc: "A clear photo of your national ID card or passport", required: true, Icon: IdCard },
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
      setError(formatApiError(err, "We couldn't upload your documents. Please try again.", "profile"));
    } finally {
      setUploading(false);
    }
  };

  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @media (max-width: 640px) {
          .verify-success-card { padding: 32px 20px !important; margin: 12px !important; }
        }
      `}</style>
      <div className="verify-success-card" style={{ textAlign: "center", maxWidth: "440px", padding: "48px 32px", background: "var(--surface)", borderRadius: "24px", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ width: "72px", height: "72px", background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <ShieldCheck size={36} color="#C2791A" strokeWidth={1.5} />
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: "800", color: "var(--primary)" }}>Documents received</h2>
        <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: "15px", lineHeight: "1.6" }}>Thanks — we've got them. Our team usually reviews accounts within 24 hours and we'll notify you the moment yours is verified.</p>
        <div style={{ background: "#f8f7f5", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
          {["Documents submitted", "Under review by our team", "Account activated"].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: i === 0 ? "#16a34a" : i === 1 ? "#C2791A" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {i === 0 ? <CheckCircle2 size={14} color="#fff" /> : <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: i === 1 ? "#fff" : "#9ca3af" }} />}
              </div>
              <span style={{ fontSize: "14px", color: i === 2 ? "var(--text-muted)" : "var(--primary)", fontWeight: i === 1 ? "600" : "400" }}>{step}</span>
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/dashboard")} style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: "700", cursor: "pointer", width: "100%" }}>
          Back to dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @media (max-width: 640px) {
          .verify-nav { padding: 0 16px !important; height: 56px !important; }
          .verify-nav-tag { font-size: 12px !important; }
          .verify-container { padding: 20px 16px !important; }
          .verify-h1 { font-size: 22px !important; }
          .verify-progress { padding: 16px !important; }
          .verify-doc-card { padding: 16px !important; }
          .verify-doc-top { flex-wrap: wrap; gap: 8px; }
          .verify-upload-drop { padding: 20px 12px !important; }
          .verify-submit-btn { padding: 14px !important; min-height: 48px; font-size: 15px !important; }
          .verify-success-card { padding: 32px 20px !important; margin: 12px !important; }
        }
        @media (max-width: 380px) {
          .verify-doc-title-row { flex-wrap: wrap; }
        }
      `}</style>
      <div className="verify-nav" style={{ background: "var(--primary)", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <img src="/logo.svg" alt="Sahid Freight" style={{ height: "40px", objectFit: "contain" }} />
        <span className="verify-nav-tag" style={{ color: "rgba(240,235,224,0.6)", fontSize: "14px" }}>Account verification</span>
      </div>

      <div className="verify-container" style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 className="verify-h1" style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: "800", color: "var(--primary)" }}>
            Verify your account
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "15px", lineHeight: "1.6" }}>
            Upload a profile photo and your national ID or passport so we can activate your account. Our team reviews submissions within 24 hours. Truck documents are added separately when you register a truck.
          </p>
        </div>

        <div className="verify-progress" style={{ background: "var(--surface)", borderRadius: "16px", padding: "20px 24px", marginBottom: "24px", border: "1px solid var(--bg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>Required documents uploaded</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#C2791A" }}>{uploadedRequired}/{requiredDocs.length}</span>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: "99px", height: "8px", overflow: "hidden" }}>
            <div style={{ background: "#C2791A", height: "100%", borderRadius: "99px", width: `${(uploadedRequired / requiredDocs.length) * 100}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
          {docs.map(doc => {
            const DocIcon = doc.Icon;
            return (
            <div key={doc.key} className="verify-doc-card" style={{ background: "var(--surface)", borderRadius: "16px", padding: "24px", border: `2px solid ${files[doc.key] ? "#16a34a" : "var(--bg)"}`, transition: "border 0.2s" }}>
              <div className="verify-doc-top" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <DocIcon size={20} color="#0A1F44" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="verify-doc-title-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--primary)" }}>{doc.label}</h3>
                      {doc.required
                        ? <span style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: "99px", border: "1px solid #fecaca" }}>Required</span>
                        : <span style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", background: "#f9fafb", padding: "2px 8px", borderRadius: "99px", border: "1px solid #e5e7eb" }}>Optional</span>
                      }
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>{doc.desc}</p>
                  </div>
                </div>
                {files[doc.key] && <CheckCircle2 size={18} color="#16a34a" />}
              </div>
              {previews[doc.key] ? (
                <div style={{ position: "relative" }}>
                  {files[doc.key]?.type === "application/pdf"
                    ? <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "12px", border: "1px solid #e5e7eb" }}>
                        <FileText size={28} color="#64748B" />
                        <div>
                          <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--primary)" }}>{files[doc.key]?.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{((files[doc.key]?.size || 0) / 1024).toFixed(0)} KB</div>
                        </div>
                      </div>
                    : <img src={previews[doc.key]} alt={doc.label} style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e5e7eb" }} />
                  }
                  <button onClick={() => { setFiles(p => ({ ...p, [doc.key]: null })); setPreviews(p => ({ ...p, [doc.key]: "" })); }}
                    aria-label="Remove file"
                    style={{ position: "absolute", top: "8px", right: "8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="verify-upload-drop" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px", borderRadius: "10px", border: "2px dashed var(--border)", cursor: "pointer", background: "var(--bg)", transition: "border-color 0.15s, background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#3D7BFF"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
                  <FolderUp size={26} color="#64748B" strokeWidth={1.7} />
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>Tap to upload</span>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>JPG, PNG or PDF — up to 10 MB</span>
                  <input type="file" accept="image/jpeg,image/png,application/pdf" style={{ display: "none" }} onChange={e => handleFile(doc.key, e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
            );
          })}
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", color: "#dc2626", fontSize: "14px" }}>
            {error}
          </div>
        )}

        {uploading && (
          <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px", border: "1px solid var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>Uploading documents…</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#C2791A" }}>{progress}%</span>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: "99px", height: "8px", overflow: "hidden" }}>
              <div style={{ background: "#C2791A", height: "100%", borderRadius: "99px", width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={!allRequiredUploaded || uploading}
          className="verify-submit-btn"
          style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "none", background: allRequiredUploaded && !uploading ? "var(--primary)" : "var(--border)", color: allRequiredUploaded && !uploading ? "#FAFAF8" : "var(--text-secondary)", fontSize: "16px", fontWeight: "700", cursor: allRequiredUploaded && !uploading ? "pointer" : "not-allowed" }}>
          {uploading ? `Uploading… ${progress}%` : "Submit for verification →"}
        </button>
        <p style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
          Feel free to keep using the app while our team reviews your documents.
        </p>
      </div>
    </div>
  );
}
