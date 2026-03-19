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
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1a2744", margin: "0 0 4px", letterSpacing: "-1px" }}>Notifications</h1>
            <p style={{ color: "#9e9890", fontSize: "15px", margin: 0 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ background: "#fff", border: "1px solid #e8e3d8", borderRadius: "8px", padding: "9px 16px", color: "#1a2744", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center" as const, padding: "64px" }}>
            <div style={{ width: "36px", height: "36px", border: "3px solid #e8e3d8", borderTop: "3px solid #1a2744", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "64px 24px", textAlign: "center" as const, border: "1px solid rgba(26,39,68,0.06)" }}>
            
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1a2744", margin: "0 0 8px" }}>No notifications yet</h3>
            <p style={{ color: "#9e9890", fontSize: "15px", margin: 0 }}>You'll see updates about your loads and bookings here</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid rgba(26,39,68,0.06)", overflow: "hidden" }}>
            {notifications.map((n: any, i: number) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                style={{ padding: "18px 24px", borderBottom: i < notifications.length - 1 ? "1px solid #faf8f4" : "none", display: "flex", alignItems: "flex-start", gap: "16px", background: n.isRead ? "#fff" : "#fdfcfa", cursor: n.isRead ? "default" : "pointer", transition: "background 0.15s" }}
              >
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: n.isRead ? "#faf8f4" : "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                  
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ fontSize: "15px", fontWeight: n.isRead ? "500" : "700", color: "#1a2744" }}>{n.title}</div>
                    {!n.isRead && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c8901e", flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: "13px", color: "#9e9890", marginBottom: "6px", lineHeight: "1.5" }}>{n.body}</div>
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
