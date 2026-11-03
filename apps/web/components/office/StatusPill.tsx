"use client";
import type { CSSProperties } from "react";

/**
 * Status colours are the same everywhere (design principle): green = good,
 * amber = needs attention, red = failed, grey = unreadable/neutral. Always
 * paired with a text label for accessibility.
 */
export type PillTone = "green" | "amber" | "red" | "grey" | "blue";

const TONES: Record<PillTone, { bg: string; fg: string; border: string }> = {
  green: { bg: "#F0FDF4", fg: "#15803D", border: "#BBF7D0" },
  amber: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  red: { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" },
  grey: { bg: "#F8FAFC", fg: "#475569", border: "#E2E8F0" },
  blue: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
};

export const DOCUMENT_TONES: Record<string, PillTone> = {
  RECEIVED: "blue",
  PROCESSING: "amber",
  PROCESSED: "green",
  FAILED: "red",
  UNREADABLE: "grey",
};

export const TRANSACTION_TONES: Record<string, PillTone> = {
  VERIFIED: "green",
  NEEDS_ATTENTION: "amber",
  UNABLE_TO_VERIFY: "red",
};

export function StatusPill({ label, tone, style }: { label: string; tone: PillTone; style?: CSSProperties }) {
  const c = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: "18px",
        padding: "2px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: c.fg }} />
      {label}
    </span>
  );
}
