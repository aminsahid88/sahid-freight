"use client";
import type { ReactNode } from "react";

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Segmented control: a grey track with a raised white active segment. */
export function Tabs<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: TabOption<T>[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex max-w-full flex-wrap gap-1 rounded-[12px] bg-surface2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition-[background-color,box-shadow,color] ${active ? "bg-canvas text-ink shadow-card" : "text-ink-2 hover:text-ink"}`}
          >
            {o.label}
            {o.count !== undefined && <span className={`rounded-full px-1.5 text-[11px] tnum ${active ? "bg-accent-dim text-accent" : "bg-canvas/70 text-ink-3"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
