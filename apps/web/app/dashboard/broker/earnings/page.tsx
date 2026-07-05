"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/format";
import { formatApiError } from "@/lib/errors";
import type { Booking } from "@/lib/types";

/* ── palette ─────────────────────────────────────────────────────── */
const NAVY     = "#0A1F44";
const BLUE     = "#3D7BFF";
const BD       = "#E2E8F0";
const MUTED    = "#64748B";
const SUBTLE   = "#94A3B8";
const SKEL     = "#F1F5F9";

const TEAL_BG  = "#ECFDF5";
const TEAL_FG  = "#047857";
const TEAL_BD  = "#A7F3D0";
const AMBER_BG = "#FFF7ED";
const AMBER_FG = "#C2791A";
const AMBER_BD = "#FED7AA";
const DANGER   = "#DC2626";
const DANGER_BG = "#FEF2F2";
const DANGER_BD = "#FECACA";

const CARD_SHADOW = "0 2px 4px rgba(10,31,68,0.04), 0 8px 24px rgba(10,31,68,0.06)";

/* ── types ───────────────────────────────────────────────────────── */
type Settlement = "NEEDS_COLLECTION" | "NEEDS_PAYOUT" | "SETTLED" | "IN_PROGRESS";
type ModalState = { type: "collect"; booking: any } | { type: "payout"; booking: any } | null;

type EnrichedBooking = Booking & {
  _settlement: Settlement;
  _priority: number;
};

/* ── helpers ─────────────────────────────────────────────────────── */
function enrich(bookings: Booking[]): EnrichedBooking[] {
  return bookings
    .filter((b) => ["ACCEPTED", "IN_TRANSIT", "COMPLETED", "DELIVERED"].includes(b.status))
    .map((b) => {
      const collected = !!b.brokerCollectedAt;
      const paid      = !!b.ownerPaidOutAt;
      const done      = b.status === "COMPLETED" || (b.status as string) === "DELIVERED";

      const settlement: Settlement =
        collected && paid  ? "SETTLED"
        : collected        ? "NEEDS_PAYOUT"
        : done             ? "NEEDS_COLLECTION"
        : "IN_PROGRESS";

      const priority =
        settlement === "NEEDS_COLLECTION" ? 0
        : settlement === "NEEDS_PAYOUT"   ? 1
        : settlement === "IN_PROGRESS"    ? 2
        : 3;

      return { ...b, _settlement: settlement, _priority: priority };
    })
    .sort((a, b) => a._priority - b._priority);
}

function computeStats(bookings: Booking[]) {
  const earned = bookings
    .filter((b) => b.brokerCollectedAt && b.brokerCutAmount != null)
    .reduce((s, b) => s + Number(b.brokerCutAmount), 0);

  const owedCount = bookings
    .filter((b) => (b.status === "COMPLETED" || (b.status as string) === "DELIVERED") && !b.brokerCollectedAt)
    .length;

  const toPayOut = bookings
    .filter((b) => b.brokerCollectedAt && !b.ownerPaidOutAt && b.ownerPayoutAmount != null)
    .reduce((s, b) => s + Number(b.ownerPayoutAmount), 0);

  return { earned, owedCount, toPayOut };
}

