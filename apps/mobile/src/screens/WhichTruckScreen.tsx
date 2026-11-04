/**
 * "Which truck?" — receipts the checks could not attribute to a unit. One
 * tap per receipt; the answer is recorded as a correction with the driver's
 * name on it, and the open issue is closed with a note.
 */
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { backoffice, formatMoney, type IssueRow, type Vehicle } from "../lib/backoffice";
import { useT } from "../lib/i18n";
import { useSettingsStore } from "../store/settings";
import { Banner, EmptyState, Screen, Title, useTheme } from "../components/ui";
import { font, radius, space } from "../theme";

export default function WhichTruckScreen() {
  const { t, locale } = useT();
  const theme = useTheme();
  const companyId = useSettingsStore((s) => s.companyId);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const [is, vs] = await Promise.all([backoffice.whichTruckIssues(companyId), backoffice.vehicles(companyId)]);
      setIssues(is);
      setVehicles(vs);
      setError("");
    } catch {
      setError(t("common.error"));
    }
  }, [companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (issue: IssueRow, vehicleId: string) => {
    if (!companyId || !issue.transaction) return;
    setBusy(issue.id);
    try {
      await backoffice.setTruck(companyId, issue.transaction.id, vehicleId);
      await backoffice.resolveIssue(companyId, issue.id, "Truck chosen by the driver in the app").catch(() => undefined);
      setIssues((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const fmtDate = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(locale === "so" ? "so" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—");

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Title sub={t("whichTruck.subtitle")}>{t("whichTruck.title")}</Title>
        {error ? <View style={{ marginBottom: space.md }}><Banner tone="danger">{error}</Banner></View> : null}
      </View>
      <FlatList
        data={issues}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.accent} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 32, gap: 10 }}
        ListEmptyComponent={<EmptyState icon="check-circle" title={t("whichTruck.empty")} body={t("whichTruck.emptyHint")} />}
        renderItem={({ item }) => (
          <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg, padding: 14, gap: 10, opacity: busy === item.id ? 0.6 : 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: theme.text }}>{item.transaction?.vendor ?? item.document?.filename ?? "—"}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: theme.textSecondary }}>{fmtDate(item.transaction?.date ?? null)} · {formatMoney(item.transaction?.receiptTotal)}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: theme.textSecondary }}>{t("messages.whichTruck")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {vehicles.map((v) => (
                <Pressable key={v.id} accessibilityRole="button" disabled={busy === item.id} onPress={() => answer(item, v.id)} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.accent, backgroundColor: theme.accentDim, justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: theme.accent }}>#{v.unitNumber}</Text>
                </Pressable>
              ))}
              {vehicles.length === 0 ? <Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.textMuted }}>{t("capture.noTrucks")}</Text> : null}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
