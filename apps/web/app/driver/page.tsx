"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
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
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
            {loading ? "Processing…" : "✓ Confirmed!"}
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
      showToast("Profile updated");
    } catch { setProfileMsg("Failed to update profile"); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setPwError("Minimum 8 characters"); return; }
    setChangingPw(true); setPwError(""); setPwMsg("");
    try {
      await api.patch("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      showToast("Password changed");
    } catch (err: any) { setPwError(err.response?.data?.message || "Failed"); }
    finally { setChangingPw(false); }
  };

  const startJourney = async (bookingId: string) => {
    // Optimistic: flip load status to IN_TRANSIT immediately
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, load: { ...b.load, status: "IN_TRANSIT" } } : b
    ));
    try {
      await api.patch(`/bookings/${bookingId}/start`);
      showToast("Journey started! 🚛");
      // Immediately push first location — don't wait for the useEffect interval
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          api.patch(`/bookings/${bookingId}/location`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }).catch(() => {});
        });
      }
    } catch { /* revert on error */ }
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
      showToast("Delivery completed! 🎉");
    } catch {
      setJustDeliveredId(null);
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
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1B3A2D", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", border: "3px solid rgba(240,235,224,0.2)", borderTop: "3px solid #E8A020", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
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
      `}</style>

      {toast && (
        <div style={{ position: "fixed", top: "16px", right: "16px", background: "var(--primary)", color: "#FAFAF8", padding: "12px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", zIndex: 9999, animation: "fadeIn 0.2s ease" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#1B3A2D", padding: "0 20px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.svg" alt="Sahid Freight" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
          <span style={{ fontSize: "15px", fontWeight: "900", color: "#fff" }}>Sahid Freight</span>
          <span style={{ background: "#E8A020", color: "#fff", fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "5px" }}>DRIVER</span>
        </div>
        <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "#E8A020", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#fff" }}>
          {user?.fullName?.charAt(0)}
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: "600px", margin: "0 auto" }}>

        {/* ── HOME TAB ── */}
        {tab === "home" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary)", margin: "0 0 2px" }}>
                Hello, {user?.fullName?.split(" ")[0]}
              </h1>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                {activeBooking
                  ? "You have an active journey"
                  : pendingBooking
                  ? "You have a new assignment"
                  : "No active assignments"}
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Completed</div>
                <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--primary)" }}>{completedCount}</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>deliveries</div>
              </div>
              <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Status</div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: activeBooking ? "#16a34a" : pendingBooking ? "#E8A020" : "#6b7280" }}>
                  {activeBooking ? "On Trip" : pendingBooking ? "Assigned" : "Available"}
                </div>
              </div>
            </div>

            {/* ── JUST-DELIVERED SUCCESS SCREEN ── */}
            {justDeliveredId && !activeBooking && !pendingBooking && (
              <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "32px 24px", marginBottom: "16px", border: "1px solid #bbf7d0", textAlign: "center", animation: "popIn 0.35s cubic-bezier(.34,1.56,.64,1)" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "2px solid #bbf7d0" }}>
                  <CheckCircle size={30} color="#16a34a" />
                </div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary)", marginBottom: "6px" }}>Delivery Complete!</div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>Great work. The cargo has been delivered successfully.</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={20} fill="#E8A020" color="#E8A020" />)}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>Excellent delivery</div>
                <button
                  onClick={() => setJustDeliveredId(null)}
                  style={{ marginTop: "20px", padding: "10px 28px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--primary)", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  Back to Home
                </button>
              </div>
            )}

            {/* ── ACTIVE JOURNEY ── */}
            {activeBooking && (
              <div style={{ background: "#1B3A2D", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#4ade80", letterSpacing: "0.8px" }}>ACTIVE JOURNEY</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#FAFAF8", marginBottom: "6px" }}>{activeBooking.load?.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(240,235,224,0.5)", marginBottom: "16px" }}>
                  <MapPin size={12} />{activeBooking.load?.pickupCity} → {activeBooking.load?.deliveryCity}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  <div style={{ background: "rgba(240,235,224,0.06)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(240,235,224,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Truck</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#FAFAF8", fontFamily: "monospace" }}>{activeBooking.truck?.plateNumber}</div>
                  </div>
                  <div style={{ background: "rgba(240,235,224,0.06)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "rgba(240,235,224,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Type</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#FAFAF8" }}>{activeBooking.truck?.truckType?.replace(/_/g, " ")}</div>
                  </div>
                </div>

                {/* Continue journey tracking link */}
                <a
                  href={"/tracking/" + activeBooking.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px", borderRadius: "10px", background: "#E8A020", color: "#fff", fontSize: "14px", fontWeight: "700", textDecoration: "none", marginBottom: "12px" }}
                >
                  <Navigation size={16} /> View Live Tracking
                </a>

                {/* Slide to complete delivery */}
                <SlideButton
                  label="Slide to complete delivery →"
                  color="#16a34a"
                  onConfirm={() => completeDelivery(activeBooking.id)}
                />
              </div>
            )}

            {/* ── PENDING ASSIGNMENT ── */}
            {pendingBooking && !activeBooking && (
              <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", marginBottom: "16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#E8A020", marginBottom: "10px", letterSpacing: "0.8px" }}>NEW ASSIGNMENT</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--primary)", marginBottom: "6px" }}>{pendingBooking.load?.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#6b7280", marginBottom: "14px" }}>
                  <MapPin size={12} />{pendingBooking.load?.pickupCity} → {pendingBooking.load?.deliveryCity}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Truck</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)", fontFamily: "monospace" }}>{pendingBooking.truck?.plateNumber}</div>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Weight</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)" }}>{pendingBooking.load?.weightTons}t</div>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>Price</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)" }}>${pendingBooking.agreedPrice}</div>
                  </div>
                </div>

                {/* Slide to start journey */}
                <SlideButton
                  label="Slide to start journey →"
                  color="#E8A020"
                  onConfirm={() => startJourney(pendingBooking.id)}
                />
              </div>
            )}

            {/* No assignments */}
            {!activeBooking && !pendingBooking && !justDeliveredId && (
              <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "48px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#c8c0b0" }}>
                  <Truck size={24} />
                </div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--primary)", marginBottom: "6px" }}>No assignments yet</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Your fleet owner will assign you to a booking soon.</div>
              </div>
            )}

            {/* Past deliveries */}
            {bookings.filter(b => b.status === "COMPLETED").length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Past Deliveries</div>
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
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "3px 0 0" }}>Manage your account</p>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "800", color: "#FAFAF8", flexShrink: 0 }}>
                {user?.fullName?.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary)" }}>{user?.fullName}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Phone size={11} />{user?.phone}
                </div>
                <div style={{ marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "99px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                    {completedCount} deliveries completed
                  </span>
                </div>
              </div>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border)", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary)", marginBottom: "14px" }}>Personal Information</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Full Name</label>
                  <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Phone</label>
                  <input style={{ ...inp, background: "#f0ede6", color: "var(--text-secondary)" }} value={user?.phone} disabled />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>City</label>
                  <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" />
                </div>
              </div>
              {profileMsg && <div style={{ fontSize: "12px", color: "#dc2626", marginTop: "10px" }}>{profileMsg}</div>}
              <button onClick={saveProfile} disabled={saving} style={{ marginTop: "14px", width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: saving ? "var(--border)" : "var(--primary)", color: saving ? "#aaa" : "#FAFAF8", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border)", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary)", marginBottom: "14px" }}>Change Password</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Current Password", val: currentPassword, set: setCurrentPassword },
                  { label: "New Password",      val: newPassword,      set: setNewPassword      },
                  { label: "Confirm Password",  val: confirmPassword,  set: setConfirmPassword  },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
                    <input type="password" style={inp} value={val} onChange={e => set(e.target.value)} placeholder="••••••••" />
                  </div>
                ))}
              </div>
              {pwError && <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#dc2626", marginTop: "10px" }}><AlertCircle size={13} />{pwError}</div>}
              <button onClick={changePassword} disabled={changingPw} style={{ marginTop: "14px", width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: changingPw ? "var(--border)" : "var(--primary)", color: changingPw ? "#aaa" : "#FAFAF8", fontSize: "13px", fontWeight: "700", cursor: changingPw ? "not-allowed" : "pointer" }}>
                {changingPw ? "Updating…" : "Update Password"}
              </button>
            </div>

            <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#dc2626", marginBottom: "6px" }}>Sign Out</div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px" }}>Sign out of your driver account.</p>
              <button onClick={() => { logout(); router.push("/auth/login"); }} style={{ width: "100%", padding: "11px", borderRadius: "9px", border: "none", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "64px", background: "#1B3A2D", display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(240,235,224,0.1)", zIndex: 100 }}>
        <button onClick={() => setTab("home")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 20px", color: tab === "home" ? "#E8A020" : "rgba(240,235,224,0.4)" }}>
          <Package size={20} />
          <span style={{ fontSize: "10px", fontWeight: tab === "home" ? "700" : "400" }}>Home</span>
        </button>
        <button onClick={() => setTab("profile")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", padding: "6px 20px", color: tab === "profile" ? "#E8A020" : "rgba(240,235,224,0.4)" }}>
          <User size={20} />
          <span style={{ fontSize: "10px", fontWeight: tab === "profile" ? "700" : "400" }}>Profile</span>
        </button>
      </nav>
    </div>
  );
}