/* ══════════════════════════════════════════════════════════════════ */
export default function BrokerEarningsPage() {
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]         = useState<ModalState>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get("/bookings/broker/my");
      setBookings(res.data?.bookings || []);
    } catch {
      // best-effort; existing bookings stay shown
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const enriched = useMemo(() => enrich(bookings), [bookings]);
  const stats    = useMemo(() => computeStats(bookings), [bookings]);

  const updateLocal = (id: string, patch: Partial<Booking>) =>
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", paddingBottom: "60px" }}>
      <style>{`
        @media (max-width: 600px) {
          .earn-stats { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .earn-money-row { flex-direction: column !important; gap: 4px !important; }
        }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: NAVY, margin: "0 0 4px", letterSpacing: "-0.5px" }}>
            Earnings
          </h1>
          <p style={{ fontSize: "14px", color: MUTED, margin: 0 }}>
            Collect from cargo owners, pay out truck owners.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{ background: "#FFFFFF", border: `1px solid ${BD}`, borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, color: MUTED, cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.6 : 1, fontFamily: "inherit" }}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <div className="earn-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "28px" }}>
        <StatCard
          label="EARNED"
          value={loading ? null : formatPrice(stats.earned, "ETB")}
          hint="collected so far"
          tone="teal"
        />
        <StatCard
          label="OWED TO YOU"
          value={loading ? null : stats.owedCount === 0 ? "—" : `${stats.owedCount} job${stats.owedCount === 1 ? "" : "s"}`}
          hint="awaiting collection"
          tone={stats.owedCount > 0 ? "amber" : "subtle"}
        />
        <StatCard
          label="TO PAY OUT"
          value={loading ? null : stats.toPayOut > 0 ? formatPrice(stats.toPayOut, "ETB") : "—"}
          hint="owed to truck owners"
          tone={stats.toPayOut > 0 ? "amber" : "subtle"}
        />
      </div>

      {/* ── Booking list ────────────────────────────────────────── */}
      {loading ? (
        <ListSkeleton />
      ) : enriched.length === 0 ? (
        <EmptyCard />
      ) : (
        enriched.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            onCollect={() => setModal({ type: "collect", booking: b })}
            onPayout={() => setModal({ type: "payout",  booking: b })}
          />
        ))
      )}

      {/* ── Modals ──────────────────────────────────────────────── */}
      {modal?.type === "collect" && (
        <CollectModal
          booking={modal.booking}
          onClose={() => setModal(null)}
          onSaved={(patch) => { updateLocal(modal.booking.id, patch); setModal(null); }}
        />
      )}
      {modal?.type === "payout" && (
        <PayoutModal
          booking={modal.booking}
          onClose={() => setModal(null)}
          onSaved={(patch) => { updateLocal(modal.booking.id, patch); setModal(null); }}
        />
      )}
    </div>
  );
}

/* ── StatCard ────────────────────────────────────────────────────── */
function StatCard({
  label, value, hint, tone,
}: { label: string; value: string | null; hint: string; tone: "teal" | "amber" | "subtle" }) {
  const color = tone === "teal" ? TEAL_FG : tone === "amber" ? AMBER_FG : SUBTLE;
  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${BD}`, borderRadius: "14px", padding: "20px", boxShadow: CARD_SHADOW }}>
      <div style={{ fontSize: "10px", fontWeight: 800, color: SUBTLE, letterSpacing: "1.2px", marginBottom: "10px" }}>
        {label}
      </div>
      {value === null ? (
        <div style={{ width: "80px", height: "28px", background: SKEL, borderRadius: "6px", marginBottom: "6px" }} />
      ) : (
        <div style={{ fontSize: "22px", fontWeight: 800, color, letterSpacing: "-0.3px", marginBottom: "4px" }}>
          {value}
        </div>
      )}
      <div style={{ fontSize: "12px", color: MUTED }}>{hint}</div>
    </div>
  );
}

