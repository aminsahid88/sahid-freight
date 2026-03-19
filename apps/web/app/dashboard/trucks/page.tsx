"use client";
import { Truck, Package, Bell, Shield, DollarSign, Globe, Clock, MapPin, CheckCircle, AlertCircle, Inbox, BellOff, Fuel, Box, Minimize2, Container } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

export default function TrucksPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "TRUCK_OWNER") { router.push("/dashboard"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await api.get("/trucks/my");
      setTrucks(res.data.trucks || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleAvailability = async (truckId: string, current: boolean) => {
    try {
      await api.patch(`/trucks/${truckId}`, { isAvailable: !current });
      setTrucks((prev) => prev.map((t) => t.id === truckId ? { ...t, isAvailable: !current } : t));
    } catch (err) { console.error(err); }
  };

  const truckTypeIcon: any = {
    FLATBED: "FL", REFRIGERATED: "RF", TANKER: "TK",
    CONTAINER: "CN", OPEN_BODY: "OB", MINI_TRUCK: "MT",
  };

  const navTabs = [
    { key: "overview",      label: "Overview",     path: "/dashboard" },
    { key: "loads",         label: "Find Loads",   path: "/dashboard/loads" },
    { key: "trucks",        label: "My Trucks",    path: "/dashboard/trucks" },
    { key: "bookings",      label: "Bookings",     path: "/dashboard/bookings" },
    { key: "notifications", label: "Notifications",path: "/dashboard/notifications" },
  ];

  return (
    <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1a2744", margin: "0 0 4px", letterSpacing: "-1px" }}>My Trucks</h1>
            <p style={{ color: "#9e9890", fontSize: "15px", margin: 0 }}>
              {trucks.length} truck{trucks.length !== 1 ? "s" : ""} registered
            </p>
          </div>
          <a href="/dashboard/trucks/new" style={{ background: "#1a2744", color: "#f0ebe0", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>
            + Add Truck
          </a>
        </div>

        {loading ? (
          <div style={{ textAlign: "center" as const, padding: "64px" }}>
            <div style={{ width: "36px", height: "36px", border: "3px solid #e8e3d8", borderTop: "3px solid #1a2744", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : trucks.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "64px 24px", textAlign: "center" as const, border: "1px solid rgba(26,39,68,0.06)" }}>
            
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1a2744", margin: "0 0 8px" }}>No trucks yet</h3>
            <p style={{ color: "#9e9890", fontSize: "15px", margin: "0 0 24px" }}>Add your first truck to start receiving load requests</p>
            <a href="/dashboard/trucks/new" style={{ background: "#1a2744", color: "#f0ebe0", padding: "12px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>
              Add Truck Now
            </a>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {trucks.map((truck: any) => (
              <div key={truck.id} style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(26,39,68,0.06)", boxShadow: "0 2px 8px rgba(26,39,68,0.04)" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "48px", height: "48px", background: "#f0ebe0", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a2744", fontFamily: "monospace", letterSpacing: "1px" }}>{truck.plateNumber}</div>
                      <div style={{ fontSize: "13px", color: "#9e9890", marginTop: "2px" }}>{truck.truckType?.replace(/_/g, " ")}</div>
                    </div>
                  </div>

                  {/* availability toggle */}
                  <div
                    onClick={() => toggleAvailability(truck.id, truck.isAvailable)}
                    style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", background: truck.isAvailable ? "#f0fdf4" : "#fef2f2", border: `1px solid ${truck.isAvailable ? "#bbf7d0" : "#fecaca"}`, borderRadius: "20px", padding: "6px 12px" }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: truck.isAvailable ? "#16a34a" : "#dc2626" }} />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: truck.isAvailable ? "#16a34a" : "#dc2626" }}>
                      {truck.isAvailable ? "Available" : "Busy"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  {[
                    ["Capacity", `${truck.capacityTons} tons`],
                    ["Location", truck.currentCity],
                    ["Length", truck.lengthMeters ? `${truck.lengthMeters}m` : "—"],
                    ["Verified", truck.isVerified ? "Yes" : "Pending"],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: "#faf8f4", borderRadius: "8px", padding: "10px 12px" }}>
                      <div style={{ fontSize: "11px", color: "#9e9890", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a2744" }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ paddingTop: "14px", borderTop: "1px solid #f0ede6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#9e9890" }}>
                    Added {new Date(truck.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => router.push(`/dashboard/loads`)}
                    style={{ background: "none", border: "1px solid #e8e3d8", borderRadius: "8px", padding: "7px 14px", color: "#1a2744", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Find Loads →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
