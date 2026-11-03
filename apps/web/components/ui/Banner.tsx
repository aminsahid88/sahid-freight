import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type BannerTone = "info" | "success" | "warning" | "danger";

const tones: Record<BannerTone, { cls: string; icon: ReactNode }> = {
  info: { cls: "bg-accent-dim text-ink border-line", icon: <Info size={16} className="text-accent" /> },
  success: { cls: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] dark:bg-[rgba(74,222,128,0.1)] dark:text-[#86efac] dark:border-[rgba(74,222,128,0.3)]", icon: <CheckCircle2 size={16} /> },
  warning: { cls: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] dark:bg-[rgba(251,191,36,0.1)] dark:text-[#fcd34d] dark:border-[rgba(251,191,36,0.3)]", icon: <AlertTriangle size={16} /> },
  danger: { cls: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] dark:bg-[rgba(248,113,113,0.1)] dark:text-[#fca5a5] dark:border-[rgba(248,113,113,0.3)]", icon: <XCircle size={16} /> },
};

export function Banner({ tone = "info", title, children, className = "" }: { tone?: BannerTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-control border px-4 py-3 text-[13px] ${t.cls} ${className}`}>
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
