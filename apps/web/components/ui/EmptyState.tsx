import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action, className = "" }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}>
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface2 text-ink-2">{icon}</div>}
      <div className="text-[15px] font-bold text-ink">{title}</div>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
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
