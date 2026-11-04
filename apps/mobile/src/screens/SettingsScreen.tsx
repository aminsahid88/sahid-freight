import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LOCALE_NAMES, LOCALES } from "@tbo/i18n";
import { backoffice, type CompanySummary } from "../lib/backoffice";
import { API_URL } from "../lib/api";
import { useT } from "../lib/i18n";
import { useQueue } from "../lib/queue";
import { useAuthStore } from "../store/auth";
import { useSettingsStore } from "../store/settings";
import { Button, Card, Screen, Title, useTheme } from "../components/ui";
import { font, radius, space } from "../theme";

export default function SettingsScreen() {
  const { t, locale } = useT();
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { companyId, setCompany, setLanguage, theme: themeMode, setTheme } = useSettingsStore();
  const pending = useQueue((s) => s.items.filter((i) => i.status !== "done").length);
  const [companies, setCompanies] = useState<Array<{ company: CompanySummary; roles: string[] }>>([]);

  useEffect(() => {
    backoffice.myCompanies().then(setCompanies).catch(() => undefined);
  }, []);

  const pill = (active: boolean) => ({ minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentDim : theme.bg, justifyContent: "center" as const });
  const pillText = (active: boolean) => ({ fontFamily: font.bold, fontSize: 13, color: active ? theme.accent : theme.textSecondary });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Title sub={user?.fullName}>{t("settings.title")}</Title>

        <Card>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: theme.text, marginBottom: 10 }}>{t("settings.company")}</Text>
          <View style={{ gap: 8 }}>
            {companies.map((c) => (
              <Pressable key={c.company.id} accessibilityRole="button" accessibilityState={{ selected: c.company.id === companyId }} onPress={() => setCompany(c.company.id)} style={pill(c.company.id === companyId)}>
                <Text style={pillText(c.company.id === companyId)}>
                  {c.company.dba || c.company.legalName} · {c.roles.map((r) => t(`role.${r}`)).join(", ")}
                </Text>
              </Pressable>
            ))}
            {companies.length === 0 ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: theme.textMuted }}>{t("company.noCompany")}</Text> : null}
          </View>
        </Card>

        <Card>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: theme.text, marginBottom: 10 }}>{t("settings.language")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {LOCALES.map((l) => (
              <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: locale === l }} onPress={() => setLanguage(l)} style={pill(locale === l)}>
                <Text style={pillText(locale === l)}>{LOCALE_NAMES[l]}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: theme.text, marginBottom: 10 }}>{t("settings.theme")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["system", "light", "dark"] as const).map((m) => (
              <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: themeMode === m }} onPress={() => setTheme(m)} style={pill(themeMode === m)}>
                <Text style={pillText(themeMode === m)}>{m === "system" ? t("settings.system") : m === "light" ? t("settings.light") : t("settings.dark")}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: theme.text }}>{t("settings.about")}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.textMuted, marginTop: 6 }}>{t("settings.pendingUploads", { count: pending })}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.textMuted }}>{API_URL}</Text>
        </Card>

        <Button title={t("nav.signOut")} variant="danger" icon="log-out" onPress={() => signOut()} />
      </ScrollView>
    </Screen>
  );
}
