/**
 * Sahid Freight capture app — design tokens. Mirrors apps/web/app/globals.css:
 * Inter, restrained, one accent, status colours with text labels.
 */
export interface Theme {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  onAccent: string;
  navy: string;
  success: string;
  successDim: string;
  warning: string;
  warningDim: string;
  danger: string;
  dangerDim: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  tabBar: string;
  tabBarBorder: string;
  isDark: boolean;
}

export const lightTheme: Theme = {
  bg: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  border: "#E2E8F0",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  accent: "#2F6BFF",
  accentDim: "rgba(47,107,255,0.10)",
  onAccent: "#FFFFFF",
  navy: "#0A1F44",
  success: "#15803D",
  successDim: "#F0FDF4",
  warning: "#B45309",
  warningDim: "#FFFBEB",
  danger: "#B91C1C",
  dangerDim: "#FEF2F2",
  inputBg: "#FFFFFF",
  inputBorder: "#E2E8F0",
  placeholder: "#94A3B8",
  tabBar: "#FFFFFF",
  tabBarBorder: "#E2E8F0",
  isDark: false,
};

export const darkTheme: Theme = {
  bg: "#0B1220",
  surface: "#111A2B",
  surface2: "#1B2639",
  border: "#243044",
  text: "#F1F5F9",
  textSecondary: "#C3CDDB",
  textMuted: "#8A97AB",
  accent: "#5B8CFF",
  accentDim: "rgba(91,140,255,0.16)",
  onAccent: "#FFFFFF",
  navy: "#0A1F44",
  success: "#4ADE80",
  successDim: "rgba(74,222,128,0.12)",
  warning: "#FBBF24",
  warningDim: "rgba(251,191,36,0.12)",
  danger: "#F87171",
  dangerDim: "rgba(248,113,113,0.12)",
  inputBg: "#111A2B",
  inputBorder: "#243044",
  placeholder: "#64748B",
  tabBar: "#070D18",
  tabBarBorder: "rgba(241,245,249,0.06)",
  isDark: true,
};

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

export const radius = { card: 14, control: 10, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Touch targets: 44pt minimum (Apple), 48dp (Android). */
export const touch = { min: 48, primary: 56 } as const;
