"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import adminApi from "@/lib/admin-api";

interface Stats {
  totalUsers: number;
  totalTrucks: number;
  totalLoads: number;
  totalBookings: number;
  pendingVerifications: number;
  activeLoads: number;
  pendingDocuments: number;
}

const CARDS: { key: keyof Stats; label: string; color: string }[] = [
  { key: "totalUsers", label: "Total Users", color: "#2563eb" },
  { key: "totalTrucks", label: "Total Trucks", color: "#E8A020" },
  { key: "totalLoads", label: "Total Loads", color: "#7c3aed" },
  { key: "totalBookings", label: "Total Bookings", color: "#16a34a" },
  { key: "pendingVerifications", label: "Pending Verifications", color: "#dc2626" },
  { key: "activeLoads", label: "Active Loads", color: "#15803d" },
];

function Skeleton({ w, h }: { w: string; h: string }) {
  return (
    <div
      className="rounded-md animate-pulse"
      style={{ width: w, height: h, background: "var(--border)" }}
    />
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .get("/admin/stats")
      .then((r) => setStats(r.data.stats))
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2
        className="text-xl font-extrabold mb-1"
        style={{ color: "var(--primary)" }}
      >
        Dashboard
      </h2>
      <p
        className="text-sm mb-6"
        style={{ color: "var(--text-secondary)" }}
      >
        Platform overview at a glance
      </p>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm font-semibold"
          style={{
            background: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-5"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <Skeleton w="60px" h="32px" />
                <div className="mt-2">
                  <Skeleton w="100px" h="14px" />
                </div>
              </div>
            ))
          : CARDS.map((card) => (
              <div
                key={card.key}
                className="rounded-xl p-5 transition-shadow hover:shadow-md"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${card.color}`,
                }}
              >
                <div
                  className="text-3xl font-extrabold"
                  style={{ color: card.color }}
                >
                  {stats?.[card.key] ?? 0}
                </div>
                <div
                  className="text-xs font-medium mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {card.label}
                </div>
              </div>
            ))}
      </div>

      {/* Alert banners */}
      {!loading && stats && (
        <div className="flex flex-col gap-3">
          {stats.pendingVerifications > 0 && (
            <button
              onClick={() => router.push("/admin/users")}
              className="w-full text-left rounded-xl p-4 flex items-center justify-between transition-shadow hover:shadow-md"
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                cursor: "pointer",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                  style={{ background: "#E8A020", color: "#fff" }}
                >
                  {stats.pendingVerifications}
                </div>
                <div>
                  <div
                    className="text-sm font-bold"
                    style={{ color: "#92400e" }}
                  >
                    Pending Verifications
                  </div>
                  <div className="text-xs" style={{ color: "#b45309" }}>
                    Users awaiting identity verification
                  </div>
                </div>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#b45309"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {stats.pendingDocuments > 0 && (
            <button
              onClick={() => router.push("/admin/documents")}
              className="w-full text-left rounded-xl p-4 flex items-center justify-between transition-shadow hover:shadow-md"
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                cursor: "pointer",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                  style={{ background: "#2563eb", color: "#fff" }}
                >
                  {stats.pendingDocuments}
                </div>
                <div>
                  <div
                    className="text-sm font-bold"
                    style={{ color: "#1e40af" }}
                  >
                    Pending Documents
                  </div>
                  <div className="text-xs" style={{ color: "#2563eb" }}>
                    Documents awaiting review
                  </div>
                </div>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {stats.pendingVerifications === 0 && stats.pendingDocuments === 0 && (
            <div
              className="rounded-xl p-5 text-center"
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <div className="text-sm font-semibold" style={{ color: "#16a34a" }}>
                All clear -- no pending items
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
