import { useThemeStore } from '../store/themeStore'

export function useTheme() {
  const { theme } = useThemeStore()
  return theme
}
