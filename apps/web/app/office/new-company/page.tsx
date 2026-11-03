"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { backoffice } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

const STATES = ["AL","AR","AZ","CA","CO","CT","DE","FL","GA","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles"];

export default function NewCompanyPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const { setList } = useCompanyStore();
  const [form, setForm] = useState({ legalName: "", dba: "", usdot: "", mcNumber: "", iftaBaseJurisdiction: "MN", timezone: "America/Chicago" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await backoffice.createCompany({
        legalName: form.legalName.trim(),
        dba: form.dba.trim() || undefined,
        usdot: form.usdot.trim() || undefined,
        mcNumber: form.mcNumber.trim() || undefined,
        iftaBaseJurisdiction: form.iftaBaseJurisdiction,
        timezone: form.timezone,
        language: locale === "so" ? "SO" : "EN",
      });
      setList(await backoffice.myCompanies());
      router.replace("/office/vehicles?welcome=1");
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <PageHeader title={t("company.create")} description={t("app.tagline")} />
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      <Card>
        <CardBody className="pt-5">
          <form onSubmit={submit} className="grid gap-4">
            <Input label={t("company.legalName")} required minLength={2} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            <Input label={t("company.dba")} value={form.dba} onChange={(e) => setForm({ ...form, dba: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label={t("company.usdot")} inputMode="numeric" pattern="\d{1,8}" value={form.usdot} onChange={(e) => setForm({ ...form, usdot: e.target.value })} />
              <Input label={t("company.mcNumber")} value={form.mcNumber} onChange={(e) => setForm({ ...form, mcNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t("company.baseJurisdiction")} value={form.iftaBaseJurisdiction} onChange={(e) => setForm({ ...form, iftaBaseJurisdiction: e.target.value })}>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Select label={t("company.timezone")} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {TIMEZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" size="lg" loading={saving}>{t("company.createButton")}</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
