// ─────────────────────────────────────────────────────────
// Sahid Freight Design Tokens
// ─────────────────────────────────────────────────────────

export const lightTheme = {
  // Backgrounds
  bg: '#FFFFFF',
  surface: '#F8FAFC',
  surface2: '#F1F5F9',

  // Borders
  border: '#E2E8F0',

  // Text
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Primary action (blue)
  accent: '#2563EB',
  accentHover: '#1D4ED8',
  accentDim: 'rgba(37,99,235,0.08)',
  accentBorder: 'rgba(37,99,235,0.2)',
  accentText: '#FFFFFF',

  // Secondary / energy (orange)
  orange: '#F97316',
  orangeDim: 'rgba(249,115,22,0.08)',

  // Status
  success: '#16A34A',
  successDim: 'rgba(22,163,74,0.08)',
  warning: '#F59E0B',
  warningDim: 'rgba(245,158,11,0.08)',
  danger: '#DC2626',
  dangerDim: 'rgba(220,38,38,0.08)',
  blue: '#2563EB',
  blueDim: 'rgba(37,99,235,0.08)',

  // Legacy aliases (keep components working during migration)
  darkGreen: '#FFFFFF',
  lightGreen: '#2563EB',

  // Inputs
  inputBg: '#F8FAFC',
  inputText: '#0F172A',
  inputBorder: '#E2E8F0',
  inputPlaceholder: '#94A3B8',

  // Tab bar
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',

  // Shadows (light mode only)
  shadow: '0 1px 2px rgba(0,0,0,0.05)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.08)',
  shadowLg: '0 16px 48px rgba(0,0,0,0.12)',
}

export const darkTheme = {
  // Backgrounds
  bg: '#0F172A',
  surface: '#1E293B',
  surface2: '#334155',

  // Borders
  border: '#334155',

  // Text
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',

  // Primary action (blue — brighter for dark)
  accent: '#3B82F6',
  accentHover: '#2563EB',
  accentDim: 'rgba(59,130,246,0.12)',
  accentBorder: 'rgba(59,130,246,0.25)',
  accentText: '#FFFFFF',

  // Secondary / energy (orange)
  orange: '#FB923C',
  orangeDim: 'rgba(251,146,60,0.1)',

  // Status
  success: '#22C55E',
  successDim: 'rgba(34,197,94,0.1)',
  warning: '#FBBF24',
  warningDim: 'rgba(251,191,36,0.1)',
  danger: '#EF4444',
  dangerDim: 'rgba(239,68,68,0.1)',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.1)',

  // Legacy aliases
  darkGreen: '#0F172A',
  lightGreen: '#3B82F6',

  // Inputs
  inputBg: '#1E293B',
  inputText: '#F8FAFC',
  inputBorder: '#334155',
  inputPlaceholder: '#64748B',

  // Tab bar
  tabBar: '#0F172A',
  tabBarBorder: '#334155',

  // Shadows (not used in dark — rely on border)
  shadow: 'none',
  shadowMd: 'none',
  shadowLg: 'none',
}

export type Theme = typeof darkTheme

// Status badge colors (same for both themes)
export const statusColors: Record<string, { bg: string; color: string }> = {
  OPEN:       { bg: 'rgba(37,99,235,0.1)',   color: '#3B82F6' },
  ACCEPTED:   { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
  IN_TRANSIT: { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
  BOOKED:     { bg: 'rgba(37,99,235,0.1)',   color: '#3B82F6' },
  DELIVERED:  { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
  COMPLETED:  { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
  PENDING:    { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
  CANCELLED:  { bg: 'rgba(239,68,68,0.08)', color: '#EF4444' },
  REJECTED:   { bg: 'rgba(239,68,68,0.08)', color: '#EF4444' },
  DRAFT:      { bg: 'rgba(148,163,184,0.1)', color: '#94A3B8' },
  ACTIVE:     { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
}

// Default export — consumed by `import { theme } from '../theme'`
// This is updated dynamically by the theme store on load
export let theme: Theme = lightTheme

export function setActiveTheme(t: Theme) {
  // Mutate the module-level export so existing `import { theme }` refs update
  Object.assign(theme, t)
}
