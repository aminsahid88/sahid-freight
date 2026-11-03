"use client";
import type { ReactNode } from "react";

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Segmented filter pills (36px tall on desktop, 40px on touch). */
export function Tabs<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: TabOption<T>[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${active ? "border-accent bg-accent-dim text-accent" : "border-line bg-canvas text-ink-2 hover:bg-surface"}`}
          >
            {o.label}
            {o.count !== undefined && <span className={`rounded-full px-1.5 text-[11px] tnum ${active ? "bg-accent text-white" : "bg-surface2 text-ink-3"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
