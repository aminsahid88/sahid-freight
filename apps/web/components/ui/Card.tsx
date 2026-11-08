import type { HTMLAttributes, ReactNode } from "react";

/** Glass surface on the ambient canvas: translucent fill, blur, hairline ring and inner highlight. */
export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`glass rounded-card shadow-card transition-shadow duration-300 ${className}`} {...rest}>
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

/** KPI tile: mono small-caps label, a large tabular number (gradient when healthy), one line of context. */
export function Stat({ label, value, detail, icon, tone = "default" }: { label: ReactNode; value: ReactNode; detail?: ReactNode; icon?: ReactNode; tone?: "default" | "warning" | "danger" | "success" }) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "success" ? "text-gradient" : "text-ink";
  return (
    <Card className="hairline-gradient p-6 hover:shadow-card-hover">
      <div className="flex items-center gap-2 label-caps">
        {icon && <span className="text-accent">{icon}</span>}
        {label}
      </div>
      <div className={`mt-3 text-[30px] font-semibold leading-none tnum display whitespace-nowrap ${toneClass}`}>{value}</div>
      {detail && <div className="mt-2.5 text-[13px] text-ink-2">{detail}</div>}
    </Card>
  );
}
