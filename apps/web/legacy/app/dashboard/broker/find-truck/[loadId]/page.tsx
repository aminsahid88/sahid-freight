"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { formatApiError } from "@/lib/errors";
import type { Load, Truck } from "@/lib/types";
import { motion } from "framer-motion";
import { ChevronLeft, ShieldCheck, Truck as TruckIcon, X as XIcon } from "lucide-react";

// Broker design language — locked light/airy palette.
const P      = "var(--primary)";
const A      = "var(--accent)";
const NAVY   = "var(--navy, #0A1F44)";
const BORDER = "var(--border, #E2E8F0)";

const TEAL_BG  = "#ECFDF5";
const TEAL_FG  = "#047857";
const TEAL_BD  = "#A7F3D0";
const AMBER_BG = "#FFF7ED";
const AMBER_FG = "#C2791A";
const AMBER_BD = "#FED7AA";
const MUTED    = "#64748B";
const SUBTLE   = "#94A3B8";
const SKEL     = "#F1F5F9";
const DISABLED = "#F1F5F9";
const DANGER   = "#DC2626";
const DANGER_BG = "#FEF2F2";

type EnrichedTruck = Truck & {
  _capOk: boolean;
  _availOk: boolean;
  _near: boolean;
  _hasDriver: boolean;
  _eligible: boolean;
  _score: number;
};

