import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action, className = "" }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon && (
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-dim text-accent shadow-card">
          <span aria-hidden className="absolute inset-0 rounded-[18px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,255,255,0.35),transparent)]" />
          <span className="relative">{icon}</span>
        </div>
      )}
      <div className="text-[15px] font-semibold text-ink display">{title}</div>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sk ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 3, height = "h-12" }: { rows?: number; height?: string }) {
  return (
    <div className="flex flex-col gap-2 p-4" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`${height} w-full`} />
      ))}
    </div>
  );
}
