/**
 * My submissions: what is still on the phone (queue) and what the server has,
 * each with a plain status. Drivers see only their own uploads (the API scopes it).
 */
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { backoffice, type DocumentRow } from "../lib/backoffice";
import { useT } from "../lib/i18n";
import { useQueue } from "../lib/queue";
import type { QueueItem } from "../lib/queue-logic";
import { useSettingsStore } from "../store/settings";
import { DOCUMENT_TONES, EmptyState, Pill, QUEUE_TONES, Screen, Title, useTheme } from "../components/ui";
import { font, radius, space } from "../theme";

type Row = { kind: "queue"; item: QueueItem } | { kind: "server"; doc: DocumentRow };

export default function SubmissionsScreen() {
  const { t, locale } = useT();
  const theme = useTheme();
  const companyId = useSettingsStore((s) => s.companyId);
  const queue = useQueue((s) => s.items);
  const retry = useQueue((s) => s.retry);
  const remove = useQueue((s) => s.remove);
  const processQueue = useQueue((s) => s.process);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      setDocs(await backoffice.documents(companyId));
      setError("");
    } catch {
      setError(t("common.error"));
    }
  }, [companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await processQueue();
    await load();
    setRefreshing(false);
  };

  const local = queue.filter((i) => i.companyId === companyId && i.status !== "done");
  const rows: Row[] = [...local.map((item) => ({ kind: "queue" as const, item })), ...docs.map((doc) => ({ kind: "server" as const, doc }))];
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale === "so" ? "so" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Title sub={t("submissions.subtitle")}>{t("submissions.title")}</Title>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === "queue" ? `q-${r.item.id}` : `s-${r.doc.id}`)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 32, gap: 8 }}
        ListHeaderComponent={error ? <Text style={{ fontFamily: font.regular, color: theme.danger, marginBottom: 8 }}>{error}</Text> : null}
        ListEmptyComponent={<EmptyState icon="inbox" title={t("submissions.empty")} body={t("submissions.emptyHint")} />}
        renderItem={({ item: row }) => {
          if (row.kind === "queue") {
            const q = row.item;
            return (
              <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg, padding: 12, gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: theme.text }}>{t("submissions.onThisPhone")}</Text>
                  <Pill label={t(`queueStatus.${q.status}`)} tone={QUEUE_TONES[q.status] ?? "grey"} />
                </View>
                <Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.textMuted }}>{fmt(q.createdAt)} · {Math.round(q.bytes / 1024)} KB{q.lastError ? ` · ${q.lastError}` : ""}</Text>
                {q.status === "rejected" || q.status === "pending" ? (
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 2 }}>
                    <Pressable accessibilityRole="button" onPress={() => retry(q.id)} style={{ flexDirection: "row", gap: 6, alignItems: "center", minHeight: 36 }}>
                      <Feather name="refresh-cw" size={14} color={theme.accent} />
                      <Text style={{ fontFamily: font.bold, fontSize: 13, color: theme.accent }}>{t("submissions.retry")}</Text>
                    </Pressable>
                    {q.status === "rejected" ? (
                      <Pressable accessibilityRole="button" onPress={() => remove(q.id)} style={{ flexDirection: "row", gap: 6, alignItems: "center", minHeight: 36 }}>
                        <Feather name="trash-2" size={14} color={theme.textSecondary} />
                        <Text style={{ fontFamily: font.bold, fontSize: 13, color: theme.textSecondary }}>{t("submissions.discard")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }
          const d = row.doc;
          const tx = d.regions?.find((r) => r.transaction)?.transaction ?? null;
          const needsTruck = d.issues.some((i) => i.code === "S001");
          return (
            <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg, padding: 12, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: theme.text, flex: 1 }} numberOfLines={1}>{tx?.vendor ?? d.filename}</Text>
                <Pill label={tx ? t(`txStatus.${tx.status}`) : t(`docStatus.${d.status}`)} tone={tx ? (tx.status === "VERIFIED" ? "green" : tx.status === "NEEDS_ATTENTION" ? "amber" : "red") : (DOCUMENT_TONES[d.status] ?? "grey")} />
              </View>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.textMuted }}>
                {fmt(d.receivedAt)}
                {tx?.receiptTotal ? ` · $${Number(tx.receiptTotal).toFixed(2)}` : ""}
                {d.isExactDuplicateOf ? ` · ${t("inbox.duplicate")}` : ""}
              </Text>
              {needsTruck ? <Text style={{ fontFamily: font.semibold, fontSize: 12, color: theme.warning }}>{t("submissions.needsTruck")}</Text> : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}
