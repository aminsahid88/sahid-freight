"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { UserPlus, Phone, Trash2, FileText, CheckCircle2, XCircle } from "lucide-react";
import { formatApiError } from "@/lib/errors";

export default function DriversPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", licenseNumber: "", password: "", country: "ETHIOPIA", city: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (!["TRUCK_OWNER", "CARGO_SENDER"].includes(user.role)) { router.push("/dashboard"); return; }
    fetchDrivers();
  }, [user]);

  const fetchDrivers = async () => {
    try {
      const res = await api.get("/drivers");
      setDrivers(res.data.drivers || []);
    } catch (err) {
      showToast(formatApiError(err, "We couldn't load your drivers.", "generic"));
    }
    finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleAdd = async () => {
    if (!form.fullName || !form.phone || !form.password) { setError("Full name, phone, and password are required."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/drivers/invite", form);
      showToast("Driver added — you can now assign them to a truck.");
      setShowAdd(false);
      setForm({ fullName: "", phone: "", licenseNumber: "", password: "", country: "ETHIOPIA", city: "" });
      fetchDrivers();
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't add this driver.", "generic"));
    } finally { setSaving(false); }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this driver? They will lose access to your trucks and any active dispatches.")) return;
    try {
      await api.delete("/drivers/" + id);
      showToast("Driver removed.");
      fetchDrivers();
    } catch (err) {
      showToast(formatApiError(err, "We couldn't remove this driver.", "generic"));
    }
  };

  const inp = {
    width: "100%", padding: "10px 14px", borderRadius: "9px",
    border: "1px solid var(--border)", fontSize: "13px", color: "var(--primary)",
    outline: "none", background: "var(--bg)", boxSizing: "border-box" as const,
  };

  const lbl = {
    display: "block", fontSize: "11px", fontWeight: "600" as const,
    color: "#6b7280", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px",
  };

  if (loading) return (
    <div style={{ padding: "32px" }}>
      <style>{`@keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.sk{background:linear-gradient(90deg,#ede9e2 25%,#e2ddd6 50%,#ede9e2 75%);background-size:2000px 100%;animation:shimmer 1.5s infinite;border-radius:10px;}`}</style>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>Loading your drivers…</div>
      <div className="sk" style={{ height: "32px", width: "200px", marginBottom: "24px" }} />
      {[1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: "100px", marginBottom: "12px" }} />)}
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", background: "var(--primary)", color: "#FAFAF8", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "var(--primary)", letterSpacing: "-0.5px" }}>Drivers</h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>People who drive your trucks.</div>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display: "flex", alignItems: "center", gap: "7px", background: "var(--primary)", color: "#FAFAF8", padding: "10px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer" }}>
          <UserPlus size={15} /> Add driver
        </button>
      </div>

      {/* Empty state */}
      {drivers.length === 0 ? (
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "72px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#94A3B8" }}>
            <UserPlus size={26} />
          </div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", marginBottom: "7px" }}>No drivers yet</div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>Add drivers to assign them to your trucks.</div>
          <button onClick={() => setShowAdd(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "var(--primary)", color: "#FAFAF8", padding: "10px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer" }}>
            <UserPlus size={15} /> Add driver
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
          {drivers.map((driver: any) => (
            <div key={driver.id} style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
              {/* Top row: avatar + name + delete */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "11px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "#FAFAF8", flexShrink: 0 }}>
                    {driver.fullName?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--primary)" }}>{driver.fullName}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      <Phone size={11} />{driver.phone}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRemove(driver.id)} aria-label="Remove driver"
                  style={{ background: "#fef2f2", border: "none", borderRadius: "7px", padding: "7px", cursor: "pointer", color: "#DC2626", display: "flex", flexShrink: 0, transition: "background 0.15s" }}
                  onMouseOver={e => { e.currentTarget.style.background = "#fee2e2"; }}
                  onMouseOut={e => { e.currentTarget.style.background = "#fef2f2"; }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "9px 11px" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>License</div>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <FileText size={11} />
                    {driver.licenseNumber || <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>Not provided</span>}
                  </div>
                </div>
                <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "9px 11px" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Status</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    {driver.status === "ACTIVE" ? (
                      <><CheckCircle2 size={12} color="#047857" /><span style={{ fontSize: "12px", fontWeight: "600", color: "#047857" }}>Active</span></>
                    ) : (
                      <><XCircle size={12} color="#DC2626" /><span style={{ fontSize: "12px", fontWeight: "600", color: "#DC2626" }}>Inactive</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* Current assignment */}
              <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "9px 11px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>Current dispatch</div>
                {driver.bookingsAsDriver?.[0] ? (
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    {driver.bookingsAsDriver[0].load?.title}
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: "#f0fdf4", color: "#047857", border: "1px solid #bbf7d0" }}>
                      {driver.bookingsAsDriver[0].status}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No active dispatch</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Driver Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "16px", width: "100%", maxWidth: "440px", padding: "28px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "17px", fontWeight: "800", color: "var(--primary)", marginBottom: "4px" }}>Add a driver</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>Creates a driver account they can sign in with.</div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "14px" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={lbl}>Full name *</label>
                <input style={inp} placeholder="e.g. Abdi Warsame" value={form.fullName}
                  onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Phone number *</label>
                <input style={inp} placeholder="+251900000000" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>License number</label>
                <input style={inp} placeholder="e.g. ETH-DL-123456" value={form.licenseNumber}
                  onChange={e => setForm(p => ({ ...p, licenseNumber: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>City</label>
                <input style={inp} placeholder="Driver's city" value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Password *</label>
                <input style={inp} type="password" placeholder="Used to sign in" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => { setShowAdd(false); setError(""); setForm({ fullName: "", phone: "", licenseNumber: "", password: "", country: "ETHIOPIA", city: "" }); }}
                style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving}
                style={{ flex: 2, padding: "11px", borderRadius: "9px", border: "none", background: "var(--primary)", color: "#FAFAF8", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Adding driver…" : "Add driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
