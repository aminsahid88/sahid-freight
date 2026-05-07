import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { darkTheme, lightTheme, Theme } from '../theme'

interface ThemeState {
  isDark: boolean
  theme: Theme
  toggleTheme: () => Promise<void>
  loadTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true,
  theme: darkTheme,

  toggleTheme: async () => {
    const next = !get().isDark
    await SecureStore.setItemAsync('theme_mode', next ? 'dark' : 'light')
    set({ isDark: next, theme: next ? darkTheme : lightTheme })
  },

  loadTheme: async () => {
    try {
      const saved = await SecureStore.getItemAsync('theme_mode')
      const isDark = saved !== 'light'
      set({ isDark, theme: isDark ? darkTheme : lightTheme })
    } catch {
      // default dark
    }
  },
}))
