/**
 * Strings come from the shared @tbo/i18n package (English + Somali), the same
 * dictionary the web uses, so a driver and an owner read the same words.
 */
import { t as translate, type Locale, LOCALES, type Vars } from "@tbo/i18n";
import { useSettingsStore } from "../store/settings";

export type { Locale };
export { LOCALES };

export function useT(): { t: (key: string, vars?: Vars) => string; locale: Locale } {
  const locale = useSettingsStore((s) => s.language);
  return { t: (key, vars) => translate(locale, key, vars), locale };
}

export function tr(locale: Locale, key: string, vars?: Vars): string {
  return translate(locale, key, vars);
}
