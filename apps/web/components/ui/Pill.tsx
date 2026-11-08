import type { CSSProperties, ReactNode } from "react";

/**
 * Status pills share one palette everywhere (design principle): green = good,
 * amber = needs attention, red = failed, grey = neutral, blue = in progress.
 * Always paired with a text label.
 */
export type PillTone = "green" | "amber" | "red" | "grey" | "blue";

const TONES: Record<PillTone, string> = {
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  red: "bg-danger-soft text-danger",
  grey: "bg-surface2 text-ink-2",
  blue: "bg-accent-dim text-accent",
};

export const DOCUMENT_TONES: Record<string, PillTone> = { RECEIVED: "blue", PROCESSING: "amber", PROCESSED: "green", FAILED: "red", UNREADABLE: "grey" };
export const TRANSACTION_TONES: Record<string, PillTone> = { VERIFIED: "green", NEEDS_ATTENTION: "amber", UNABLE_TO_VERIFY: "red" };
export const SEVERITY_TONES: Record<string, PillTone> = { ERROR: "red", WARNING: "amber", INFO: "blue" };
export const ISSUE_TONES: Record<string, PillTone> = { OPEN: "amber", RESOLVED: "green", ACCEPTED: "grey" };
export const REPORT_TONES: Record<string, PillTone> = { PRELIMINARY: "amber", REVIEWED: "green" };

export function Pill({ label, tone, className = "", style }: { label: ReactNode; tone: PillTone; className?: string; style?: CSSProperties }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-semibold leading-4 ${TONES[tone]} ${className}`} style={style}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
