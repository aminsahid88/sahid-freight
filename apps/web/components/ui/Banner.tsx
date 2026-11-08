import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type BannerTone = "info" | "success" | "warning" | "danger";

const tones: Record<BannerTone, { cls: string; icon: ReactNode }> = {
  info: { cls: "bg-accent-dim text-ink", icon: <Info size={16} className="text-accent" /> },
  success: { cls: "bg-success-soft text-success", icon: <CheckCircle2 size={16} /> },
  warning: { cls: "bg-warning-soft text-warning", icon: <AlertTriangle size={16} /> },
  danger: { cls: "bg-danger-soft text-danger", icon: <XCircle size={16} /> },
};

export function Banner({ tone = "info", title, children, className = "" }: { tone?: BannerTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-control px-4 py-3 text-[13px] leading-relaxed ${t.cls} ${className}`}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {t.icon}
      </span>
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}
