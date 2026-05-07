export const darkTheme = {
  bg: '#0B0F0E',
  surface: 'rgba(255,255,255,0.04)',
  surface2: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  accent: '#97C459',
  accentDim: 'rgba(151,196,89,0.12)',
  accentBorder: 'rgba(151,196,89,0.25)',
  darkGreen: '#173404',
  lightGreen: '#C0DD97',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.45)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputText: '#FFFFFF',
  inputBorder: 'rgba(255,255,255,0.08)',
  inputPlaceholder: 'rgba(255,255,255,0.3)',
  danger: '#E24B4A',
  warning: '#EF9F27',
  warningLight: '#FAC775',
  blue: '#378ADD',
  blueLight: '#B5D4F4',
  tabBar: '#0B0F0E',
  tabBarBorder: 'rgba(255,255,255,0.06)',
}

export const lightTheme = {
  ...darkTheme,
}

export type Theme = typeof darkTheme

export const statusColors: Record<string, { bg: string; color: string }> = {
  OPEN:       { bg: 'rgba(151,196,89,0.12)',  color: '#97C459' },
  ACCEPTED:   { bg: 'rgba(55,138,221,0.12)',  color: '#378ADD' },
  IN_TRANSIT: { bg: 'rgba(239,159,39,0.12)',  color: '#EF9F27' },
  BOOKED:     { bg: 'rgba(55,138,221,0.12)',  color: '#378ADD' },
  DELIVERED:  { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' },
  COMPLETED:  { bg: 'rgba(151,196,89,0.12)',  color: '#97C459' },
  PENDING:    { bg: 'rgba(239,159,39,0.12)',  color: '#EF9F27' },
  CANCELLED:  { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A' },
  REJECTED:   { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A' },
  DRAFT:      { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' },
  ACTIVE:     { bg: 'rgba(151,196,89,0.12)',  color: '#97C459' },
}

export const theme = darkTheme
