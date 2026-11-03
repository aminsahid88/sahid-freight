import type { CSSProperties, ReactNode } from "react";

/**
 * Status pills share one palette everywhere (design principle): green = good,
 * amber = needs attention, red = failed, grey = neutral, blue = in progress.
 * Always paired with a text label.
 */
export type PillTone = "green" | "amber" | "red" | "grey" | "blue";

const TONES: Record<PillTone, string> = {
  green: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0] dark:bg-[rgba(74,222,128,0.12)] dark:text-[#86efac] dark:border-[rgba(74,222,128,0.3)]",
  amber: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] dark:bg-[rgba(251,191,36,0.12)] dark:text-[#fcd34d] dark:border-[rgba(251,191,36,0.3)]",
  red: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-[rgba(248,113,113,0.12)] dark:text-[#fca5a5] dark:border-[rgba(248,113,113,0.3)]",
  grey: "bg-surface text-ink-2 border-line",
  blue: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE] dark:bg-[rgba(91,140,255,0.14)] dark:text-[#93c5fd] dark:border-[rgba(91,140,255,0.3)]",
};

export const DOCUMENT_TONES: Record<string, PillTone> = { RECEIVED: "blue", PROCESSING: "amber", PROCESSED: "green", FAILED: "red", UNREADABLE: "grey" };
export const TRANSACTION_TONES: Record<string, PillTone> = { VERIFIED: "green", NEEDS_ATTENTION: "amber", UNABLE_TO_VERIFY: "red" };
export const SEVERITY_TONES: Record<string, PillTone> = { ERROR: "red", WARNING: "amber", INFO: "blue" };
export const ISSUE_TONES: Record<string, PillTone> = { OPEN: "amber", RESOLVED: "green", ACCEPTED: "grey" };
export const REPORT_TONES: Record<string, PillTone> = { PRELIMINARY: "amber", REVIEWED: "green" };

export function Pill({ label, tone, className = "", style }: { label: ReactNode; tone: PillTone; className?: string; style?: CSSProperties }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-[18px] ${TONES[tone]} ${className}`} style={style}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
