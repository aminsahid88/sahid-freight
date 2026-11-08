"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { formatApiError } from "@/lib/errors";
import { useAuthStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useT();
  const { setAuth } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reset = params.get("reset") === "success";
  const next = params.get("next") || "/office";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { identifier: identifier.trim(), password });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      router.replace(next.startsWith("/") ? next : "/office");
    } catch (err) {
      setError(formatApiError(err, t("auth.invalidCredentials"), "auth"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="text-[24px] font-semibold text-ink display">{t("auth.signInTitle")}</h1>
      <p className="mt-1 text-sm text-ink-2">{t("auth.signInSubtitle")}</p>
      {reset && <Banner tone="success" className="mt-5">{t("auth.resetDone")}</Banner>}
      {error && <Banner tone="danger" className="mt-5">{error}</Banner>}
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Input label={t("auth.emailOrPhone")} type="text" inputMode="email" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@company.com" />
        <Input label={t("auth.password")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-center justify-between text-[13px]">
          <Link href="/auth/forgot-password" className="font-semibold text-accent hover:underline">
            {t("auth.forgot")}
          </Link>
        </div>
        <Button type="submit" size="lg" loading={busy}>
          {t("auth.signIn")}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        {t("auth.noAccount")}{" "}
        <Link href="/auth/sign-up" className="font-semibold text-accent hover:underline">
          {t("auth.createAccount")}
        </Link>
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
