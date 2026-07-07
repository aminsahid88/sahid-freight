"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import {
  Navigation, Package, User, MapPin, Truck, CheckCircle,
  Phone, ChevronRight, AlertCircle, Star,
} from "lucide-react";

type Tab = "home" | "profile";

// ─────────────────────────────────────────
// SLIDE-TO-CONFIRM BUTTON
// ─────────────────────────────────────────
function SlideButton({
  label,
  color,
  onConfirm,
  disabled = false,
}: {
  label: string;
  color: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [loading, setLoading] = useState(false);

  const THUMB = 52;
  const PAD = 4;

  const maxDrag = () =>
    trackRef.current ? trackRef.current.clientWidth - THUMB - PAD * 2 : 240;

  const onPtrDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || done || loading) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setSnapping(false);
  };

  const onPtrMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled || done || loading) return;
    const rect = trackRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - THUMB / 2, maxDrag()));
    setDragX(x);
  };

  const onPtrUp = async () => {
    if (!dragging) return;
    setDragging(false);
    const max = maxDrag();
    const progress = max > 0 ? dragX / max : 0;

    if (progress >= 0.8) {
      setDragX(max);
      setDone(true);
      setLoading(true);
      try {
        await onConfirm();
      } finally {
        setLoading(false);
      }
    } else {
      setSnapping(true);
      setDragX(0);
      setTimeout(() => setSnapping(false), 360);
    }
  };

  const progress = dragX / (maxDrag() || 1);
  const textOpacity = Math.max(0, 1 - progress * 1.6);

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        height: "60px",
        borderRadius: "14px",
        background: done ? color : "rgba(0,0,0,0.03)",
        border: `2px solid ${disabled ? "#ccc" : color}`,
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Progress fill */}
      {!done && (
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${PAD + THUMB + dragX}px`,
            background: color,
            opacity: 0.08 + progress * 0.22,
            borderRadius: "12px",
            transition: snapping
              ? "width 0.36s cubic-bezier(.4,0,.2,1), opacity 0.36s ease"
              : "none",
          }}
        />
      )}

      {/* Center label — fades as you drag */}
      {!done && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            opacity: textOpacity,
            transition: dragging ? "none" : "opacity 0.2s ease",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: "700", color, letterSpacing: "0.1px" }}>
            {label}
          </span>
        </div>
      )}

      {/* Completed label */}
      {done && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#fff", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            {loading ? "Processing…" : (<><CheckCircle size={16} /> Confirmed</>)}
          </span>
        </div>
      )}

      {/* Thumb */}
      {!done && (
        <div
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrUp}
          onPointerCancel={onPtrUp}
          style={{
            position: "absolute",
            left: `${PAD + dragX}px`,
            top: `${PAD}px`,
            width: `${THUMB}px`,
            height: `${THUMB}px`,
            borderRadius: "10px",
            background: disabled ? "#ccc" : color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: disabled ? "not-allowed" : dragging ? "grabbing" : "grab",
            zIndex: 2,
            boxShadow: dragging
              ? `0 6px 24px ${color}55`
              : `0 2px 10px ${color}40`,
            transition: snapping
              ? "left 0.36s cubic-bezier(.4,0,.2,1)"
              : dragging
              ? "none"
              : "box-shadow 0.2s ease",
          }}
        >
          <ChevronRight size={22} color="#fff" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// DRIVER DASHBOARD
// ─────────────────────────────────────────
export default function DriverDashboard() {
  const router = useRouter();
  const { user, logout, setAuth } = useAuthStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [justDeliveredId, setJustDeliveredId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "DRIVER") { router.push("/dashboard"); return; }
    setFullName(user.fullName || "");
    setCity((user as any).city || "");
    fetchBookings();
    const bookingInterval = setInterval(fetchBookings, 8000);
    return () => clearInterval(bookingInterval);
  }, [user]);

  // GPS push every 10s when there's an active IN_TRANSIT booking
  useEffect(() => {
    const activeId = bookings.find(
      b => b.status === "ACCEPTED" && b.load?.status === "IN_TRANSIT"
    )?.id;
    if (!activeId || !navigator.geolocation) return;

    const pushLocation = () => {
      navigator.geolocation.getCurrentPosition(pos => {
        api.patch(`/bookings/${activeId}/location`, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }).catch(() => {});
      });
    };

    pushLocation();
    const gpsInterval = setInterval(pushLocation, 10000);
    return () => clearInterval(gpsInterval);
  }, [bookings]);

  const fetchBookings = async () => {
    try {
      const res = await api.get("/bookings/driver/my");
      setBookings(res.data.bookings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const saveProfile = async () => {
    setSaving(true); setProfileMsg("");
    try {
      await api.patch("/users/me", { fullName, city });
      const token = localStorage.getItem("accessToken")!;
      const refresh = localStorage.getItem("refreshToken")!;
      setAuth({ ...user!, fullName, city } as any, token, refresh);
      showToast("Profile saved");
    } catch (err: any) {
      setProfileMsg(formatApiError(err, "Couldn't save your profile. Please try again.", "profile"));
    }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { setPwError("New passwords don't match."); return; }
    if (newPassword.length < 8) { setPwError("Use at least 8 characters."); return; }
    setChangingPw(true); setPwError(""); setPwMsg("");
    try {
      await api.patch("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showToast("Password updated");
    } catch (err: any) {
      setPwError(formatApiError(err, "Couldn't change your password. Please try again.", "auth"));
    }
    finally { setChangingPw(false); }
  };

  const startJourney = async (bookingId: string) => {
    // Optimistic: flip load status to IN_TRANSIT immediately
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, load: { ...b.load, status: "IN_TRANSIT" } } : b
    ));
    try {
      await api.patch(`/bookings/${bookingId}/start`);
      showToast("Trip started — drive safe.");
      // Immediately push first location — don't wait for the useEffect interval
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          api.patch(`/bookings/${bookingId}/location`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }).catch(() => {});
        });
      }
    } catch (err: any) {
      showToast(formatApiError(err, "Couldn't start the trip. Please try again.", "booking"));
    }
    fetchBookings();
  };

  const completeDelivery = async (bookingId: string) => {
    // Optimistic: flip booking to COMPLETED immediately
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, status: "COMPLETED" } : b
    ));
    setJustDeliveredId(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/deliver`);
      showToast("Marked delivered — great work.");
    } catch (err: any) {
      setJustDeliveredId(null);
      showToast(formatApiError(err, "Couldn't mark this delivered. Please try again.", "booking"));
    }
    fetchBookings();
  };

  const activeBooking  = bookings.find(b => b.status === "ACCEPTED" && b.load?.status === "IN_TRANSIT");
  const pendingBooking = bookings.find(b => b.status === "ACCEPTED" && b.load?.status !== "IN_TRANSIT");
  const completedCount = bookings.filter(b => b.status === "COMPLETED").length;

  const inp = {
    width: "100%", padding: "10px 14px", borderRadius: "9px",
    border: "1px solid var(--border)", fontSize: "13px", color: "var(--primary)",
    outline: "none", background: "var(--bg)", boxSizing: "border-box" as const,
  } as const;
  const inpClass = "driver-input";

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0A1F44", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", border: "3px solid rgba(255,255,255,0.2)", borderTop: "3px solid #3D7BFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter, system-ui, sans-serif", paddingBottom: "72px" }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
        @media (max-width: 640px) {
          .driver-top { padding: 0 14px !important; }
          .driver-top-brand-text { display: none; }
          .driver-top-avatar { width: 38px !important; height: 38px !important; min-width: 38px; }
          .driver-toast { top: 12px !important; right: 12px !important; left: 12px !important; font-size: 12px !important; padding: 10px 14px !important; }
          .driver-content { padding: 16px 14px !important; }
          .driver-h1 { font-size: 18px !important; }
          .driver-stats { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .driver-stats > div { padding: 14px !important; }
          .driver-active-card, .driver-pending-card { padding: 16px !important; border-radius: 12px !important; }
          .driver-pending-facts { grid-template-columns: 1fr 1fr 1fr !important; gap: 6px !important; }
          .driver-pending-facts > div { padding: 8px !important; }
          .driver-tracking-link { min-height: 44px !important; }
          .driver-profile-card { padding: 16px !important; }
          .driver-profile-header { flex-direction: column !important; text-align: center !important; align-items: center !important; gap: 12px !important; }
          .driver-input { min-height: 44px; font-size: 16px !important; }
          .driver-save-btn, .driver-signout-btn { min-height: 44px !important; }
        }
        @media (max-width: 380px) {
          .driver-stats { grid-template-columns: 1fr !important; }
          .driver-pending-facts { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {toast && (
        <div className="driver-toast" style={{ position: "fixed", top: "16px", right: "16px", background: "var(--primary)", color: "#FFFFFF", padding: "12px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, animation: "fadeIn 0.2s ease" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="driver-top" style={{ background: "#0A1F44", padding: "0 20px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
          <span className="driver-top-brand-text" style={{ fontSize: "15px", fontWeight: "900", color: "#fff" }}>Sahid Freight</span>
          <span style={{ background: "#3D7BFF", color: "#fff", fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "5px" }}>DRIVER</span>
        </div>
        <div className="driver-top-avatar" style={{ width: "34px", height: "34px", borderRadius: "9px", background: "#3D7BFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#fff" }}>
          {user?.fullName?.charAt(0)}
        </div>
      </div>

      <div className="driver-content" style={{ padding: "20px 16px", maxWidth: "600px", margin: "0 auto" }}>

        {/* ── HOME TAB ── */}
        {tab === "home" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h1 className="driver-h1" style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary)", margin: "0 0 2px" }}>
                Your trips
              </h1>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                {activeBooking
                  ? "You're on the road right now."
                  : pendingBooking
                  ? "You've been dispatched to a new load."
                  : "Every load you're moving right now."}
              </p>
            </div>

            {/* Stats */}
            <div className="driver-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Completed</div>
                <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--primary)" }}>{completedCount}</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>deliveries</div>
              </div>
              <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Status</div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: activeBooking ? "#16a34a" : pendingBooking ? "#F59E0B" : "#6b7280" }}>
                  {activeBooking ? "On the road" : pendingBooking ? "Dispatched" : "Available"}
                </div>
              </div>
            </div>

            {/* ── JUST-DELIVERED SUCCESS SCREEN ── */}
            {justDeliveredId && !activeBooking && !pendingBooking && (
              <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "32px 24px", marginBottom: "16px", border: "1px solid #bbf7d0", textAlign: "center", animation: "popIn 0.35s cubic-bezier(.34,1.56,.64,1)" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "2px solid #bbf7d0" }}>
                  <CheckCircle size={30} color="#16a34a" />
                </div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary)", marginBottom: "6px" }}>Delivered!</div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>Great work. The cargo owner has been notified.</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={20} fill="#F59E0B" color="#F59E0B" />)}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>Excellent trip</div>
                <button
                  onClick={() => setJustDeliveredId(null)}
                  style={{ marginTop: "20px", padding: "10px 28px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--primary)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  Back to home
                </button>
              </div>
            )}

            {/* ── ACTIVE JOURNEY ── */}
            {activeBooking && (
              <div className="driver-active-card" style={{ background: "#0A1F44", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#5BE3C4", animation: "pulse 1.5s infinite" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#5BE3C4", letterSpacing: "0.8px" }}>ON THE ROAD</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#FFFFFF", marginBottom: "6px" }}>{activeBooking.load?.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "16px" }}>
                  <MapPin size={12} />{activeBooking.load?.pickupCity} → {activeBooking.load?.deliveryCity}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Truck</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#FFFFFF", fontFamily: "monospace" }}>{activeBooking.truck?.plateNumber}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Type</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#FFFFFF" }}>{activeBooking.truck?.truckType?.replace(/_/g, " ")}</div>
                  </div>
                </div>

                {/* Continue journey tracking link */}
                <a
                  href={"/tracking/" + activeBooking.id}
                  className="driver-tracking-link"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px", borderRadius: "10px", background: "#3D7BFF", color: "#fff", fontSize: "14px", fontWeight: "700", textDecoration: "none", marginBottom: "12px" }}
                >
                  <Navigation size={16} /> View live tracking
                </a>

                {/* Slide to mark delivered */}
                <SlideButton
                  label="Slide to mark delivered"
                  color="#16a34a"
                  onConfirm={() => completeDelivery(activeBooking.id)}
                />
              </div>
            )}

            {/* ── PENDING ASSIGNMENT ── */}
            {pendingBooking && !activeBooking && (
              <div className="driver-pending-card" style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", marginBottom: "16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#F59E0B", marginBottom: "10px", letterSpacing: "0.8px" }}>NEW DISPATCH</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", marginBottom: "6px" }}>{pendingBooking.load?.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#6b7280", marginBottom: "14px" }}>
                  <MapPin size={12} />{pendingBooking.load?.pickupCity} → {pendingBooking.load?.deliveryCity}
                </div>
                <div className="driver-pending-facts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Truck</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)", fontFamily: "monospace" }}>{pendingBooking.truck?.plateNumber}</div>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Weight</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)" }}>{pendingBooking.load?.weightTons}t</div>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Rate</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)" }}>{formatPrice(pendingBooking.agreedPrice, pendingBooking.currency || "ETB")}</div>
                  </div>
                </div>

                {/* Slide to start trip */}
                <SlideButton
                  label="Slide to start trip"
                  color="#3D7BFF"
                  onConfirm={() => startJourney(pendingBooking.id)}
                />
              </div>
            )}

            {/* No assignments */}
            {!activeBooking && !pendingBooking && !justDeliveredId && (
              <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "48px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#94A3B8" }}>
                  <Truck size={24} />
                </div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--primary)", marginBottom: "6px" }}>No active trips</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>When you're dispatched to a load, it'll show up here.</div>
              </div>
            )}

            {/* Past deliveries */}
            {bookings.filter(b => b.status === "COMPLETED").length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Completed trips</div>
                {bookings.filter(b => b.status === "COMPLETED").map((b: any) => (
                  <div key={b.id} style={{ background: "var(--surface)", borderRadius: "10px", padding: "14px 16px", marginBottom: "8px", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary)" }}>{b.load?.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{b.load?.pickupCity} → {b.load?.deliveryCity}</div>
                    </div>
                    <CheckCircle size={16} color="#16a34a" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === "profile" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary)", margin: 0 }}>Profile</h1>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "3px 0 0" }}>Your account and password.</p>
            </div>

            <div className="driver-profile-card driver-profile-header" style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "800", color: "#FFFFFF", flexShrink: 0 }}>
                {user?.fullName?.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary)" }}>{user?.fullName}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Phone size={11} />{user?.phone}
                </div>
                <div style={{ marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "99px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                    {completedCount} trip{completedCount === 1 ? "" : "s"} completed
                  </span>
                </div>
              </div>
            </div>

            <div className="driver-profile-card" style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border)", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary)", marginBottom: "14px" }}>Personal info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Full name</label>
                  <input className={inpClass} style={inp} value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Phone</label>
                  <input className={inpClass} style={{ ...inp, background: "#F1F5F9", color: "var(--text-secondary)" }} value={user?.phone} disabled />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>City</label>
                  <input className={inpClass} style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="Your home city" />
                </div>
              </div>
              {profileMsg && <div style={{ fontSize: "12px", color: "#dc2626", marginTop: "10px" }}>{profileMsg}</div>}
              <button onClick={saveProfile} disabled={saving} className="driver-save-btn" style={{ marginTop: "14px", width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: saving ? "var(--border)" : "var(--primary)", color: saving ? "#aaa" : "#FFFFFF", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            <div className="driver-profile-card" style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border)", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary)", marginBottom: "14px" }}>Change password</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Current password", val: currentPassword, set: setCurrentPassword },
                  { label: "New password",     val: newPassword,      set: setNewPassword      },
                  { label: "Confirm password", val: confirmPassword,  set: setConfirmPassword  },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
                    <input type="password" className={inpClass} style={inp} value={val} onChange={e => set(e.target.value)} placeholder="••••••••" />
                  </div>
                ))}
              </div>
              {pwError && <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#dc2626", marginTop: "10px" }}><AlertCircle size={13} />{pwError}</div>}
              <button onClick={changePassword} disabled={changingPw} className="driver-save-btn" style={{ marginTop: "14px", width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: changingPw ? "var(--border)" : "var(--primary)", color: changingPw ? "#aaa" : "#FFFFFF", fontSize: "13px", fontWeight: "700", cursor: changingPw ? "not-allowed" : "pointer" }}>
                {changingPw ? "Updating…" : "Update password"}
              </button>
            </div>

            <div className="driver-profile-card" style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#dc2626", marginBottom: "6px" }}>Sign out</div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px" }}>Sign out of your driver account.</p>
              <button onClick={() => { logout(); router.push("/auth/login"); }} className="driver-signout-btn" style={{ width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "64px", background: "#0A1F44", display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 100 }}>
        <button onClick={() => setTab("home")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 20px", color: tab === "home" ? "#3D7BFF" : "rgba(255,255,255,0.4)" }}>
          <Package size={20} />
          <span style={{ fontSize: "10px", fontWeight: tab === "home" ? "700" : "400" }}>Home</span>
        </button>
        <button onClick={() => setTab("profile")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 20px", color: tab === "profile" ? "#3D7BFF" : "rgba(255,255,255,0.4)" }}>
          <User size={20} />
          <span style={{ fontSize: "10px", fontWeight: tab === "profile" ? "700" : "400" }}>Profile</span>
        </button>
      </nav>
    </div>
  );
}
