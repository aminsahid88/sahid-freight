import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Text, View } from "react-native";
import { useAuthStore } from "../store/auth";
import { useT } from "../lib/i18n";
import { API_URL } from "../lib/api";
import { Banner, Button, Input, Screen, Title, useTheme } from "../components/ui";
import { font, space } from "../theme";

export default function SignInScreen() {
  const { t } = useT();
  const theme = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await signIn(identifier, password);
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      setError(err.response?.status === 401 ? t("auth.invalidCredentials") : err.response?.data?.message ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center" }}>
        <Title sub={t("auth.signInSubtitle")}>{t("auth.signInTitle")}</Title>
        <View style={{ gap: space.lg }}>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Input label={t("auth.emailOrPhone")} autoCapitalize="none" autoComplete="username" keyboardType="email-address" value={identifier} onChangeText={setIdentifier} placeholder="you@company.com" />
          <Input label={t("auth.password")} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
          <Button title={t("auth.signIn")} size="lg" loading={busy} disabled={!identifier || !password} onPress={submit} />
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: theme.textSecondary, textAlign: "center" }}>
            {t("auth.noAccount")}{" "}
            <Text style={{ fontFamily: font.bold, color: theme.accent }} onPress={() => Linking.openURL(`${API_URL.includes("localhost") ? "http://localhost:3000" : "https://sahidfreight.com"}/auth/sign-up`)}>
              {t("auth.createAccount")}
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
