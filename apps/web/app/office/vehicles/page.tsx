"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { backoffice, type Driver, type Vehicle } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { StatusPill } from "@/components/office/StatusPill";

const input: React.CSSProperties = { width: "100%", height: 44, padding: "0 12px", borderRadius: 10, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)", fontSize: 14, fontFamily: "inherit" };
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 };
const card: React.CSSProperties = { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, boxShadow: "var(--card-shadow)" };
const primary: React.CSSProperties = { height: 44, padding: "0 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 };

export default function VehiclesPage() {
  const { t } = useT();
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState("");
  const [showVehicle, setShowVehicle] = useState(false);
  const [showDriver, setShowDriver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState({ unitNumber: "", vin: "", plate: "", axles: "5", tankCapacityGal: "", eldProvider: "" });
  const [d, setD] = useState({ name: "", phone: "", defaultVehicleId: "", language: "EN" as "EN" | "SO" });

  const load = async () => {
    if (!companyId) return;
    try {
      const [vs, ds] = await Promise.all([backoffice.vehicles(companyId), backoffice.drivers(companyId)]);
      setVehicles(vs);
      setDrivers(ds);
    } catch (e) {
      setError(formatApiError(e, t("common.error")));
    }
  };
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    Promise.all([backoffice.vehicles(companyId), backoffice.drivers(companyId)])
      .then(([vs, ds]) => {
        if (cancelled) return;
        setVehicles(vs);
        setDrivers(ds);
      })
      .catch((e) => !cancelled && setError(formatApiError(e, t("common.error"))));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const saveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError("");
    try {
      await backoffice.addVehicle(companyId, {
        unitNumber: v.unitNumber.trim(),
        vin: v.vin.trim() || undefined,
        plate: v.plate.trim() || undefined,
        axles: v.axles ? Number(v.axles) : undefined,
        tankCapacityGal: v.tankCapacityGal.trim() || undefined,
        eldProvider: v.eldProvider.trim() || undefined,
      } as never);
      setV({ unitNumber: "", vin: "", plate: "", axles: "5", tankCapacityGal: "", eldProvider: "" });
      setShowVehicle(false);
      await load();
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  const saveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError("");
    try {
      await backoffice.addDriver(companyId, { name: d.name.trim(), phone: d.phone.trim() || undefined, defaultVehicleId: d.defaultVehicleId || undefined, language: d.language });
      setD({ name: "", phone: "", defaultVehicleId: "", language: "EN" });
      setShowDriver(false);
      await load();
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", margin: "0 0 20px", color: "var(--text)" }}>{t("vehicles.title")}</h1>
      {error && <div role="alert" style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{t("nav.vehicles").split(" & ")[0]}</h2>
            <button style={primary} onClick={() => setShowVehicle((s) => !s)}><Plus size={16} /> {t("vehicles.addVehicle")}</button>
          </div>
          {showVehicle && (
            <form onSubmit={saveVehicle} style={{ display: "grid", gap: 10, padding: 14, borderRadius: 12, background: "var(--surface)", marginBottom: 12 }}>
              <div><label style={label}>{t("vehicles.unitNumber")}</label><input style={input} required value={v.unitNumber} onChange={(e) => setV({ ...v, unitNumber: e.target.value })} /></div>
              <div><label style={label}>{t("vehicles.vin")}</label><input style={input} maxLength={17} value={v.vin} onChange={(e) => setV({ ...v, vin: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={label}>{t("vehicles.plate")}</label><input style={input} value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value })} /></div>
                <div><label style={label}>{t("vehicles.axles")}</label><input style={input} type="number" min={2} max={10} value={v.axles} onChange={(e) => setV({ ...v, axles: e.target.value })} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={label}>{t("vehicles.tankCapacity")}</label><input style={input} inputMode="decimal" placeholder="300" value={v.tankCapacityGal} onChange={(e) => setV({ ...v, tankCapacityGal: e.target.value })} /></div>
                <div><label style={label}>{t("vehicles.eldProvider")}</label><input style={input} placeholder="Motive, Samsara…" value={v.eldProvider} onChange={(e) => setV({ ...v, eldProvider: e.target.value })} /></div>
              </div>
              <button type="submit" disabled={saving} style={primary}>{t("common.save")}</button>
            </form>
          )}
          {vehicles.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>{t("vehicles.emptyVehicles")}</div>
          ) : (
            vehicles.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>#{x.unitNumber}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{[x.plate, x.vin, x.eldProvider].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <StatusPill label={x.iftaQualified ? t("vehicles.iftaQualified") : t("vehicles.inactive")} tone={x.iftaQualified ? "green" : "grey"} />
              </div>
            ))
          )}
        </section>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{t("nav.vehicles").split(" & ")[1] ?? t("vehicles.addDriver")}</h2>
            <button style={primary} onClick={() => setShowDriver((s) => !s)}><Plus size={16} /> {t("vehicles.addDriver")}</button>
          </div>
          {showDriver && (
            <form onSubmit={saveDriver} style={{ display: "grid", gap: 10, padding: 14, borderRadius: 12, background: "var(--surface)", marginBottom: 12 }}>
              <div><label style={label}>{t("vehicles.driverName")}</label><input style={input} required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
              <div><label style={label}>{t("vehicles.driverPhone")}</label><input style={input} inputMode="tel" placeholder="+16125550100" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={label}>{t("vehicles.defaultVehicle")}</label>
                  <select style={input} value={d.defaultVehicleId} onChange={(e) => setD({ ...d, defaultVehicleId: e.target.value })}>
                    <option value="">—</option>
                    {vehicles.map((x) => <option key={x.id} value={x.id}>#{x.unitNumber}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>{t("vehicles.language")}</label>
                  <select style={input} value={d.language} onChange={(e) => setD({ ...d, language: e.target.value as "EN" | "SO" })}>
                    <option value="EN">English</option>
                    <option value="SO">Soomaali</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving} style={primary}>{t("common.save")}</button>
            </form>
          )}
          {drivers.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>{t("vehicles.emptyDrivers")}</div>
          ) : (
            drivers.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{x.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{[x.phone, x.defaultVehicle ? `#${x.defaultVehicle.unitNumber}` : null, x.language].filter(Boolean).join(" · ")}</div>
                </div>
                <StatusPill label={x.active ? t("vehicles.active") : t("vehicles.inactive")} tone={x.active ? "green" : "grey"} />
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
