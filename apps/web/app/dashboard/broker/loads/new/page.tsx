"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import type { TruckType, Country } from "@/lib/types";

const PHONE_RE = /^\+?[0-9\s\-]{7,}$/;

const NAVY   = "#0A1F44";
const BLUE   = "#3D7BFF";
const BD     = "#E2E8F0";
const MUTED  = "#64748B";
const SUBTLE = "#94A3B8";
const DANGER    = "#DC2626";
const DANGER_BG = "#FEF2F2";
const DANGER_BD = "#FECACA";
const CARD_SHADOW = "0 2px 4px rgba(10,31,68,0.04), 0 8px 24px rgba(10,31,68,0.06)";

const TRUCK_TYPES: { value: TruckType; label: string }[] = [
  { value: "FLATBED",      label: "Flatbed" },
  { value: "REFRIGERATED", label: "Refrigerated" },
  { value: "TANKER",       label: "Tanker" },
  { value: "CONTAINER",    label: "Container" },
  { value: "OPEN_BODY",    label: "Open Body" },
  { value: "MINI_TRUCK",   label: "Mini Truck" },
];

const COUNTRIES: { value: Country; label: string }[] = [
  { value: "ETHIOPIA", label: "Ethiopia" },
  { value: "SOMALIA",  label: "Somalia" },
  { value: "DJIBOUTI", label: "Djibouti" },
];

const CURRENCIES = ["ETB", "USD", "SOS", "DJF"];

