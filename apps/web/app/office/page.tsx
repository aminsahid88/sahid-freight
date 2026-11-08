"use client";
/**
 * Home: what needs me now. Deadline countdown, open review items, documents
 * this period, verified share, the next action, and (until it is done or
 * hidden) the getting-started checklist for a new company.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Check, ClipboardCheck, CreditCard, Inbox, Route, Sparkles, Truck, Users, X } from "lucide-react";
import { iftaDueDate, quarterOf } from "@tbo/core/period";
import { backoffice, type CompanyDetail, type Period, type PeriodSummary, periodLabel } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { updateOnboarding, useOnboarding } from "@/lib/onboarding";
import { useAuthStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/EmptyState";
import { startTour } from "@/components/office/Tour";

function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}

interface Progress {
  trucks: boolean;
  receipts: boolean;
  card: boolean;
  mileage: boolean;
  team: boolean | null;
}

export default function OfficeHome() {
  const { t, locale } = useT();
  const { user } = useAuthStore();
  const { selected } = useCompanyStore();
  const onboarding = useOnboarding();
  const companyId = selected?.company.id;
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loadedFor, setLoadedFor] = useState("");

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const [d, periods] = await Promise.all([backoffice.company(companyId), backoffice.periods(companyId)]);
      if (cancelled) return;
      setDetail(d.company);
      const current = periods.find((p) => p.type === "QUARTER" && p.status !== "LOCKED") ?? periods[0] ?? null;
      setPeriod(current);
      let s: PeriodSummary | null = null;
      if (current) {
        s = await backoffice.periodSummary(companyId, current.id).catch(() => null);
        if (!cancelled) setSummary(s);
      }
      const [cards, mileage, members] = await Promise.all([
        backoffice.fuelCardImports(companyId).catch(() => []),
        current ? backoffice.mileageImports(companyId, current.id).catch(() => []) : Promise.resolve([]),
        backoffice.members(companyId).catch(() => null),
      ]);
      if (cancelled) return;
      setProgress({
        trucks: d.company._count.vehicles > 0,
        receipts: (s?.documents.total ?? d.company._count.documents ?? 0) > 0,
        card: cards.length > 0,
        mileage: mileage.length > 0,
        team: members === null ? null : members.length > 1,
      });
      setLoadedFor(companyId);
    })().catch(() => !cancelled && setLoadedFor(companyId));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const q = quarterOf(new Date());
  const due = iftaDueDate(q.year, q.quarter);
  const dueLabel = due.toLocaleDateString(locale === "so" ? "so" : "en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const loading = loadedFor !== companyId;
  const openErrors = summary?.openIssues.ERROR ?? 0;
  const openWarnings = summary?.openIssues.WARNING ?? 0;
  const needsYou = openErrors + openWarnings;

  const steps = progress
    ? [
        { key: "trucks", done: progress.trucks, href: "/office/vehicles", icon: <Truck size={15} />, title: t("home.stepTrucks"), hint: t("home.stepTrucksHint") },
        { key: "receipts", done: progress.receipts, href: "/office/inbox", icon: <Inbox size={15} />, title: t("home.stepReceipts"), hint: t("home.stepReceiptsHint") },
        { key: "card", done: progress.card, href: "/office/ifta", icon: <CreditCard size={15} />, title: t("home.stepCard"), hint: t("home.stepCardHint") },
        { key: "mileage", done: progress.mileage, href: "/office/ifta", icon: <Route size={15} />, title: t("home.stepMileage"), hint: t("home.stepMileageHint") },
        ...(progress.team === null ? [] : [{ key: "team", done: progress.team, href: "/office/settings", icon: <Users size={15} />, title: t("home.stepTeam"), hint: t("home.stepTeamHint") }]),
      ]
    : [];
  const doneCount = steps.filter((s) => s.done).length;
  const showChecklist = steps.length > 0 && doneCount < steps.length && !onboarding?.checklistDismissedAt;

  return (
    <div>
      <PageHeader eyebrow={selected?.company.legalName} title={t("home.welcome", { name: user?.fullName?.split(" ")[0] ?? "" })} description={t("home.subtitle")} />

      {showChecklist && (
        <Card className="mb-6 overflow-hidden" data-tour="checklist">
          <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink display">
                <Sparkles size={16} className="text-accent" />
                {t("home.gettingStarted")}
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{t("home.gettingStartedHint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] tnum text-ink-3">{t("home.completed", { done: doneCount, total: steps.length })}</span>
              <Button size="sm" variant="ghost" onClick={startTour}>{t("home.takeTour")}</Button>
              <button onClick={() => updateOnboarding({ checklistDismissedAt: new Date().toISOString() })} aria-label={t("home.dismiss")} title={t("home.dismiss")} className="flex h-8 w-8 items-center justify-center rounded-control text-ink-3 hover:bg-surface2 hover:text-ink">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="mx-6 mt-4 h-1.5 overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }} />
          </div>
          <ol className="mt-3 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s) => (
              <li key={s.key} className="bg-canvas">
                <Link href={s.href} className="flex h-full items-start gap-3 px-5 py-4 transition-colors hover:bg-surface">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-success text-white" : "bg-surface2 text-ink-3"}`}>{s.done ? <Check size={13} /> : s.icon}</span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-semibold ${s.done ? "text-ink-3 line-through" : "text-ink"}`}>{s.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{s.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<ClipboardCheck size={15} />} label={t("home.needsYou")} value={needsYou} tone={openErrors > 0 ? "warning" : "default"} detail={openErrors > 0 ? t("home.openErrors", { count: openErrors }) : t("home.allClear")} />
          <Stat icon={<CalendarClock size={15} />} label={t("home.nextIftaDeadline")} value={t("home.daysLeft", { days: daysUntil(due) })} detail={`${t("home.quarter", { label: q.label })} · ${dueLabel}`} />
          <Stat icon={<Inbox size={15} />} label={t("home.receivedThisPeriod")} value={summary?.documents.total ?? detail?._count.documents ?? 0} detail={period ? periodLabel(period) : ""} />
          <Stat icon={<Truck size={15} />} label={t("home.percentVerified")} value={`${summary?.transactions.verifiedPercent ?? "0.0"}%`} detail={t("home.verifiedOf", { count: summary?.transactions.total ?? 0 })} tone={Number(summary?.transactions.verifiedPercent ?? 0) >= 70 ? "success" : "default"} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("home.nextStep")} description={t("home.nextStepHint")} />
          <CardBody className="flex flex-col gap-3">
            {detail && detail._count.vehicles === 0 ? (
              <LinkButton href="/office/vehicles" variant="secondary" icon={<Truck size={16} />}>{t("home.addTrucks")}</LinkButton>
            ) : needsYou > 0 ? (
              <LinkButton href="/office/review" icon={<ClipboardCheck size={16} />}>{t("home.reviewItems", { count: needsYou })}</LinkButton>
            ) : (
              <LinkButton href="/office/inbox" icon={<Inbox size={16} />}>{t("home.uploadReceipts")}</LinkButton>
            )}
            <LinkButton href="/office/ifta" variant="ghost" icon={<ArrowRight size={16} />}>{t("home.openIfta")}</LinkButton>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("home.fleet")} description={t("home.setupHint")} />
          <CardBody>
            <div className="flex items-baseline gap-8">
              <div>
                <div className="text-[32px] font-semibold leading-none tnum text-ink display">{detail?._count.vehicles ?? "–"}</div>
                <div className="mt-2 text-[13px] text-ink-3">{t("vehicles.trucks")}</div>
              </div>
              <div>
                <div className="text-[32px] font-semibold leading-none tnum text-ink display">{detail?._count.drivers ?? "–"}</div>
                <div className="mt-2 text-[13px] text-ink-3">{t("vehicles.drivers")}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
