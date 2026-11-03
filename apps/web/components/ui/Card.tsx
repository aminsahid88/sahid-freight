import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-card border border-line bg-canvas shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className = "" }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 pt-5 pb-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-ink leading-tight">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-ink-2">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}

/** Key/value row used in detail panels. */
export function DefinitionRow({ label, value, mono = false }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-b-0 text-[13px]">
      <span className="text-ink-3 shrink-0">{label}</span>
      <span className={`text-ink text-right break-all ${mono ? "font-mono text-xs tnum" : ""}`}>{value}</span>
    </div>
  );
}

/** KPI tile. */
export function Stat({ label, value, detail, icon, tone = "default" }: { label: ReactNode; value: ReactNode; detail?: ReactNode; icon?: ReactNode; tone?: "default" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink";
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-[30px] font-extrabold tracking-tight leading-none tnum ${toneClass}`}>{value}</div>
      {detail && <div className="mt-2 text-[13px] text-ink-3">{detail}</div>}
    </Card>
  );
}