export default function BrokerNewLoadPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    weightTons: "",
    truckTypeNeeded: "" as TruckType | "",
    pickupCity: "",
    pickupCountry: "" as Country | "",
    deliveryCity: "",
    deliveryCountry: "" as Country | "",
    scheduledDate: "",
    offeredPrice: "",
    currency: "ETB",
    externalOwnerName: "",
    externalOwnerPhone: "",
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = (): string | null => {
    if (!form.title.trim())           return "Cargo title is required.";
    if (!form.weightTons.trim() || isNaN(parseFloat(form.weightTons)) || parseFloat(form.weightTons) <= 0)
      return "Weight must be a positive number.";
    if (!form.truckTypeNeeded)        return "Select the truck type needed.";
    if (!form.pickupCity.trim())      return "Pickup city is required.";
    if (!form.pickupCountry)          return "Select a pickup country.";
    if (!form.deliveryCity.trim())    return "Delivery city is required.";
    if (!form.deliveryCountry)        return "Select a delivery country.";
    if (!form.scheduledDate)          return "Scheduled date is required.";
    if (!form.offeredPrice.trim() || isNaN(parseFloat(form.offeredPrice)) || parseFloat(form.offeredPrice) <= 0)
      return "Offered price must be a positive number.";
    if (!form.externalOwnerName.trim())           return "Cargo owner name is required.";
    if (!PHONE_RE.test(form.externalOwnerPhone.trim()))
      return "Enter a valid cargo owner phone number.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setError("");
    setLoading(true);
    try {
      await api.post("/loads", {
        title:              form.title.trim(),
        description:        form.description.trim() || undefined,
        weightTons:         parseFloat(form.weightTons),
        truckTypeNeeded:    form.truckTypeNeeded,
        pickupCity:         form.pickupCity.trim(),
        pickupCountry:      form.pickupCountry,
        deliveryCity:       form.deliveryCity.trim(),
        deliveryCountry:    form.deliveryCountry,
        scheduledDate:      new Date(form.scheduledDate).toISOString(),
        offeredPrice:       parseFloat(form.offeredPrice),
        currency:           form.currency,
        externalOwnerName:  form.externalOwnerName.trim(),
        externalOwnerPhone: form.externalOwnerPhone.trim(),
      });
      router.push("/dashboard/broker");
    } catch (err: any) {
      setError(formatApiError(err));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  // Input / select shared style
  const inp = (field: string): React.CSSProperties => ({
    width: "100%",
    background: "#FFFFFF",
    border: `1.5px solid ${focused === field ? BLUE : BD}`,
    borderRadius: "10px",
    padding: "12px 14px",
    color: NAVY,
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxShadow: focused === field ? `0 0 0 3px rgba(61,123,255,0.12)` : "none",
    appearance: "none" as const,
  });

  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: SUBTLE,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    marginBottom: "7px",
  };

  const card: React.CSSProperties = {
    background: "#FFFFFF",
    border: `1px solid ${BD}`,
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "8px",
    boxShadow: CARD_SHADOW,
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 800,
    color: SUBTLE,
    letterSpacing: "1.4px",
    textTransform: "uppercase",
    marginBottom: "10px",
    marginTop: "24px",
    display: "block",
  };

  if (user && user.role !== "BROKER") {
    return (
      <div style={{ maxWidth: "520px", margin: "60px auto", textAlign: "center", padding: "0 24px" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#FEF2F2", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#DC2626", marginBottom: "14px" }}>
          <ShieldAlert size={24} strokeWidth={1.8} />
        </div>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>For brokers only</h2>
        <p style={{ fontSize: "14px", color: MUTED, lineHeight: 1.6 }}>
          Only broker accounts can post loads on behalf of offline cargo owners.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          style={{ marginTop: "20px", background: BLUE, color: "#FFFFFF", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", paddingBottom: "60px" }}>
      <style>{`
        @media (max-width: 560px) {
          .broker-grid-2 { grid-template-columns: 1fr !important; }
          .broker-grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <div
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", marginBottom: "16px" }}
          onClick={() => router.push("/dashboard/broker")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontSize: "13px", color: MUTED, fontWeight: 600 }}>Back to dashboard</span>
        </div>
        <h1 style={{ fontSize: "26px", fontWeight: 800, color: NAVY, margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          New load
        </h1>
        <p style={{ fontSize: "14px", color: MUTED, margin: 0 }}>
          Post a load on behalf of an offline cargo owner.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: DANGER_BG, border: `1px solid ${DANGER_BD}`, borderRadius: "12px", padding: "14px 16px", marginBottom: "20px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: "14px", color: DANGER, fontWeight: 500, lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── SECTION 1: Cargo ─────────────────────────── */}
        <span style={sectionLabel}>Cargo</span>
        <div style={card}>
          {/* Title */}
          <div style={{ marginBottom: "16px" }}>
            <label style={lbl}>Title <span style={{ color: DANGER }}>*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={set("title")}
              placeholder="e.g. Cement bags – Addis to Djibouti"
              onFocus={() => setFocused("title")}
              onBlur={() => setFocused(null)}
              style={inp("title")}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "16px" }}>
            <label style={lbl}>
              Description / notes{" "}
              <span style={{ fontWeight: 400, color: SUBTLE, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={set("description")}
              placeholder="Special handling instructions, fragile items, etc."
              rows={3}
              onFocus={() => setFocused("desc")}
              onBlur={() => setFocused(null)}
              style={{ ...inp("desc"), resize: "vertical", minHeight: "80px" }}
            />
          </div>

          {/* Weight + Truck type */}
          <div className="broker-grid-2" style={grid2}>
            <div>
              <label style={lbl}>Weight (tons) <span style={{ color: DANGER }}>*</span></label>
              <input
                type="number"
                value={form.weightTons}
                onChange={set("weightTons")}
                placeholder="e.g. 20"
                min="0.1"
                step="0.1"
                onFocus={() => setFocused("weight")}
                onBlur={() => setFocused(null)}
                style={inp("weight")}
              />
            </div>
            <div>
              <label style={lbl}>Truck type needed <span style={{ color: DANGER }}>*</span></label>
              <select
                value={form.truckTypeNeeded}
                onChange={set("truckTypeNeeded")}
                onFocus={() => setFocused("truckType")}
                onBlur={() => setFocused(null)}
                style={{ ...inp("truckType"), backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "36px" }}
              >
                <option value="">Select truck type</option>
                {TRUCK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Route ─────────────────────────── */}
        <span style={sectionLabel}>Route</span>
        <div style={card}>
          <div className="broker-grid-2" style={{ ...grid2, marginBottom: "16px" }}>
            <div>
              <label style={lbl}>Pickup city <span style={{ color: DANGER }}>*</span></label>
              <input
                type="text"
                value={form.pickupCity}
                onChange={set("pickupCity")}
                placeholder="e.g. Addis Ababa"
                onFocus={() => setFocused("pickupCity")}
                onBlur={() => setFocused(null)}
                style={inp("pickupCity")}
              />
            </div>
            <div>
              <label style={lbl}>Pickup country <span style={{ color: DANGER }}>*</span></label>
              <select
                value={form.pickupCountry}
                onChange={set("pickupCountry")}
                onFocus={() => setFocused("pickupCountry")}
                onBlur={() => setFocused(null)}
                style={{ ...inp("pickupCountry"), backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "36px" }}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="broker-grid-2" style={grid2}>
            <div>
              <label style={lbl}>Delivery city <span style={{ color: DANGER }}>*</span></label>
              <input
                type="text"
                value={form.deliveryCity}
                onChange={set("deliveryCity")}
                placeholder="e.g. Djibouti City"
                onFocus={() => setFocused("deliveryCity")}
                onBlur={() => setFocused(null)}
                style={inp("deliveryCity")}
              />
            </div>
            <div>
              <label style={lbl}>Delivery country <span style={{ color: DANGER }}>*</span></label>
              <select
                value={form.deliveryCountry}
                onChange={set("deliveryCountry")}
                onFocus={() => setFocused("deliveryCountry")}
                onBlur={() => setFocused(null)}
                style={{ ...inp("deliveryCountry"), backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "36px" }}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: Schedule & price ──────────────── */}
        <span style={sectionLabel}>Schedule &amp; price</span>
        <div style={card}>
          <div className="broker-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <div>
              <label style={lbl}>Scheduled date <span style={{ color: DANGER }}>*</span></label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={set("scheduledDate")}
                onFocus={() => setFocused("date")}
                onBlur={() => setFocused(null)}
                style={inp("date")}
              />
            </div>
            <div>
              <label style={lbl}>Offered price <span style={{ color: DANGER }}>*</span></label>
              <input
                type="number"
                value={form.offeredPrice}
                onChange={set("offeredPrice")}
                placeholder="e.g. 45000"
                min="1"
                onFocus={() => setFocused("price")}
                onBlur={() => setFocused(null)}
                style={inp("price")}
              />
            </div>
            <div>
              <label style={lbl}>Currency</label>
              <select
                value={form.currency}
                onChange={set("currency")}
                onFocus={() => setFocused("currency")}
                onBlur={() => setFocused(null)}
                style={{ ...inp("currency"), backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "36px" }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: Cargo owner ───────────────────── */}
        <span style={sectionLabel}>Who is this cargo for?</span>
        <p style={{ fontSize: "13px", color: MUTED, margin: "-4px 0 12px", lineHeight: 1.5 }}>
          The real cargo owner — usually someone who doesn't have a Sahid Freight account.
        </p>
        <div style={card}>
          <div className="broker-grid-2" style={grid2}>
            <div>
              <label style={lbl}>Cargo owner name <span style={{ color: DANGER }}>*</span></label>
              <input
                type="text"
                value={form.externalOwnerName}
                onChange={set("externalOwnerName")}
                placeholder="e.g. Ahmed Hassan"
                onFocus={() => setFocused("ownerName")}
                onBlur={() => setFocused(null)}
                style={inp("ownerName")}
              />
            </div>
            <div>
              <label style={lbl}>Cargo owner phone <span style={{ color: DANGER }}>*</span></label>
              <input
                type="tel"
                value={form.externalOwnerPhone}
                onChange={set("externalOwnerPhone")}
                placeholder="+251 911 000 000"
                onFocus={() => setFocused("ownerPhone")}
                onBlur={() => setFocused(null)}
                style={inp("ownerPhone")}
              />
            </div>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────── */}
        <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
          <button
            type="button"
            onClick={() => router.push("/dashboard/broker")}
            style={{ flex: 1, background: "#FFFFFF", border: `1px solid ${BD}`, borderRadius: "12px", padding: "14px", color: MUTED, fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ flex: 2, background: loading ? BD : BLUE, border: "none", borderRadius: "12px", padding: "14px", color: loading ? SUBTLE : "#FFFFFF", fontSize: "15px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s", fontFamily: "inherit" }}
          >
            {loading ? "Posting…" : "Post load"}
          </button>
        </div>
      </form>
    </div>
  );
}