/* ── BookingCard ─────────────────────────────────────────────────── */
function BookingCard({
  booking, onCollect, onPayout,
}: { booking: EnrichedBooking; onCollect: () => void; onPayout: () => void }) {
  const s        = booking._settlement;
  const load     = (booking as any).load;
  const owner    = (booking as any).owner;
  const cargoOwner = load?.externalOwnerName || load?.sender?.fullName || "Cargo owner";
  const route    = `${load?.pickupCity || "—"} → ${load?.deliveryCity || "—"}`;
  const currency = booking.currency || "ETB";

  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${BD}`, borderRadius: "16px", padding: "20px", marginBottom: "12px", boxShadow: CARD_SHADOW }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: NAVY, marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {load?.title || "Load"}
          </div>
          <div style={{ fontSize: "13px", color: MUTED, marginBottom: "2px" }}>{route}</div>
          <div style={{ fontSize: "12px", color: SUBTLE }}>For: {cargoOwner}</div>
        </div>
        <SettlementPill settlement={s} />
      </div>

      {/* Money facts */}
      <div style={{ borderTop: `1px solid ${BD}`, paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
        <MoneyLine label="Agreed rate" value={formatPrice(booking.agreedPrice, currency)} />
        {booking.brokerCutAmount != null && (
          <MoneyLine label="Your cut" value={formatPrice(booking.brokerCutAmount, currency)} highlight />
        )}
        {booking.ownerPayoutAmount != null && (
          <MoneyLine label="Owner payout" value={formatPrice(booking.ownerPayoutAmount, currency)} />
        )}
        {owner?.fullName && (
          <MoneyLine label="Truck owner" value={owner.fullName} />
        )}
        {booking.brokerCollectedAt && (
          <MoneyLine label="Collected" value={formatDate(booking.brokerCollectedAt)} />
        )}
        {booking.ownerPaidOutAt && (
          <MoneyLine label="Owner paid" value={formatDate(booking.ownerPaidOutAt)} />
        )}
      </div>

      {/* Action */}
      {s === "NEEDS_COLLECTION" && (
        <button onClick={onCollect} style={btnStyle("blue")}>
          Record payment received
        </button>
      )}
      {s === "NEEDS_PAYOUT" && (
        <button onClick={onPayout} style={btnStyle("blue")}>
          Mark owner paid
        </button>
      )}
      {s === "SETTLED" && (
        <div style={{ background: TEAL_BG, border: `1px solid ${TEAL_BD}`, borderRadius: "10px", padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: TEAL_FG, letterSpacing: "0.3px" }}>
          <CheckCircle2 size={15} strokeWidth={2.4} /> Settled
        </div>
      )}
      {s === "IN_PROGRESS" && (
        <div style={{ background: "#F8FAFC", border: `1px solid ${BD}`, borderRadius: "10px", padding: "11px", textAlign: "center", fontSize: "12px", fontWeight: 500, color: MUTED }}>
          In progress — settle once delivered
        </div>
      )}
    </div>
  );
}

function SettlementPill({ settlement }: { settlement: Settlement }) {
  const map: Record<Settlement, { bg: string; fg: string; bd: string; label: string }> = {
    NEEDS_COLLECTION: { bg: AMBER_BG, fg: AMBER_FG, bd: AMBER_BD, label: "COLLECT" },
    NEEDS_PAYOUT:     { bg: AMBER_BG, fg: AMBER_FG, bd: AMBER_BD, label: "PAY OUT" },
    SETTLED:          { bg: TEAL_BG,  fg: TEAL_FG,  bd: TEAL_BD,  label: "SETTLED" },
    IN_PROGRESS:      { bg: "#F8FAFC", fg: MUTED,   bd: BD,       label: "ACTIVE"  },
  };
  const c = map[settlement];
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: "999px", padding: "4px 10px", fontSize: "10px", fontWeight: 800, color: c.fg, letterSpacing: "0.8px", whiteSpace: "nowrap", flexShrink: 0 }}>
      {c.label}
    </span>
  );
}

function MoneyLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="earn-money-row" style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
      <span style={{ fontSize: "13px", color: MUTED }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: highlight ? 700 : 500, color: highlight ? TEAL_FG : NAVY }}>
        {value}
      </span>
    </div>
  );
}

function btnStyle(variant: "blue"): React.CSSProperties {
  return {
    width: "100%", background: BLUE, border: "none", borderRadius: "10px",
    padding: "12px", fontSize: "14px", fontWeight: 600, color: "#FFFFFF",
    cursor: "pointer", fontFamily: "inherit",
  };
}

/* ── Empty & skeleton ────────────────────────────────────────────── */
function EmptyCard() {
  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${BD}`, borderRadius: "16px", padding: "48px 32px", textAlign: "center", boxShadow: CARD_SHADOW }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#F8FAFC", display: "inline-flex", alignItems: "center", justifyContent: "center", color: SUBTLE, marginBottom: "14px" }}>
        <Briefcase size={24} strokeWidth={1.7} />
      </div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: NAVY, marginBottom: "8px" }}>No earnings yet</div>
      <div style={{ fontSize: "13px", color: MUTED, lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" }}>
        Once you dispatch loads, they'll appear here for you to settle with the cargo owner and the truck owner.
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ background: "#FFFFFF", border: `1px solid ${BD}`, borderRadius: "16px", padding: "20px", marginBottom: "12px" }}>
          <div style={{ width: "60%", height: "16px", background: SKEL, borderRadius: "6px", marginBottom: "10px" }} />
          <div style={{ width: "40%", height: "13px", background: SKEL, borderRadius: "6px", marginBottom: "18px" }} />
          <div style={{ width: "100%", height: "40px", background: SKEL, borderRadius: "10px" }} />
        </div>
      ))}
    </>
  );
}

