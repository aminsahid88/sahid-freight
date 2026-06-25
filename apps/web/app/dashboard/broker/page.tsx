"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

const P = "var(--primary)";
const A = "var(--accent)";

// W1 placeholder — real broker dashboard lands in W2.
// The route exists so brokers have a working landing page after W1's role-redirect.
export default function BrokerDashboardPlaceholder() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Belt-and-suspenders: the dashboard layout already bounces non-brokers,
  // but if someone deep-links here as the wrong role, send them out.
  useEffect(() => {
    if (user && user.role !== "BROKER" && user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [user]);

  const firstName = (user?.fullName || "Broker").split(" ")[0];

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto" }}>
      {/* Hero (matches the mobile broker dashboard's single navy element) */}
      <section
        style={{
          background: "var(--navy, #0A1F44)",
          borderRadius: "16px",
          padding: "32px 28px",
          marginBottom: "28px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 800, color: A, letterSpacing: "1.5px", marginBottom: "12px" }}>
          BROKER
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px" }}>
          Hi, {firstName}.
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: "560px" }}>
          Your dispatch board, live trips, and earnings will live here. The real broker dashboard lands next.
        </p>
      </section>

      {/* Placeholder card */}
      <section
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          padding: "24px",
          border: "1px solid var(--border, #E2E8F0)",
          boxShadow: "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.06)",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 800, color: "#94A3B8", letterSpacing: "1.2px", marginBottom: "8px" }}>
          COMING NEXT — W2
        </div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: P, marginBottom: "8px" }}>
          Broker command center
        </div>
        <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
          Needs-a-truck queue, in-transit trips, and quick stats. Use the sidebar in the meantime —{" "}
          <strong style={{ color: P }}>New Load</strong> creates a load on behalf of an offline cargo owner.
        </p>
      </section>
    </div>
  );
}
