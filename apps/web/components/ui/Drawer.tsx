"use client";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Right-side panel for details. Closes on Escape and backdrop click. */
export function Drawer({ title, onClose, children, footer, width = 560 }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal aria-label={typeof title === "string" ? title : undefined} className="fixed inset-0 z-[400] flex justify-end bg-[rgba(12,18,34,0.42)] backdrop-blur-[2px] sm:p-2" onClick={onClose}>
      <div className="flex h-full w-full flex-col bg-canvas shadow-panel sm:rounded-card" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-6">
          <h2 className="truncate text-[15px] font-semibold text-ink display">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-control text-ink-2 hover:bg-surface2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-surface px-6 py-3 sm:rounded-b-card">{footer}</div>}
      </div>
    </div>
  );
}
