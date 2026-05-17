import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { Appearance } from 'react-native'
import { darkTheme, lightTheme, setActiveTheme, Theme } from '../theme'

type ThemeMode = 'light' | 'dark' | 'auto'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
  theme: Theme
  setMode: (mode: ThemeMode) => Promise<void>
  loadTheme: () => Promise<void>
}

function resolveTheme(mode: ThemeMode): { isDark: boolean; theme: Theme } {
  if (mode === 'auto') {
    const system = Appearance.getColorScheme()
    const isDark = system === 'dark'
    return { isDark, theme: isDark ? darkTheme : lightTheme }
  }
  const isDark = mode === 'dark'
  return { isDark, theme: isDark ? darkTheme : lightTheme }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  isDark: false,
  theme: lightTheme,

  setMode: async (mode: ThemeMode) => {
    await SecureStore.setItemAsync('theme_mode', mode)
    const { isDark, theme } = resolveTheme(mode)
    setActiveTheme(theme)
    set({ mode, isDark, theme })
  },

  loadTheme: async () => {
    try {
      const saved = await SecureStore.getItemAsync('theme_mode') as ThemeMode | null
      const mode = saved || 'light'
      const { isDark, theme } = resolveTheme(mode)
      setActiveTheme(theme)
      set({ mode, isDark, theme })
    } catch {
      setActiveTheme(lightTheme)
      set({ mode: 'light', isDark: false, theme: lightTheme })
    }
  },
}))
