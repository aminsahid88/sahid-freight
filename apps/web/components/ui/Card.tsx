import type { HTMLAttributes, ReactNode } from "react";

/** Raised white surface on the grey page: hairline ring + soft shadow, 16px corners. */
export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-card bg-canvas shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className = "" }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-6 pt-5 pb-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight text-ink display">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`px-6 pb-6 ${className}`}>{children}</div>;
}

/** Key/value row used in detail panels. */
export function DefinitionRow({ label, value, mono = false }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 text-[13px] last:border-b-0">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className={`break-all text-right text-ink ${mono ? "font-mono text-xs tnum" : ""}`}>{value}</span>
    </div>
  );
}

/** KPI tile: small-caps label, a large tabular number, one line of context. */
export function Stat({ label, value, detail, icon, tone = "default" }: { label: ReactNode; value: ReactNode; detail?: ReactNode; icon?: ReactNode; tone?: "default" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink";
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 label-caps">
        {icon && <span className="text-ink-3">{icon}</span>}
        {label}
      </div>
      <div className={`mt-3 text-[32px] font-semibold leading-none tnum display ${toneClass}`}>{value}</div>
      {detail && <div className="mt-2.5 text-[13px] text-ink-2">{detail}</div>}
    </Card>
  );
}
