"use client";
/**
 * First-run tour: a spotlight walks a new owner through the sidebar in the
 * order the work happens (Inbox → Transactions → Review → Fuel & IFTA →
 * Reports → Vehicles). Starts after sign-up (?welcome=1) or when the user has
 * never finished it; steps whose target is not on screen (phone "More" menu)
 * are skipped. Finishing or skipping is remembered on the user.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { useT } from "@/lib/useT";
import { updateOnboarding, useOnboarding } from "@/lib/onboarding";
import { Button } from "@/components/ui/Button";

interface Step {
  id: string;
  target: string | null;
}

const STEPS: Step[] = [
  { id: "welcome", target: null },
  { id: "inbox", target: "nav-inbox" },
  { id: "transactions", target: "nav-transactions" },
  { id: "review", target: "nav-review" },
  { id: "ifta", target: "nav-ifta" },
  { id: "reports", target: "nav-reports" },
  { id: "vehicles", target: "nav-vehicles" },
  { id: "done", target: null },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function rectOf(target: string | null): Rect | null {
  if (!target || typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tour() {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const onboarding = useOnboarding();
  const welcome = params.get("welcome") === "1";
  const [forced, setForced] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tick, setTick] = useState(0);

  // "Take the tour again" from anywhere: window event, no prop drilling.
  useEffect(() => {
    const on = () => {
      setForced(true);
      setIndex(0);
    };
    window.addEventListener("sf:tour", on);
    return () => window.removeEventListener("sf:tour", on);
  }, []);

  const active = forced || welcome || (onboarding !== null && !onboarding.tourDoneAt);

  // Steps available on this screen (phone hides some sidebar targets).
  const steps = useMemo(() => STEPS.filter((s) => s.target === null || rectOf(s.target) !== null), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = steps[Math.min(index, steps.length - 1)] ?? STEPS[0]!;

  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      setRect(rectOf(step.target));
      setTick((n) => n + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step.target, index]);

  const finish = useCallback(
    async (skipped: boolean) => {
      setForced(false);
      setIndex(0);
      await updateOnboarding({ tourDoneAt: new Date().toISOString() });
      if (welcome) router.replace(pathname);
      void skipped;
    },
    [welcome, pathname, router],
  );

  if (!active) return null;

  const last = index >= steps.length - 1;
  const padding = 6;
  const spot = rect ? { top: rect.top - padding, left: rect.left - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 } : null;
  // Tooltip: to the right of the sidebar target on wide screens, otherwise centered at the bottom.
  const wide = typeof window !== "undefined" && window.innerWidth >= 900;
  const tipStyle: React.CSSProperties = spot && wide ? { top: Math.max(16, Math.min(spot.top - 8, window.innerHeight - 260)), left: spot.left + spot.width + 16 } : spot ? { left: 16, right: 16, bottom: 96 } : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      {spot ? <div className="tour-spotlight" style={spot} aria-hidden /> : <div className="fixed inset-0 z-[600] bg-[rgba(12,18,34,0.55)]" aria-hidden />}
      <div role="dialog" aria-modal aria-labelledby="tour-title" className="fixed z-[601] w-[min(380px,calc(100vw-32px))] rounded-card bg-canvas p-5 shadow-panel" style={tipStyle}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent-dim text-accent">
            <Sparkles size={16} />
          </span>
          <button onClick={() => finish(true)} aria-label={t("tour.skip")} className="flex h-8 w-8 items-center justify-center rounded-control text-ink-3 hover:bg-surface2 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <h2 id="tour-title" className="text-[16px] font-semibold text-ink display">{t(`tour.${step.id}.title`)}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{t(`tour.${step.id}.body`)}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[12px] tnum text-ink-3">{t("tour.progress", { n: index + 1, total: steps.length })}</span>
          <span className="flex items-center gap-2">
            {index > 0 && (
              <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                {t("tour.back")}
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={() => finish(false)}>{t("tour.finish")}</Button>
            ) : (
              <Button size="sm" icon={<ArrowRight size={14} />} onClick={() => setIndex((i) => i + 1)}>
                {t("tour.next")}
              </Button>
            )}
          </span>
        </div>
        {!last && (
          <button onClick={() => finish(true)} className="mt-3 text-[12px] font-medium text-ink-3 hover:text-ink">
            {t("tour.skip")}
          </button>
        )}
      </div>
    </>
  );
}

/** Re-open the tour from anywhere (Settings, Home checklist). */
export function startTour() {
  window.dispatchEvent(new Event("sf:tour"));
}