/* ── Modals ──────────────────────────────────────────────────────── */

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  // Close on backdrop click
  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      style={{ position: "fixed", inset: 0, background: "rgba(10,31,68,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div style={{ background: "#FFFFFF", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "440px", boxShadow: "0 24px 64px rgba(10,31,68,0.18)" }}>
        {children}
      </div>
    </div>
  );
}

function ModalError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{ background: DANGER_BG, border: `1px solid ${DANGER_BD}`, borderRadius: "10px", padding: "12px 14px", marginBottom: "18px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span style={{ fontSize: "13px", color: DANGER, lineHeight: 1.5 }}>{msg}</span>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700, color: SUBTLE,
  letterSpacing: "0.9px", textTransform: "uppercase", marginBottom: "8px",
};
const fieldHint: React.CSSProperties = {
  fontSize: "11px", color: MUTED, marginTop: "6px", lineHeight: 1.5,
};

function fieldInputStyle(focused: boolean): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", background: "#F8FAFC",
    border: `1.5px solid ${focused ? BLUE : BD}`, borderRadius: "10px",
    padding: "12px 14px", fontSize: "17px", color: NAVY, fontFamily: "inherit",
    fontWeight: 500, outline: "none",
    boxShadow: focused ? "0 0 0 3px rgba(61,123,255,0.12)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
}

