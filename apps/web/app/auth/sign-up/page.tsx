"use client";
/**
 * Sign-up: email → 6-digit code → details (name, company, password). The
 * company is created right after the account so the owner lands in a working
 * back office, not an empty picker.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { backoffice } from "@/lib/backoffice";
import { formatApiError } from "@/lib/errors";
import { useAuthStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";

const STATES = ["AL","AR","AZ","CA","CO","CT","DE","FL","GA","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];

type Step = "email" | "code" | "details";

export default function SignUpPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  const [form, setForm] = useState({ fullName: "", companyName: "", state: "MN", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/request-otp", { identifier: email.trim().toLowerCase(), purpose: "REGISTER" });
      setDevCode(res.data?.devCode ?? null);
      setStep("code");
    } catch (err) {
      setError(formatApiError(err, t("common.error"), "auth"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/verify-otp", { identifier: email.trim().toLowerCase(), code: code.trim(), purpose: "REGISTER" });
      setVerificationToken(res.data.verificationToken);
      setStep("details");
    } catch (err) {
      setError(formatApiError(err, t("auth.codeInvalid"), "auth"));
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/register", {
        verificationToken,
        fullName: form.fullName.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        country: "USA",
      });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      await backoffice.createCompany({ legalName: form.companyName.trim(), iftaBaseJurisdiction: form.state, language: locale === "so" ? "SO" : "EN" });
      router.replace("/office?welcome=1");
    } catch (err) {
      setError(formatApiError(err, t("common.error"), "auth"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="text-[24px] font-semibold text-ink display">{t("auth.signUpTitle")}</h1>
      <p className="mt-1 text-sm text-ink-2">{t("auth.signUpSubtitle")}</p>
      <ol className="mt-5 flex items-center gap-2 text-xs font-semibold text-ink-3" aria-label="Steps">
        {(["email", "code", "details"] as Step[]).map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${step === s ? "text-accent" : ""}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${step === s ? "border-accent bg-accent-dim" : "border-line"}`}>{i + 1}</span>
            {t(`auth.step_${s}`)}
            {i < 2 && <span className="mx-1 h-px w-5 bg-line" aria-hidden />}
          </li>
        ))}
      </ol>
      {error && <Banner tone="danger" className="mt-5">{error}</Banner>}

      {step === "email" && (
        <form onSubmit={sendCode} className="mt-6 flex flex-col gap-4">
          <Input label={t("auth.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" hint={t("auth.emailHint")} />
          <Button type="submit" size="lg" loading={busy}>
            {t("auth.sendCode")}
          </Button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
          <Banner tone="info">{t("auth.codeSent", { email })}</Banner>
          {devCode && (
            <Banner tone="warning" title={t("auth.devCodeTitle")}>
              <span className="font-mono text-base tracking-widest">{devCode}</span>
            </Banner>
          )}
          <Input label={t("auth.code")} inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tnum" />
          <Button type="submit" size="lg" loading={busy}>
            {t("auth.verify")}
          </Button>
          <button type="button" onClick={() => sendCode()} disabled={busy} className="text-[13px] font-semibold text-accent hover:underline">
            {t("auth.resend")}
          </button>
        </form>
      )}

      {step === "details" && (
        <form onSubmit={create} className="mt-6 flex flex-col gap-4">
          <Input label={t("auth.fullName")} autoComplete="name" required minLength={2} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label={t("auth.companyName")} autoComplete="organization" required minLength={2} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} hint={t("auth.companyHint")} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t("company.baseJurisdiction")} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Input label={t("auth.phoneOptional")} type="tel" inputMode="tel" autoComplete="tel" placeholder="+16125550100" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label={t("auth.password")} type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint={t("auth.passwordRule")} />
          <Button type="submit" size="lg" loading={busy}>
            {t("auth.createAccount")}
          </Button>
          <p className="text-xs text-ink-3">{t("auth.agree")}</p>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-2">
        {t("auth.haveAccount")}{" "}
        <Link href="/auth/sign-in" className="font-semibold text-accent hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </>
  );
}
