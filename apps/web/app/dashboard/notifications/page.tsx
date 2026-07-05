"use client";
import { Package, Bell, CheckCircle2, XCircle, AlertTriangle, Banknote, Settings, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

const iconForType = (type: string) => {
  switch (type) {
    case "BOOKING_REQUEST":  return <Package size={18} />;
    case "BOOKING_ACCEPTED": return <CheckCircle2 size={18} />;
    case "BOOKING_REJECTED": return <XCircle size={18} />;
    case "LOAD_CANCELLED":   return <AlertTriangle size={18} />;
    case "PAYMENT":          return <Banknote size={18} />;
    case "SYSTEM":           return <Settings size={18} />;
    default:                 return <BellRing size={18} />;
  }
};

const colorForType = (type: string) => {
  switch (type) {
    case "BOOKING_ACCEPTED": return "#047857";
    case "BOOKING_REJECTED":
    case "LOAD_CANCELLED":   return "#DC2626";
    case "PAYMENT":          return "#C2791A";
    default:                 return "#0A1F44";
  }
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
    } catch (err) {
      setPageError(formatApiError(err, "We couldn't load your notifications.", "generic"));
    }
    finally { setLoading(false); }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      setPageError(formatApiError(err, "We couldn't mark that as read.", "generic"));
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      setPageError(formatApiError(err, "We couldn't mark everything as read.", "generic"));
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary)", margin: "0 0 4px", letterSpacing: "-1px" }}>Notifications</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>Updates about your loads, bookings, and trucks.</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "9px 16px", color: "var(--primary)", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.background = "var(--bg)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "var(--surface)"; }}>
              Mark all as read
            </button>
          )}
        </div>

        {pageError && (
          <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>
            {pageError}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "8px" }}>
            <style>{`@keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.sk{background:linear-gradient(90deg,#ede9e2 25%,#e2ddd6 50%,#ede9e2 75%);background-size:2000px 100%;animation:shimmer 1.5s infinite;border-radius:10px;}`}</style>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>Loading your notifications…</div>
            {[1,2,3,4].map((i: number) => <div key={i} className="sk" style={{ height: "72px", marginBottom: "10px" }} />)}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "64px 24px", textAlign: "center" as const, border: "1px solid rgba(26,39,68,0.06)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#94A3B8" }}>
              <Bell size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--primary)", margin: "0 0 8px" }}>You&apos;re all caught up</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>New notifications about your loads and bookings will appear here.</p>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid rgba(26,39,68,0.06)", overflow: "hidden" }}>
            {notifications.map((n: any, i: number) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                style={{ padding: "18px 24px", borderBottom: i < notifications.length - 1 ? "1px solid var(--bg)" : "none", display: "flex", alignItems: "flex-start", gap: "16px", background: n.isRead ? "var(--surface)" : "#fdfcfa", cursor: n.isRead ? "default" : "pointer", transition: "background 0.15s" }}
                onMouseOver={e => { if (!n.isRead) e.currentTarget.style.background = "#faf7f1"; }}
                onMouseOut={e => { if (!n.isRead) e.currentTarget.style.background = "#fdfcfa"; }}
              >
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: colorForType(n.type), flexShrink: 0 }}>
                  {iconForType(n.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ fontSize: "15px", fontWeight: n.isRead ? "500" : "700", color: "var(--primary)" }}>{n.title}</div>
                    {!n.isRead && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#C2791A", flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px", lineHeight: "1.5" }}>{n.body}</div>
                  <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                    {formatDateTime(n.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
