"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import type { Load, Booking, Truck } from "@/lib/types";
import { CheckCircle2, Truck as TruckIcon } from "lucide-react";

// Web reuses CSS variables from globals.css for the broker surface — same
// palette as the mobile broker app (navy/blue + light/airy cards).
const P      = "var(--primary)";
const A      = "var(--accent)";
const NAVY   = "var(--navy, #0A1F44)";
const BORDER = "var(--border, #E2E8F0)";

// Inline accent colors that don't have CSS vars yet. Hardcoded so they
// match the mobile palette exactly regardless of theme.
const TEAL_BG  = "#ECFDF5";
const TEAL_FG  = "#047857";
const TEAL_BD  = "#A7F3D0";
const AMBER_BG = "#FFF7ED";
const AMBER_FG = "#C2791A";
const AMBER_BD = "#FED7AA";
const MUTED    = "#64748B";
const SUBTLE   = "#94A3B8";
const SKEL     = "#F1F5F9";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayHeaderDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function isUrgent(scheduledDate?: string | Date | null): boolean {
  if (!scheduledDate) return false;
  const d = new Date(scheduledDate);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return d.getTime() <= end.getTime();
}

export default function BrokerDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const firstName = (user?.fullName || "Broker").split(" ")[0];

  const [openLoads, setOpenLoads] = useState<Load[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trucksAvailable, setTrucksAvailable] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [loadsRes, bookingsRes, trucksRes] = await Promise.all([
        api.get("/loads").catch(() => ({ data: { loads: [] } })),
        api.get("/bookings/broker/my").catch(() => ({ data: { bookings: [] } })),
        api.get("/trucks?available=true").catch(() => ({ data: { trucks: [] } })),
      ]);
      // /loads is server-side filtered to status === "OPEN" already, but guard anyway.
      const allLoads = (loadsRes.data?.loads || []) as Load[];
      setOpenLoads(allLoads.filter((l) => l.status === "OPEN"));
      setBookings((bookingsRes.data?.bookings || []) as Booking[]);
      setTrucksAvailable(((trucksRes.data?.trucks || []) as Truck[]).length);
    } catch {
      // each fetch has its own catch — nothing to do here
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const inTransit = useMemo(
    () => bookings.filter((b) => b.status === "IN_TRANSIT"),
    [bookings],
  );

  const summary =
    openLoads.length === 0 && inTransit.length === 0
      ? "Nothing waiting on you right now — a quiet, clean board."
      : `${openLoads.length} load${openLoads.length === 1 ? "" : "s"} waiting on a truck · ${inTransit.length} on the road`;

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  return (
    <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
      {/* ── HERO (the one navy element) ─────────────────────────────── */}
      <section style={styles.hero}>
        <div style={styles.heroEyebrow}>{todayHeaderDate().toUpperCase()}</div>
        <div style={styles.heroRow}>
          <h1 style={styles.heroTitle}>{greeting()}, {firstName}.</h1>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{ ...styles.refreshBtn, opacity: refreshing ? 0.6 : 1 }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div style={styles.heroSummary}>{summary}</div>
      </section>

      {/* ── STATS ROW ───────────────────────────────────────────────── */}
      <section style={styles.statRow}>
        <Stat label="OPEN LOADS"        value={loading ? null : String(openLoads.length)} hint="waiting for a truck" tone="navy" />
        <Stat label="TRUCKS AVAILABLE"  value={loading ? null : String(trucksAvailable)}  hint="across the network"  tone="navy" />
        <Stat label="ON THE ROAD"       value={loading ? null : String(inTransit.length)} hint="active dispatches"   tone={inTransit.length > 0 ? "teal" : "navy"} />
      </section>

      {/* ── TWO-COLUMN LAYOUT (auto-stacks on narrow) ───────────────── */}
      <section style={styles.twoCol}>

        {/* LEFT — Needs a truck */}
        <div style={styles.colSection}>
          <SectionHeader title="Needs a truck" count={openLoads.length} />
          {loading ? (
            <ListSkeleton rows={3} />
          ) : openLoads.length === 0 ? (
            <EmptyCard
              icon={<CheckCircle2 size={28} color={TEAL_FG} strokeWidth={2} />}
              title="All loads matched"
              body="Nothing waiting. When a cargo owner posts a load, or you post one for an offline owner, it appears here."
            />
          ) : (
            openLoads.map((load) => (
              <article key={load.id} style={styles.loadCard}>
                <div style={styles.loadHeader}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.loadTitle}>{load.title}</div>
                    <div style={styles.loadRoute}>{load.pickupCity} → {load.deliveryCity}</div>
                  </div>
                  {isUrgent(load.scheduledDate) && (
                    <span style={{ ...styles.pill, background: AMBER_BG, color: AMBER_FG, borderColor: AMBER_BD }}>
                      URGENT
                    </span>
                  )}
                </div>
                <div style={styles.metaRow}>
                  <MetaPill label={`${load.weightTons}t`} />
                  <MetaPill label={(load.truckTypeNeeded || "").replace(/_/g, " ") || "Any truck"} />
                  {load.scheduledDate && (
                    <MetaPill label={new Date(load.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                  )}
                </div>
                <div style={styles.loadFooter}>
                  <div style={styles.loadPrice}>{formatPrice(load.offeredPrice, load.currency || "ETB")}</div>
                  <button
                    onClick={() => router.push(`/dashboard/broker/find-truck/${load.id}`)}
                    style={styles.findBtn}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.94)")}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                  >
                    Find a truck →
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {/* RIGHT — In transit */}
        <div style={styles.colSection}>
          <SectionHeader title="In transit" count={inTransit.length} />
          {loading ? (
            <ListSkeleton rows={2} />
          ) : inTransit.length === 0 ? (
            <EmptyCard
              icon={<TruckIcon size={26} color={SUBTLE} strokeWidth={2} />}
              title="Nothing on the road"
              body="Dispatches you make will appear here while the truck is on the road."
            />
          ) : (
            inTransit.map((b) => {
              const driver = b.driver?.fullName || b.truck?.driver?.fullName || "Unassigned";
              return (
                <article key={b.id} style={styles.transitCard}>
                  <div style={styles.loadHeader}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.loadTitle}>{b.load?.title || "Load"}</div>
                      <div style={styles.loadRoute}>
                        {b.load?.pickupCity} → {b.load?.deliveryCity}
                      </div>
                    </div>
                    <span style={{ ...styles.pill, background: TEAL_BG, color: TEAL_FG, borderColor: TEAL_BD, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <span style={styles.liveDot} /> LIVE
                    </span>
                  </div>
                  <div style={styles.transitRow}>
                    <span style={styles.transitLabel}>Driver</span>
                    <span style={styles.transitValue}>{driver}</span>
                  </div>
                  <div style={styles.transitRow}>
                    <span style={styles.transitLabel}>Truck</span>
                    <span style={styles.transitValue}>{b.truck?.plateNumber || "—"}</span>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/tracking/${b.id}`)}
                    style={styles.trackBtn}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                  >
                    Track this trip →
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

/* ── inline sub-components ─────────────────────────────────────────── */

function Stat({ label, value, hint, tone }: { label: string; value: string | null; hint: string; tone: "navy" | "teal" }) {
  const color = tone === "teal" ? TEAL_FG : P;
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      {value === null
        ? <div style={{ width: "60px", height: "32px", background: SKEL, borderRadius: "6px", marginBottom: "4px" }} />
        : <div style={{ ...styles.statValue, color }}>{value}</div>}
      <div style={styles.statHint}>{hint}</div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={styles.sectionHeader}>
      <span style={styles.sectionTitle}>{title}</span>
      {count > 0 && <span style={styles.sectionCount}>{count}</span>}
    </div>
  );
}

function MetaPill({ label }: { label: string }) {
  return <span style={styles.metaPill}>{label}</span>;
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

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={styles.skelCard}>
          <div style={{ width: "60%", height: "16px", background: SKEL, borderRadius: "6px" }} />
          <div style={{ height: "8px" }} />
          <div style={{ width: "40%", height: "12px", background: SKEL, borderRadius: "6px" }} />
          <div style={{ height: "18px" }} />
          <div style={{ width: "100%", height: "36px", background: SKEL, borderRadius: "10px" }} />
        </div>
      ))}
    </>
  );
}

/* ── styles ────────────────────────────────────────────────────────── */

const cardShadow = "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.06)";

const styles: Record<string, React.CSSProperties> = {
  /* HERO */
  hero:         { background: NAVY, borderRadius: "18px", padding: "28px 32px", marginBottom: "24px", color: "#FFFFFF" },
  heroEyebrow:  { fontSize: "11px", fontWeight: 800, color: A, letterSpacing: "1.5px", marginBottom: "12px" },
  heroRow:      { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" },
  heroTitle:    { margin: 0, fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px" },
  heroSummary:  { marginTop: "10px", fontSize: "15px", color: "rgba(255,255,255,0.72)" },
  refreshBtn:   { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", color: "#FFFFFF", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },

  /* STATS ROW */
  statRow:      { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "28px" },
  statCard:     { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "20px", boxShadow: cardShadow },
  statLabel:    { fontSize: "11px", fontWeight: 800, color: SUBTLE, letterSpacing: "1.1px", marginBottom: "10px" },
  statValue:    { fontSize: "32px", fontWeight: 800, color: P, letterSpacing: "-0.5px", marginBottom: "4px" },
  statHint:     { fontSize: "13px", color: MUTED },

  /* TWO-COLUMN */
  twoCol:       { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" },
  colSection:   { minWidth: 0 },

  /* SECTION HEADER */
  sectionHeader:{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" },
  sectionTitle: { fontSize: "16px", fontWeight: 700, color: P, letterSpacing: "-0.2px" },
  sectionCount: { fontSize: "13px", fontWeight: 600, color: MUTED },

  /* LOAD CARD */
  loadCard:     { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "18px", marginBottom: "10px", boxShadow: cardShadow },
  loadHeader:   { display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px" },
  loadTitle:    { fontSize: "15px", fontWeight: 700, color: P, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  loadRoute:    { fontSize: "13px", color: MUTED },
  metaRow:      { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" },
  metaPill:     { background: "#F8FAFC", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 500, color: MUTED },
  loadFooter:   { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  loadPrice:    { fontSize: "17px", fontWeight: 800, color: P, letterSpacing: "-0.3px" },
  findBtn:      { background: A, color: "#FFFFFF", border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },

  /* TRANSIT CARD */
  transitCard:  { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "18px", marginBottom: "10px", boxShadow: cardShadow },
  transitRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${BORDER}` },
  transitLabel: { fontSize: "12px", color: SUBTLE, fontWeight: 600 },
  transitValue: { fontSize: "13px", color: P, fontWeight: 500 },
  trackBtn:     { marginTop: "12px", width: "100%", background: "#F8FAFC", color: P, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  liveDot:      { width: "6px", height: "6px", borderRadius: "3px", background: TEAL_FG, display: "inline-block" },

  /* PILL */
  pill:         { fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", border: "1px solid", letterSpacing: "1px", whiteSpace: "nowrap" },

  /* EMPTY + SKELETON */
  emptyCard:    { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "32px", textAlign: "center" },
  emptyIcon:    { display: "flex", justifyContent: "center", marginBottom: "12px" },
  emptyTitle:   { fontSize: "14px", fontWeight: 700, color: P, marginBottom: "6px" },
  emptyBody:    { fontSize: "13px", color: MUTED, lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" },
  skelCard:     { background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "18px", marginBottom: "10px" },
};
