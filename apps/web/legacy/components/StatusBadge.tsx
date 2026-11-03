"use client";
import React from "react";

// Shared status badge — extracted from the inline maps that were reimplemented
// on dashboard/page.tsx, loads/page.tsx, loads/[id]/page.tsx. Same palette;
// hardcoded so it matches across roles regardless of theme.
const statusStyle: Record<string, { bg: string; color: string; border: string; label: string }> = {
  // Load statuses
  OPEN:       { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0", label: "Open" },
  BOOKED:     { bg: "#E8F0FF", color: "#3D7BFF", border: "#BBD0FF", label: "Booked" },
  IN_TRANSIT: { bg: "#FFF7ED", color: "#C2791A", border: "#FED7AA", label: "In Transit" },
  DELIVERED:  { bg: "#F0FDF4", color: "#15803D", border: "#86EFAC", label: "Delivered" },
  CANCELLED:  { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Cancelled" },
  DRAFT:      { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Draft" },
  // Booking statuses
  PENDING:    { bg: "#FFF7ED", color: "#C2791A", border: "#FED7AA", label: "Pending" },
  ACCEPTED:   { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0", label: "Accepted" },
  REJECTED:   { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Rejected" },
  COMPLETED:  { bg: "#F0FDF4", color: "#15803D", border: "#86EFAC", label: "Completed" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusStyle[status] || { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: status };
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: "99px",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
