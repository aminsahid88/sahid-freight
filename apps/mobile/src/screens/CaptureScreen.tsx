/**
 * Capture: the driver's main screen. Multi-shot camera, blur check before
 * sending, truck picker, and an offline queue so "Send" always succeeds.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { backoffice, type Vehicle } from "../lib/backoffice";
import { useT } from "../lib/i18n";
import { useQueue } from "../lib/queue";
import { sharpnessVerdict, type SharpnessVerdict } from "../lib/sharpness";
import { useSettingsStore } from "../store/settings";
import { Banner, Button, Pill, Screen, Title, useTheme } from "../components/ui";
import { font, radius, space, touch } from "../theme";

interface Shot {
  uri: string;
  width: number;
  height: number;
  bytes: number;
  verdict: SharpnessVerdict;
  tooSmall: boolean;
}

export default function CaptureScreen() {
  const { t } = useT();
  const theme = useTheme();
  const companyId = useSettingsStore((s) => s.companyId);
  const defaultVehicleId = useSettingsStore((s) => s.defaultVehicleId);
  const setDefaultVehicle = useSettingsStore((s) => s.setDefaultVehicle);
  const enqueue = useQueue((s) => s.enqueue);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(defaultVehicleId);
  const [taking, setTaking] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [mode, setMode] = useState<"camera" | "review">("camera");

  useEffect(() => {
    if (!companyId) return;
    backoffice
      .vehicles(companyId)
      .then((vs) => {
        setVehicles(vs);
        if (!vehicleId && vs.length === 1) setVehicleId(vs[0]!.id);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const addShot = useCallback(async (uri: string, width: number, height: number) => {
    const info = await FileSystem.getInfoAsync(uri);
    const bytes = info.exists && "size" in info ? (info.size ?? 0) : 0;
    const s = sharpnessVerdict({ bytes, width, height });
    setShots((prev) => [...prev, { uri, width, height, bytes, verdict: s.verdict, tooSmall: s.tooSmall }]);
    if (s.verdict === "blurry") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNotice({ tone: "warning", text: t("capture.blurry") });
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNotice(null);
    }
  }, [t]);

  const snap = async () => {
    if (!camera.current || taking) return;
    setTaking(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      if (photo) await addShot(photo.uri, photo.width, photo.height);
    } catch {
      setNotice({ tone: "danger", text: t("common.error") });
    } finally {
      setTaking(false);
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled) return;
    for (const a of res.assets) await addShot(a.uri, a.width ?? 0, a.height ?? 0);
    setMode("review");
  };

  const removeShot = (uri: string) => setShots((prev) => prev.filter((s) => s.uri !== uri));

  const send = async () => {
    if (!companyId || shots.length === 0) return;
    setSending(true);
    try {
      for (const [i, s] of shots.entries()) {
        await enqueue({ companyId, uri: s.uri, name: `receipt-${Date.now()}-${i + 1}.jpg`, mimeType: "image/jpeg", bytes: s.bytes, vehicleId });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice({ tone: "success", text: t("capture.queued", { count: shots.length }) });
      setShots([]);
      setMode("camera");
    } catch {
      setNotice({ tone: "danger", text: t("common.error") });
    } finally {
      setSending(false);
    }
  };

  if (!permission) return <Screen><View /></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Title sub={t("capture.permissionBody")}>{t("capture.permissionTitle")}</Title>
        <Button title={t("capture.allowCamera")} size="lg" onPress={() => requestPermission()} icon="camera" />
        <View style={{ height: space.md }} />
        <Button title={t("capture.chooseFromPhotos")} variant="secondary" onPress={pick} icon="image" />
      </Screen>
    );
  }

  const blurryCount = shots.filter((s) => s.verdict === "blurry").length;

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Title sub={t("capture.subtitle")}>{t("capture.title")}</Title>
      </View>

      {/* Truck picker: one tap, remembered. */}
      <FlatList
        horizontal
        data={vehicles}
        keyExtractor={(v) => v.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: 8, paddingBottom: space.md }}
        ListHeaderComponent={<Text style={{ fontFamily: font.semibold, fontSize: 12, color: theme.textSecondary, alignSelf: "center", marginRight: 4 }}>{t("capture.whichTruck")}</Text>}
        ListEmptyComponent={<Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.textMuted, alignSelf: "center" }}>{t("capture.noTrucks")}</Text>}
        renderItem={({ item }) => {
          const active = item.id === vehicleId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setVehicleId(item.id);
                setDefaultVehicle(item.id);
              }}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentDim : theme.bg, justifyContent: "center" }}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: active ? theme.accent : theme.textSecondary }}>#{item.unitNumber}</Text>
            </Pressable>
          );
        }}
      />

      {notice ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          <Banner tone={notice.tone}>{notice.text}</Banner>
        </View>
      ) : null}

      {mode === "camera" ? (
        <View style={{ flex: 1, marginHorizontal: space.lg, borderRadius: radius.card, overflow: "hidden", backgroundColor: "#000" }}>
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" autofocus="on" />
          <View style={{ position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("capture.chooseFromPhotos")} onPress={pick} style={{ width: touch.min, height: touch.min, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="image" size={20} color="#fff" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("capture.takePhoto")} onPress={snap} disabled={taking} style={{ width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", opacity: taking ? 0.5 : 1 }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" }} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("capture.review")} onPress={() => shots.length && setMode("review")} style={{ width: touch.min, height: touch.min, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              {shots.length ? (
                <View style={{ alignItems: "center" }}>
                  <Image source={{ uri: shots[shots.length - 1]!.uri }} style={{ width: 36, height: 36, borderRadius: 8 }} />
                  <View style={{ position: "absolute", top: -6, right: -8, backgroundColor: theme.accent, borderRadius: 10, minWidth: 20, paddingHorizontal: 5, alignItems: "center" }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 11, color: "#fff" }}>{shots.length}</Text>
                  </View>
                </View>
              ) : (
                <Feather name="layers" size={20} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={shots}
          keyExtractor={(s) => s.uri}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: 10, paddingBottom: 120 }}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: item.verdict === "blurry" ? theme.danger : theme.border, backgroundColor: theme.surface }}>
              <Image source={{ uri: item.uri }} style={{ width: "100%", aspectRatio: 3 / 4 }} />
              <View style={{ padding: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Pill label={item.verdict === "blurry" ? t("capture.blurryShort") : item.verdict === "borderline" ? t("capture.borderline") : t("capture.sharp")} tone={item.verdict === "blurry" ? "red" : item.verdict === "borderline" ? "amber" : "green"} />
                <Pressable accessibilityRole="button" accessibilityLabel={t("capture.remove")} onPress={() => removeShot(item.uri)} hitSlop={10}>
                  <Feather name="trash-2" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ fontFamily: font.regular, color: theme.textMuted, textAlign: "center", paddingVertical: 32 }}>{t("capture.noShots")}</Text>}
        />
      )}

      <View style={{ padding: space.lg, gap: 8, backgroundColor: theme.bg, borderTopWidth: 1, borderTopColor: theme.border }}>
        {mode === "review" ? (
          <>
            {blurryCount > 0 ? <Banner tone="warning">{t("capture.blurryWarning", { count: blurryCount })}</Banner> : null}
            <Button title={t("capture.send", { count: shots.length })} size="lg" icon="upload-cloud" loading={sending} disabled={shots.length === 0} onPress={send} />
            <Button title={t("capture.takeMore")} variant="secondary" icon="camera" onPress={() => setMode("camera")} />
          </>
        ) : (
          <Button title={shots.length ? t("capture.reviewAndSend", { count: shots.length }) : t("capture.hint")} variant={shots.length ? "primary" : "ghost"} size="lg" disabled={!shots.length} onPress={() => setMode("review")} />
        )}
      </View>
    </Screen>
  );
}
