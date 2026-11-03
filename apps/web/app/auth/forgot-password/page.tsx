"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";

type Step = "email" | "code" | "password";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useT();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(formatApiError(err, fallback, "auth"));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const res = await api.post("/auth/request-otp", { identifier: email.trim().toLowerCase(), purpose: "RESET_PASSWORD" });
      setDevCode(res.data?.devCode ?? null);
      setStep("code");
    }, t("common.error"));
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await api.post("/auth/verify-otp", { identifier: email.trim().toLowerCase(), code: code.trim(), purpose: "RESET_PASSWORD" });
      setVerificationToken(res.data.verificationToken);
      setStep("password");
    }, t("auth.codeInvalid"));
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await api.post("/auth/reset-password", { verificationToken, newPassword: password });
      router.replace("/auth/sign-in?reset=success");
    }, t("common.error"));
  };

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t("auth.resetTitle")}</h1>
      <p className="mt-1 text-sm text-ink-2">{t("auth.resetSubtitle")}</p>
      {error && <Banner tone="danger" className="mt-5">{error}</Banner>}

      {step === "email" && (
        <form onSubmit={sendCode} className="mt-6 flex flex-col gap-4">
          <Input label={t("auth.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" loading={busy}>{t("auth.sendCode")}</Button>
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
          <Input label={t("auth.code")} inputMode="numeric" maxLength={6} autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <Button type="submit" size="lg" loading={busy}>{t("auth.verify")}</Button>
          <button type="button" onClick={() => sendCode()} disabled={busy} className="text-[13px] font-semibold text-accent hover:underline">{t("auth.resend")}</button>
        </form>
      )}
      {step === "password" && (
        <form onSubmit={reset} className="mt-6 flex flex-col gap-4">
          <Input label={t("auth.newPassword")} type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint={t("auth.passwordRule")} />
          <Button type="submit" size="lg" loading={busy}>{t("auth.resetPassword")}</Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-2">
        <Link href="/auth/sign-in" className="font-semibold text-accent hover:underline">{t("auth.backToSignIn")}</Link>
      </p>
    </>
  );
}