export default function FindTruckPage() {
  const router = useRouter();
  const params = useParams<{ loadId: string }>();
  const loadId = params.loadId;

  const [load, setLoad] = useState<Load | null>(null);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterAvailable, setFilterAvailable] = useState(true);
  const [filterNear, setFilterNear] = useState(true);
  const [filterCapacity, setFilterCapacity] = useState(true);

  const [confirmTruck, setConfirmTruck] = useState<EnrichedTruck | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // ── fetch ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!loadId) return;
    try {
      const loadRes = await api.get(`/loads/${loadId}`);
      const ld: Load = loadRes.data?.load || loadRes.data;
      setLoad(ld);

      const qs = new URLSearchParams();
      qs.set("available", filterAvailable ? "true" : "all");
      if (filterNear && ld?.pickupCity) qs.set("city", ld.pickupCity);
      const trucksRes = await api.get(`/trucks?${qs.toString()}`);
      setTrucks((trucksRes.data?.trucks || []) as Truck[]);
    } catch (e: any) {
      setError(formatApiError(e, "Couldn't load this dispatch. Please try again.", "load"));
    } finally {
      setLoading(false);
    }
  }, [loadId, filterAvailable, filterNear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── derive: enrich + sort best-match first ───────────────────────
  const enriched: EnrichedTruck[] = useMemo(() => {
    if (!load) return [];
    const requiredTons = Number(load.weightTons || 0);
    const pickupCity = load.pickupCity?.toLowerCase();
    return trucks
      .map<EnrichedTruck>((t) => {
        const capOk = !filterCapacity || Number(t.capacityTons) >= requiredTons;
        const availOk = t.isAvailable === true;
        const near = !!t.currentCity && !!pickupCity && t.currentCity.toLowerCase() === pickupCity;
        const hasDriver = !!t.driver?.fullName;
        const eligible = capOk && availOk;
        const score = (eligible ? 0 : 100) + (near ? 0 : 1) + (hasDriver ? 0 : 1);
        return { ...t, _capOk: capOk, _availOk: availOk, _near: near, _hasDriver: hasDriver, _eligible: eligible, _score: score };
      })
      .sort((a, b) => a._score - b._score);
  }, [trucks, load, filterCapacity]);

  const firstEligibleId = enriched.find((t) => t._eligible)?.id;

  // ── dispatch ─────────────────────────────────────────────────────
  const handleDispatch = async () => {
    if (!confirmTruck || !load) return;
    const truck = confirmTruck;
    setDispatchingId(truck.id);
    setError("");
    try {
      await api.post("/bookings", {
        loadId: load.id,
        truckId: truck.id,
        agreedPrice: load.offeredPrice,
        currency: load.currency || "ETB",
      });
      // Broker dispatch auto-accepts (P2) + auto-copies truck.driverId (P3e).
      // Back to dashboard — the load now sits under "In transit".
      router.push("/dashboard/broker");
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = formatApiError(e, "Couldn't dispatch this truck. Please try again.", "booking");
      if (status === 400 && /no longer available/i.test(msg)) {
        setError(msg);
        // Load taken by someone else — bounce home after a beat.
        setTimeout(() => router.push("/dashboard/broker"), 1500);
      } else {
        setError(msg);
        // Refresh so a now-taken truck disappears from the list.
        fetchAll();
      }
    } finally {
      setDispatchingId(null);
      setConfirmTruck(null);
    }
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .find-truck-h1 { font-size: 22px !important; }
          .find-truck-context { padding: 16px 16px !important; border-radius: 12px !important; }
          .find-truck-context-title { font-size: 16px !important; }
          .find-truck-context-meta { font-size: 12px !important; gap: 6px !important; }
          .find-truck-chips {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
            margin-left: -16px;
            margin-right: -16px;
            padding-left: 16px;
            padding-right: 16px;
          }
          .find-truck-chips::-webkit-scrollbar { display: none; }
          .find-truck-chip { flex-shrink: 0; scroll-snap-align: start; min-height: 40px; }
          .find-truck-card { padding: 16px !important; }
          .find-truck-row-value { max-width: 60% !important; font-size: 12px !important; }
          .find-truck-dispatch-btn { min-height: 44px !important; }
          .find-truck-modal-backdrop { padding: 0 !important; align-items: flex-end !important; }
          .find-truck-modal-card { max-width: 100% !important; width: 100% !important; border-radius: 20px 20px 0 0 !important; padding: 22px 20px 26px !important; max-height: 92vh; overflow-y: auto; }
          .find-truck-modal-actions { flex-direction: column-reverse !important; }
          .find-truck-modal-actions > button { min-height: 44px !important; }
        }
      `}</style>
      {/* Back link */}
      <button onClick={() => router.push("/dashboard/broker")} style={styles.backBtn}>
        <ChevronLeft size={16} strokeWidth={2.4} /> Back to dashboard
      </button>

      {/* Page header */}
      <div style={{ marginBottom: "16px" }}>
        <h1 className="find-truck-h1" style={{ fontSize: "26px", fontWeight: 800, color: "var(--primary)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
          Find a truck
        </h1>
        <p style={{ fontSize: "14px", color: MUTED, margin: 0 }}>
          Choose a verified truck to dispatch to this load.
        </p>
      </div>

      {/* Load context strip */}
      {load ? (
        <section style={styles.loadContext} className="find-truck-context">
          <div style={styles.loadContextLabel}>DISPATCHING</div>
          <div style={styles.loadContextTitle} className="find-truck-context-title">{load.title}</div>
          <div style={styles.loadContextMeta} className="find-truck-context-meta">
            <span>{load.weightTons}t</span>
            <Dot />
            <span>{load.pickupCity} → {load.deliveryCity}</span>
            {load.scheduledDate && (
              <>
                <Dot />
                <span>{new Date(load.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </>
            )}
            <Dot />
            <span style={{ fontWeight: 700, color: P }}>{formatPrice(load.offeredPrice, load.currency || "ETB")}</span>
          </div>
        </section>
      ) : (
        <div style={styles.loadContext}>
          <div style={{ ...styles.skelLine, width: "30%", marginBottom: "8px" }} />
          <div style={{ ...styles.skelLine, width: "60%" }} />
        </div>
      )}

      {/* Filter chips */}
      <div style={styles.chipsRow} className="find-truck-chips">
        <Chip label="Available now" active={filterAvailable} onClick={() => setFilterAvailable((v) => !v)} />
        <Chip
          label={load?.pickupCity ? `Near ${load.pickupCity}` : "Near pickup"}
          active={filterNear}
          onClick={() => setFilterNear((v) => !v)}
        />
        <Chip
          label={load?.weightTons ? `${load.weightTons}t+ capacity` : "Capacity"}
          active={filterCapacity}
          onClick={() => setFilterCapacity((v) => !v)}
        />
      </div>

      {/* Error banner (sticky-ish at top of list) */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={styles.errorClose} aria-label="Dismiss">
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Truck list */}
      <section>
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : enriched.length === 0 ? (
          <EmptyCard
            icon={<TruckIcon size={32} color={SUBTLE} strokeWidth={1.8} />}
            title="No trucks match this load right now"
            body="Try relaxing the availability or capacity filters, or check back in a few minutes — owners update availability as trucks free up."
          />
        ) : (
          enriched.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4) }}
            >
              <TruckCard
                truck={t}
                isBestMatch={t.id === firstEligibleId}
                anyDispatching={dispatchingId !== null}
                onDispatch={() => setConfirmTruck(t)}
              />
            </motion.div>
          ))
        )}
      </section>

      {/* Confirm dispatch modal */}
      {confirmTruck && load && (
        <ConfirmModal
          load={load}
          truck={confirmTruck}
          loading={dispatchingId === confirmTruck.id}
          onConfirm={handleDispatch}
          onCancel={() => setConfirmTruck(null)}
        />
      )}
    </div>
  );
}

/* ── sub-components ───────────────────────────────────────────────── */

function Dot() {
  return <span style={{ color: SUBTLE }}>·</span>;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="find-truck-chip"
      style={{
        ...styles.chip,
        background: active ? NAVY : "#FFFFFF",
        borderColor: active ? NAVY : BORDER,
        color: active ? "#FFFFFF" : MUTED,
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </button>
  );
}

function TruckCard({
  truck, isBestMatch, anyDispatching, onDispatch,
}: { truck: EnrichedTruck; isBestMatch: boolean; anyDispatching: boolean; onDispatch: () => void }) {
  const eligible = truck._eligible;
  const reason = !truck._availOk ? "Truck is currently unavailable."
    : !truck._capOk ? `Capacity too low — only ${truck.capacityTons}t.`
    : null;

  return (
    <article
      className="find-truck-card"
      style={{
        ...styles.truckCard,
        background: eligible ? "#FFFFFF" : DISABLED,
        opacity: eligible ? 1 : 0.88,
      }}
    >
      {/* Top row: title + verified + best-match badge */}
      <div style={styles.truckTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.truckTitleRow}>
            <div style={{ ...styles.truckTitle, color: eligible ? P : SUBTLE }}>
              {(truck.truckType || "").replace(/_/g, " ")} · {truck.capacityTons}t
            </div>
            {truck.isVerified && (
              <span style={{ ...styles.pill, background: TEAL_BG, color: TEAL_FG, borderColor: TEAL_BD, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <ShieldCheck size={10} strokeWidth={2.6} /> VERIFIED
              </span>
            )}
          </div>
          <div style={{ ...styles.truckPlate, color: eligible ? MUTED : SUBTLE }}>{truck.plateNumber}</div>
        </div>
        {isBestMatch && (
          <span style={{ ...styles.pill, background: TEAL_BG, color: TEAL_FG, borderColor: TEAL_BD }}>BEST MATCH</span>
        )}
      </div>

      {/* Detail rows */}
      <div style={styles.truckRow}>
        <span style={styles.truckRowLabel}>Location</span>
        <span style={styles.truckRowValueGroup}>
          {truck._near && (
            <span style={{ ...styles.pill, background: AMBER_BG, color: AMBER_FG, borderColor: AMBER_BD, fontSize: "9px", padding: "2px 8px" }}>NEAR</span>
          )}
          <span className="find-truck-row-value" style={{ ...styles.truckRowValue, color: eligible ? P : SUBTLE }}>
            {truck.currentCity}{truck.currentCountry ? `, ${truck.currentCountry}` : ""}
          </span>
        </span>
      </div>

      <div style={styles.truckRow}>
        <span style={styles.truckRowLabel}>Driver</span>
        <span className="find-truck-row-value" style={{ ...styles.truckRowValue, color: eligible ? P : SUBTLE }}>
          {truck.driver?.fullName
            ? `${truck.driver.fullName}${truck.driver.licenseNumber ? ` · #${truck.driver.licenseNumber}` : ""}`
            : "No driver attached"}
        </span>
      </div>

      <div style={styles.truckRow}>
        <span style={styles.truckRowLabel}>Truck owner</span>
        <span style={{ ...styles.truckRowValue, color: eligible ? P : SUBTLE, display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
          {truck.owner?.fullName || "—"}
          {truck.owner?.isVerified && <ShieldCheck size={12} color={TEAL_FG} strokeWidth={2.6} />}
        </span>
      </div>

      {/* Reason (when ineligible) */}
      {!eligible && reason && (
        <div style={styles.reasonRow}>{reason}</div>
      )}

      {/* Action */}
      <div style={{ marginTop: "14px" }}>
        {eligible ? (
          <button
            onClick={onDispatch}
            disabled={anyDispatching}
            className="find-truck-dispatch-btn"
            style={{
              ...(isBestMatch ? styles.dispatchPrimary : styles.dispatchSecondary),
              ...(anyDispatching && { opacity: 0.5, cursor: "not-allowed" }),
              transition: "filter 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { if (!anyDispatching) e.currentTarget.style.filter = "brightness(0.94)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
          >
            Dispatch this truck →
          </button>
        ) : (
          <div style={styles.dispatchDisabled}>Not a fit for this load</div>
        )}
      </div>
    </article>
  );
}

function ConfirmModal({
  load, truck, loading, onConfirm, onCancel,
}: { load: Load; truck: Truck; loading: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={styles.modalBackdrop} className="find-truck-modal-backdrop" onClick={() => !loading && onCancel()}>
      <div style={styles.modalCard} className="find-truck-modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>Dispatch this truck?</div>
        <p style={{ fontSize: "13px", color: MUTED, margin: "-8px 0 12px", lineHeight: 1.5 }}>
          The cargo owner and truck owner will be notified, and the load will be marked as booked.
        </p>
        <div style={styles.modalRow}>
          <span style={styles.modalLabel}>Load</span>
          <span style={styles.modalValue}>{load.title}</span>
        </div>
        <div style={styles.modalRow}>
          <span style={styles.modalLabel}>Route</span>
          <span style={styles.modalValue}>{load.pickupCity} → {load.deliveryCity}</span>
        </div>
        <div style={styles.modalRow}>
          <span style={styles.modalLabel}>Truck</span>
          <span style={styles.modalValue}>{truck.plateNumber} · {(truck.truckType || "").replace(/_/g, " ")}</span>
        </div>
        <div style={styles.modalRow}>
          <span style={styles.modalLabel}>Truck owner</span>
          <span style={styles.modalValue}>{truck.owner?.fullName || "—"}</span>
        </div>
        <div style={{ ...styles.modalRow, borderBottom: "none", paddingBottom: 0 }}>
          <span style={styles.modalLabel}>Rate</span>
          <span style={{ ...styles.modalValue, fontWeight: 800, color: P }}>{formatPrice(load.offeredPrice, load.currency || "ETB")}</span>
        </div>
        <div style={styles.modalNote}>
          The cargo owner and truck owner will be notified, and the load will move to <strong>in transit</strong> immediately.
        </div>
        <div style={styles.modalActions} className="find-truck-modal-actions">
          <button onClick={onCancel} disabled={loading} style={styles.modalCancel}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{ ...styles.modalConfirm, ...(loading && { opacity: 0.6 }), transition: "filter 0.15s" }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.filter = "brightness(0.94)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
          >
            {loading ? "Dispatching…" : "Dispatch this truck"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={styles.emptyCard}>
      <div style={styles.emptyIcon}>{icon}</div>
      <div style={styles.emptyTitle}>{title}</div>
      <div style={styles.emptyBody}>{body}</div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={styles.skelCard}>
      <div style={{ ...styles.skelLine, width: "40%", height: "16px" }} />
      <div style={{ height: "8px" }} />
      <div style={{ ...styles.skelLine, width: "30%", height: "12px" }} />
      <div style={{ height: "18px" }} />
      <div style={{ ...styles.skelLine, width: "100%", height: "36px", borderRadius: "10px" }} />
    </div>
  );
}

/* ── styles ───────────────────────────────────────────────────────── */

const cardShadow = "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.06)";

const styles: Record<string, React.CSSProperties> = {
  backBtn:        { background: "none", border: "none", color: A, fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "0 0 12px", display: "inline-flex", alignItems: "center", gap: "4px" },

  /* load context */
  loadContext:    { background: "#FFFFFF", borderRadius: "14px", padding: "20px 24px", marginBottom: "20px", border: `1px solid ${BORDER}`, boxShadow: cardShadow },
  loadContextLabel: { fontSize: "11px", fontWeight: 800, color: SUBTLE, letterSpacing: "1.2px", marginBottom: "6px" },
  loadContextTitle: { fontSize: "18px", fontWeight: 700, color: P, marginBottom: "6px", letterSpacing: "-0.3px" },
  loadContextMeta:  { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", fontSize: "13px", color: MUTED },

  /* chips */
  chipsRow:       { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" },
  chip:           { padding: "9px 16px", borderRadius: "999px", border: "1px solid", fontSize: "13px", cursor: "pointer" },

  /* error banner */
  errorBanner:    { background: DANGER_BG, border: "1px solid #FECACA", borderRadius: "12px", padding: "12px 16px", color: DANGER, fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  errorClose:     { background: "none", border: "none", color: DANGER, lineHeight: 1, cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" },

  /* truck card */
  truckCard:      { borderRadius: "14px", padding: "20px 22px", marginBottom: "12px", border: `1px solid ${BORDER}`, boxShadow: cardShadow },
  truckTop:       { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "16px" },
  truckTitleRow:  { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" },
  truckTitle:     { fontSize: "16px", fontWeight: 700, textTransform: "capitalize", letterSpacing: "-0.2px" },
  truckPlate:     { fontSize: "13px", fontFamily: "monospace" },

  truckRow:       { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${BORDER}` },
  truckRowLabel:  { fontSize: "11px", fontWeight: 600, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.8px" },
  truckRowValue:  { fontSize: "13px", fontWeight: 500, textAlign: "right", maxWidth: "65%" },
  truckRowValueGroup: { display: "flex", alignItems: "center", gap: "8px" },

  reasonRow:      { marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${BORDER}`, fontSize: "12px", color: AMBER_FG, fontWeight: 500 },

  /* dispatch buttons */
  dispatchPrimary:    { width: "100%", background: A, color: "#FFFFFF", border: "none", borderRadius: "10px", padding: "12px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  dispatchSecondary:  { width: "100%", background: "#FFFFFF", color: P, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "12px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  dispatchDisabled:   { width: "100%", background: "transparent", color: SUBTLE, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "12px 16px", fontSize: "13px", fontWeight: 500, textAlign: "center" },

  /* pill */
  pill:           { fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", border: "1px solid", letterSpacing: "1px", whiteSpace: "nowrap" },

  /* empty + skel */
  emptyCard:      { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "40px 24px", textAlign: "center" },
  emptyIcon:      { display: "flex", justifyContent: "center", marginBottom: "14px" },
  emptyTitle:     { fontSize: "15px", fontWeight: 700, color: P, marginBottom: "6px" },
  emptyBody:      { fontSize: "13px", color: MUTED, lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" },
  skelCard:       { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "20px", marginBottom: "12px" },
  skelLine:       { height: "14px", background: SKEL, borderRadius: "6px" },

  /* modal */
  modalBackdrop:  { position: "fixed", inset: 0, background: "rgba(10,31,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" },
  modalCard:      { background: "#FFFFFF", borderRadius: "16px", padding: "24px", maxWidth: "440px", width: "100%", boxShadow: "0 24px 64px rgba(10,31,68,0.25)" },
  modalTitle:     { fontSize: "18px", fontWeight: 700, color: P, marginBottom: "16px" },
  modalRow:       { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${BORDER}`, gap: "12px" },
  modalLabel:     { fontSize: "12px", color: SUBTLE, fontWeight: 600 },
  modalValue:     { fontSize: "13px", color: P, fontWeight: 500, textAlign: "right", maxWidth: "65%" },
  modalNote:      { fontSize: "12px", color: MUTED, marginTop: "14px", lineHeight: 1.5 },
  modalActions:   { display: "flex", gap: "10px", marginTop: "20px" },
  modalCancel:    { flex: 1, background: "#F8FAFC", border: `1px solid ${BORDER}`, color: P, borderRadius: "10px", padding: "11px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  modalConfirm:   { flex: 1.4, background: A, color: "#FFFFFF", border: "none", borderRadius: "10px", padding: "11px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
};
