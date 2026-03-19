"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { UserPlus, Truck, Phone, Trash2, CheckCircle, Clock } from "lucide-react";

export default function DriversPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", password: "", country: "ETHIOPIA", city: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "TRUCK_OWNER") { router.push("/dashboard"); return; }
    fetchDrivers();
  }, [user]);

  const fetchDrivers = async () => {
    try {
      const res = await api.get("/drivers");
      setDrivers(res.data.drivers || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleAdd = async () => {
    if (!form.fullName || !form.phone || !form.password) { setError("All fields required"); return; }
    setSaving(true); setError("");
    try {
      await api.post("/drivers/invite", form);
      showToast("Driver added successfully");
      setShowAdd(false);
      setForm({ fullName: "", phone: "", password: "", country: "ETHIOPIA", city: "" });
      fetchDrivers();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add driver");
    } finally { setSaving(false); }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this driver?")) return;
    try {
      await api.delete("/drivers/" + id);
      showToast("Driver removed");
      fetchDrivers();
    } catch { showToast("Failed to remove driver"); }
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: "9px", border: "1px solid #ede9e0", fontSize: "13px", color: "#1a2744", outline: "none", background: "#faf8f4", boxSizing: "border-box" as const };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ width: "32px", height: "32px", border: "3px solid #e8e3d8", borderTop: "3px solid #1a2744", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div>
      {toast && <div style={{ position: "fixed" as const, top: "24px", right: "24px", background: "#1a2744", color: "#f0ebe0", padding: "12px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999 }}>{toast}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1a2744", letterSpacing: "-0.5px" }}>My Drivers</h1>
          <div style={{ fontSize: "13px", color: "#9e9890", marginTop: "3px" }}>Manage drivers assigned to your fleet</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: "flex", alignItems: "center", gap: "7px", background: "#1a2744", color: "#f0ebe0", padding: "10px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer" }}>
          <UserPlus size={15} /> Add Driver
        </button>
      </div>

      {drivers.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "72px 24px", textAlign: "center" as const, border: "1px solid #ede9e0" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#f5f3ef", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#c8c0b0" }}><UserPlus size={24} /></div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#1a2744", marginBottom: "7px" }}>No drivers yet</div>
          <div style={{ fontSize: "13px", color: "#9e9890", marginBottom: "20px" }}>Add drivers to assign them to bookings.</div>
          <button onClick={() => setShowAdd(true)} style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "#1a2744", color: "#f0ebe0", padding: "10px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", border: "none", cursor: "pointer" }}>
            <UserPlus size={15} /> Add First Driver
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
          {drivers.map((driver: any) => (
            <div key={driver.id} style={{ background: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #ede9e0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "#f0ebe0" }}>
                    {driver.fullName?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a2744" }}>{driver.fullName}</div>
                    <div style={{ fontSize: "12px", color: "#9e9890", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                      <Phone size={11} />{driver.phone}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRemove(driver.id)} style={{ background: "#fef2f2", border: "none", borderRadius: "7px", padding: "7px", cursor: "pointer", color: "#dc2626", display: "flex" }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={{ background: "#faf8f4", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ fontSize: "10px", color: "#9e9890", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "4px" }}>Current Assignment</div>
                {driver.bookingsAsDriver?.[0] ? (
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#1a2744" }}>
                    {driver.bookingsAsDriver[0].load?.title}
                    <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "99px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                      {driver.bookingsAsDriver[0].status}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "#9e9890" }}>No active assignment</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Driver Modal */}
      {showAdd && (
        <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "420px", padding: "28px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "17px", fontWeight: "800", color: "#1a2744", marginBottom: "20px" }}>Add New Driver</div>
            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", color: "#dc2626", fontSize: "13px", marginBottom: "14px" }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Full Name</label>
                <input style={inputStyle} placeholder="Driver full name" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Phone Number</label>
                <input style={inputStyle} placeholder="+251900000000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>City</label>
                <input style={inputStyle} placeholder="Driver city" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Password</label>
                <input style={inputStyle} type="password" placeholder="Set a password for the driver" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => { setShowAdd(false); setError(""); }} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1px solid #ede9e0", background: "#fff", color: "#6b7280", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, padding: "11px", borderRadius: "9px", border: "none", background: "#1a2744", color: "#f0ebe0", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Adding..." : "Add Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
