import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action, className = "" }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-b from-surface2 to-canvas text-accent shadow-card">{icon}</div>}
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
