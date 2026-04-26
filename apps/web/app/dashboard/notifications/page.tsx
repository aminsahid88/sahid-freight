"use client";
import { Truck, Package, Bell, Shield, DollarSign, Globe, Clock, MapPin, CheckCircle, AlertCircle, Inbox, BellOff, Fuel, Box, Minimize2, Container } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) { console.error(err); }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navTabs = [
    { key: "overview",      label: "Overview",     path: "/dashboard" },
    { key: "loads",         label: user?.role === "CARGO_SENDER" ? "My Loads" : "Find Loads", path: "/dashboard/loads" },
    ...(user?.role === "TRUCK_OWNER" ? [{ key: "trucks", label: "My Trucks", path: "/dashboard/trucks" }] : []),
    { key: "bookings",      label: "Bookings",     path: "/dashboard/bookings" },
    { key: "notifications", label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}`, path: "/dashboard/notifications" },
  ];

  const typeIcon: any = {
    BOOKING_REQUEST: "B",
    BOOKING_ACCEPTED: "check",
    BOOKING_REJECTED: "x",
    LOAD_CANCELLED: "🚫",
    PAYMENT: "P",
    SYSTEM: "S",
  };

  return (
    <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary)", margin: "0 0 4px", letterSpacing: "-1px" }}>Notifications</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "9px 16px", color: "var(--primary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "8px" }}>
            <style>{`@keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}.sk{background:linear-gradient(90deg,#ede9e2 25%,#e2ddd6 50%,#ede9e2 75%);background-size:2000px 100%;animation:shimmer 1.5s infinite;border-radius:10px;}`}</style>
            {[1,2,3,4].map((i: number) => <div key={i} className="sk" style={{ height: "72px", marginBottom: "10px" }} />)}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "64px 24px", textAlign: "center" as const, border: "1px solid rgba(26,39,68,0.06)" }}>

            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--primary)", margin: "0 0 8px" }}>No notifications yet</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>You'll see updates about your loads and bookings here</p>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid rgba(26,39,68,0.06)", overflow: "hidden" }}>
            {notifications.map((n: any, i: number) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                style={{ padding: "18px 24px", borderBottom: i < notifications.length - 1 ? "1px solid var(--bg)" : "none", display: "flex", alignItems: "flex-start", gap: "16px", background: n.isRead ? "var(--surface)" : "#fdfcfa", cursor: n.isRead ? "default" : "pointer", transition: "background 0.15s" }}
              >
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: n.isRead ? "var(--bg)" : "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                  
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ fontSize: "15px", fontWeight: n.isRead ? "500" : "700", color: "var(--primary)" }}>{n.title}</div>
                    {!n.isRead && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E8A020", flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px", lineHeight: "1.5" }}>{n.body}</div>
                  <div style={{ fontSize: "11px", color: "#c8d0e0" }}>
                    {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