function CollectModal({
  booking, onClose, onSaved,
}: { booking: any; onClose: () => void; onSaved: (patch: Partial<Booking>) => void }) {
  const [cut, setCut]       = useState("");
  const [payout, setPayout] = useState("");
  const [focusCut, setFocusCut]       = useState(false);
  const [focusPayout, setFocusPayout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const currency = booking.currency || "ETB";

  const submit = async () => {
    setError("");
    const cutN = parseFloat(cut);
    if (!cut.trim() || !Number.isFinite(cutN) || cutN < 0) {
      setError("Enter your cut as a positive number."); return;
    }
    let payoutN: number | undefined;
    if (payout.trim()) {
      payoutN = parseFloat(payout);
      if (!Number.isFinite(payoutN) || payoutN < 0) {
        setError("Owner payout must be a positive number."); return;
      }
    }
    setLoading(true);
    try {
      const res = await api.patch(`/bookings/${booking.id}/record-collection`, {
        brokerCutAmount: cutN,
        ...(payoutN !== undefined && { ownerPayoutAmount: payoutN }),
      });
      const updated = res.data?.booking;
      onSaved(updated ?? {
        brokerCutAmount: cutN,
        ...(payoutN !== undefined && { ownerPayoutAmount: payoutN }),
        brokerCollectedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(formatApiError(e, "Could not record collection."));
    } finally { setLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h2 style={{ fontSize: "18px", fontWeight: 800, color: NAVY, margin: "0 0 4px" }}>Record collection</h2>
      <p style={{ fontSize: "13px", color: MUTED, margin: "0 0 20px", lineHeight: 1.5 }}>
        {booking.load?.title} · {formatPrice(booking.agreedPrice, currency)}
      </p>

      <ModalError msg={error} />

      <label style={fieldLabel}>YOUR CUT <span style={{ color: DANGER }}>*</span></label>
      <input
        type="number"
        value={cut}
        onChange={(e) => setCut(e.target.value)}
        placeholder="e.g. 5000"
        min="0"
        autoFocus
        onFocus={() => setFocusCut(true)}
        onBlur={() => setFocusCut(false)}
        style={fieldInputStyle(focusCut)}
      />
      <div style={{ ...fieldHint, marginBottom: "18px" }}>The amount you keep from the cargo owner.</div>

      <label style={fieldLabel}>OWNER PAYOUT <span style={{ color: SUBTLE, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
      <input
        type="number"
        value={payout}
        onChange={(e) => setPayout(e.target.value)}
        placeholder="What you owe the truck owner"
        min="0"
        onFocus={() => setFocusPayout(true)}
        onBlur={() => setFocusPayout(false)}
        style={fieldInputStyle(focusPayout)}
      />
      <p style={{ ...fieldHint, marginBottom: "24px" }}>You can leave this blank now and set it when you pay the owner.</p>

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onClose} disabled={loading} style={{ flex: 1, background: "#F8FAFC", border: `1px solid ${BD}`, borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 600, color: NAVY, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={submit} disabled={loading} style={{ flex: 1.6, background: loading ? BD : BLUE, border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 700, color: loading ? SUBTLE : "#FFFFFF", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s", fontFamily: "inherit" }}>
          {loading ? "Recording…" : "Record"}
        </button>
      </div>
    </ModalOverlay>
  );
}

function PayoutModal({
  booking, onClose, onSaved,
}: { booking: any; onClose: () => void; onSaved: (patch: Partial<Booking>) => void }) {
  const [payout, setPayout] = useState(booking.ownerPayoutAmount != null ? String(booking.ownerPayoutAmount) : "");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const ownerName = booking.owner?.fullName || "the truck owner";
  const currency  = booking.currency || "ETB";

  const submit = async () => {
    setError("");
    let payoutN: number | undefined;
    if (payout.trim()) {
      payoutN = parseFloat(payout);
      if (!Number.isFinite(payoutN) || payoutN < 0) {
        setError("Payout amount must be a positive number."); return;
      }
    }
    setLoading(true);
    try {
      const res = await api.patch(`/bookings/${booking.id}/record-payout`, {
        ...(payoutN !== undefined && { ownerPayoutAmount: payoutN }),
      });
      const updated = res.data?.booking;
      onSaved(updated ?? {
        ...(payoutN !== undefined && { ownerPayoutAmount: payoutN }),
        ownerPaidOutAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(formatApiError(e, "Could not record payout."));
    } finally { setLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h2 style={{ fontSize: "18px", fontWeight: 800, color: NAVY, margin: "0 0 4px" }}>Mark owner paid</h2>
      <p style={{ fontSize: "13px", color: MUTED, margin: "0 0 20px", lineHeight: 1.5 }}>
        Paying <strong>{ownerName}</strong> for: {booking.load?.title}
      </p>

      <ModalError msg={error} />

      <label style={fieldLabel}>PAYOUT AMOUNT</label>
      <input
        type="number"
        value={payout}
        onChange={(e) => setPayout(e.target.value)}
        placeholder="e.g. 40000"
        min="0"
        autoFocus={booking.ownerPayoutAmount == null}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={fieldInputStyle(focused)}
      />
      <p style={{ ...fieldHint, marginBottom: "24px" }}>
        {booking.ownerPayoutAmount != null
          ? "Edit if needed, then tap 'Mark paid'."
          : `Enter what you're paying ${ownerName}.`}
      </p>

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onClose} disabled={loading} style={{ flex: 1, background: "#F8FAFC", border: `1px solid ${BD}`, borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 600, color: NAVY, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={submit} disabled={loading} style={{ flex: 1.6, background: loading ? BD : BLUE, border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 700, color: loading ? SUBTLE : "#FFFFFF", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s", fontFamily: "inherit" }}>
          {loading ? "Saving…" : "Mark paid"}
        </button>
      </div>
    </ModalOverlay>
  );
}
