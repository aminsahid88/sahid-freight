"use client";
/**
 * Home: what needs me now. Deadline countdown, open review items, documents
 * this period, verified share, and the next action.
 */
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, ClipboardCheck, Inbox, Truck } from "lucide-react";
import { iftaDueDate, quarterOf } from "@tbo/core/period";
import { backoffice, type CompanyDetail, type Period, type PeriodSummary, periodLabel } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { useAuthStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/EmptyState";

function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}

export default function OfficeHome() {
  const { t, locale } = useT();
  const { user } = useAuthStore();
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
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
      if (current) {
        const s = await backoffice.periodSummary(companyId, current.id).catch(() => null);
        if (!cancelled) setSummary(s);
      }
      if (!cancelled) setLoadedFor(companyId);
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

  return (
    <div>
      <PageHeader eyebrow={selected?.company.legalName} title={t("home.welcome", { name: user?.fullName?.split(" ")[0] ?? "" })} description={t("home.subtitle")} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<ClipboardCheck size={16} />} label={t("home.needsYou")} value={needsYou} tone={openErrors > 0 ? "warning" : "default"} detail={openErrors > 0 ? t("home.openErrors", { count: openErrors }) : t("home.allClear")} />
          <Stat icon={<CalendarClock size={16} />} label={t("home.nextIftaDeadline")} value={t("home.daysLeft", { days: daysUntil(due) })} detail={`${t("home.quarter", { label: q.label })} · ${dueLabel}`} />
          <Stat icon={<Inbox size={16} />} label={t("home.receivedThisPeriod")} value={summary?.documents.total ?? detail?._count.documents ?? 0} detail={period ? periodLabel(period) : ""} />
          <Stat icon={<Truck size={16} />} label={t("home.percentVerified")} value={`${summary?.transactions.verifiedPercent ?? "0.0"}%`} detail={t("home.verifiedOf", { count: summary?.transactions.total ?? 0 })} tone={Number(summary?.transactions.verifiedPercent ?? 0) >= 70 ? "success" : "default"} />
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
            <div className="flex items-baseline gap-6">
              <div>
                <div className="text-3xl font-extrabold tnum text-ink">{detail?._count.vehicles ?? "–"}</div>
                <div className="text-[13px] text-ink-3">{t("vehicles.trucks")}</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold tnum text-ink">{detail?._count.drivers ?? "–"}</div>
                <div className="text-[13px] text-ink-3">{t("vehicles.drivers")}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
