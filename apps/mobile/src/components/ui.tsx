/**
 * Shared UI for the capture app. Large tap targets, one primary action per
 * screen, text labels next to every status colour.
 */
import React, { type ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, Text, TextInput, type TextInputProps, useColorScheme, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useSettingsStore } from "../store/settings";
import { darkTheme, font, lightTheme, radius, space, type Theme, touch } from "../theme";

export function useTheme(): Theme {
  const mode = useSettingsStore((s) => s.theme);
  const system = useColorScheme();
  const dark = mode === "dark" || (mode === "system" && system === "dark");
  return dark ? darkTheme : lightTheme;
}

export function Screen({ children, padded = true, scroll = false }: { children: ReactNode; padded?: boolean; scroll?: boolean }) {
  const t = useTheme();
  void scroll;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "left", "right"]}>
      <View style={{ flex: 1, paddingHorizontal: padded ? space.lg : 0 }}>{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: 26, letterSpacing: -0.5, color: t.text }}>{children}</Text>
      {sub ? <Text style={{ fontFamily: font.regular, fontSize: 14, color: t.textSecondary, marginTop: 4 }}>{sub}</Text> : null}
    </View>
  );
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ title, variant = "primary", loading, icon, size = "md", style, disabled, ...rest }: PressableProps & { title: string; variant?: ButtonVariant; loading?: boolean; icon?: keyof typeof Feather.glyphMap; size?: "md" | "lg"; style?: ViewStyle }) {
  const t = useTheme();
  const bg = variant === "primary" ? t.accent : variant === "danger" ? t.dangerDim : variant === "secondary" ? t.bg : "transparent";
  const fg = variant === "primary" ? t.onAccent : variant === "danger" ? t.danger : variant === "ghost" ? t.textSecondary : t.text;
  const border = variant === "secondary" || variant === "danger" ? t.border : "transparent";
  const height = size === "lg" ? touch.primary : touch.min;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      style={({ pressed }) => [{ height, borderRadius: radius.control, backgroundColor: bg, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 18, opacity: off ? 0.55 : pressed ? 0.85 : 1 }, style]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Feather name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: font.bold, fontSize: size === "lg" ? 16 : 15, color: fg }}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, error, hint, style, ...rest }: TextInputProps & { label?: string; error?: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontFamily: font.semibold, fontSize: 12, color: t.textSecondary }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.placeholder}
        style={[{ height: touch.min, borderRadius: radius.control, borderWidth: 1, borderColor: error ? t.danger : t.inputBorder, backgroundColor: t.inputBg, color: t.text, paddingHorizontal: 12, fontSize: 16, fontFamily: font.regular }, style]}
        {...rest}
      />
      {error ? <Text style={{ fontFamily: font.regular, fontSize: 12, color: t.danger }}>{error}</Text> : hint ? <Text style={{ fontFamily: font.regular, fontSize: 12, color: t.textMuted }}>{hint}</Text> : null}
    </View>
  );
}

export type Tone = "green" | "amber" | "red" | "grey" | "blue";

export function Pill({ label, tone }: { label: string; tone: Tone }) {
  const t = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    green: { bg: t.successDim, fg: t.success },
    amber: { bg: t.warningDim, fg: t.warning },
    red: { bg: t.dangerDim, fg: t.danger },
    grey: { bg: t.surface2, fg: t.textSecondary },
    blue: { bg: t.accentDim, fg: t.accent },
  };
  const c = map[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: t.border }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: c.fg }}>{label}</Text>
    </View>
  );
}

export const DOCUMENT_TONES: Record<string, Tone> = { RECEIVED: "blue", PROCESSING: "amber", PROCESSED: "green", FAILED: "red", UNREADABLE: "grey" };
export const QUEUE_TONES: Record<string, Tone> = { pending: "amber", uploading: "blue", done: "green", rejected: "red" };

export function Banner({ tone, title, children }: { tone: "info" | "success" | "warning" | "danger"; title?: string; children?: ReactNode }) {
  const t = useTheme();
  const colors = { info: { bg: t.accentDim, fg: t.text, icon: "info" as const }, success: { bg: t.successDim, fg: t.success, icon: "check-circle" as const }, warning: { bg: t.warningDim, fg: t.warning, icon: "alert-triangle" as const }, danger: { bg: t.dangerDim, fg: t.danger, icon: "x-circle" as const } }[tone];
  return (
    <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={{ flexDirection: "row", gap: 10, backgroundColor: colors.bg, borderRadius: radius.control, borderWidth: 1, borderColor: t.border, padding: 12 }}>
      <Feather name={colors.icon} size={16} color={colors.fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.fg }}>{title}</Text> : null}
        {typeof children === "string" ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: colors.fg }}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.bg, borderRadius: radius.card, borderWidth: 1, borderColor: t.border, padding: space.lg }, style]}>{children}</View>;
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Feather name={icon} size={20} color={t.textSecondary} />
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 15, color: t.text, textAlign: "center" }}>{title}</Text>
      {body ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: t.textSecondary, textAlign: "center", marginTop: 4 }}>{body}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
