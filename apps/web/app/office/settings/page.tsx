"use client";
/**
 * Settings: company profile, team (memberships and roles), language, theme,
 * and the inbound email address for forwarding receipts.
 */
import { useEffect, useState } from "react";
import { Plus, Sparkles, UserPlus } from "lucide-react";
import { LOCALE_NAMES } from "@tbo/i18n";
import { AVAILABLE_LOCALES } from "@/lib/useT";
import { backoffice, type CompanyDetail, type CompanyRole, type Member } from "@/lib/backoffice";
import { primaryRole, useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useAuthStore, useSettingsStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { startTour } from "@/components/office/Tour";
import { Banner } from "@/components/ui/Banner";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DefinitionRow } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";

const ROLES: CompanyRole[] = ["OWNER", "STAFF", "DRIVER", "REVIEWER", "PARTNER"];

export default function SettingsPage() {
  const { t, locale, setLocale } = useT();
  const { theme, setTheme } = useSettingsStore();
  const { user } = useAuthStore();
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const canManage = selected ? ["OWNER", "ADMIN"].includes(primaryRole(selected.roles)) : false;
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "STAFF" as CompanyRole });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    Promise.all([backoffice.company(companyId), backoffice.members(companyId).catch(() => [])])
      .then(([d, m]) => {
        if (cancelled) return;
        setDetail(d.company);
        setMembers(m);
      })
      .catch((e) => !cancelled && setError(formatApiError(e, t("common.error"))));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const m = await backoffice.addMember(companyId, { email: invite.email.trim().toLowerCase(), role: invite.role });
      setMembers((prev) => [...prev, m]);
      setInvite({ email: "", role: "STAFF" });
      setShowInvite(false);
      setNotice(t("settings.memberAdded"));
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  const pill = (active: boolean) => `h-10 rounded-full border px-4 text-[13px] font-semibold ${active ? "border-accent bg-accent-dim text-accent" : "border-line bg-canvas text-ink-2 hover:bg-surface"}`;

  return (
    <div>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      {notice && <Banner tone="success" className="mb-4">{notice}</Banner>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("settings.company")} />
          <CardBody>
            {detail ? (
              <>
                <DefinitionRow label={t("company.legalName")} value={detail.legalName} />
                <DefinitionRow label={t("company.dba")} value={detail.dba ?? "—"} />
                <DefinitionRow label={t("company.usdot")} value={detail.usdot ?? "—"} />
                <DefinitionRow label={t("company.mcNumber")} value={detail.mcNumber ?? "—"} />
                <DefinitionRow label={t("company.baseJurisdiction")} value={detail.iftaBaseJurisdiction ?? "—"} />
                <DefinitionRow label={t("company.timezone")} value={detail.timezone} />
                <DefinitionRow label={t("settings.inboundEmail")} value={`docs+${detail.inboundEmailSlug}@sahidfreight.com`} mono />
                <DefinitionRow label={t("company.role")} value={selected?.roles.map((r) => t(`role.${r}`)).join(", ")} />
              </>
            ) : (
              <div className="sk h-40" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.team")} description={t("settings.teamHint")} action={canManage ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowInvite((s) => !s)}>{t("settings.addMember")}</Button> : undefined} />
          <CardBody>
            {showInvite && (
              <form onSubmit={addMember} className="mb-4 grid gap-3 rounded-card bg-surface p-4">
                <Input label={t("auth.email")} type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} hint={t("settings.memberHint")} />
                <Select label={t("company.role")} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as CompanyRole })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{t(`role.${r}`)}</option>
                  ))}
                </Select>
                <div className="flex gap-2">
                  <Button type="submit" loading={saving} icon={<UserPlus size={14} />}>{t("settings.addMember")}</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowInvite(false)}>{t("common.cancel")}</Button>
                </div>
              </form>
            )}
            <ul>
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{m.user.fullName}</div>
                    <div className="truncate text-xs text-ink-3">{m.user.email ?? "—"}</div>
                  </div>
                  <Pill label={t(`role.${m.role}`)} tone={m.role === "OWNER" ? "blue" : "grey"} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {AVAILABLE_LOCALES.length > 1 && (
        <Card>
          <CardHeader title={t("settings.language")} description={t("settings.languageHint")} />
          <CardBody className="flex gap-2">
            {AVAILABLE_LOCALES.map((l) => (
              <button key={l} className={pill(locale === l)} onClick={() => setLocale(l)} aria-pressed={locale === l}>
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </CardBody>
        </Card>
        )}

        <Card>
          <CardHeader title={t("settings.theme")} action={<Button size="sm" variant="ghost" icon={<Sparkles size={14} />} onClick={startTour}>{t("settings.takeTour")}</Button>} />
          <CardBody className="flex gap-2">
            <button className={pill(theme === "light")} onClick={() => setTheme("light")} aria-pressed={theme === "light"}>{t("settings.light")}</button>
            <button className={pill(theme === "dark")} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}>{t("settings.dark")}</button>
          </CardBody>
        </Card>

        {user?.role === "ADMIN" && (
          <Card>
            <CardHeader title={t("settings.rates")} description={t("settings.ratesMoved")} action={<LinkButton href="/office/admin?tab=rates" size="sm" variant="secondary">{t("nav.admin")}</LinkButton>} />
          </Card>
        )}
      </div>
    </div>
  );
}
