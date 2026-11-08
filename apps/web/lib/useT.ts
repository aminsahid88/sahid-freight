"use client";
/**
 * Back-office translations: binds @tbo/i18n to the existing language setting.
 * Amharic (from the marketplace era) falls back to English for these screens.
 */
import { type Locale, LOCALES, t as translate, type Vars } from "@tbo/i18n";

/** Somali is translated but switched off for now (Amin, 2026-11-08). Flip to true to show the toggle again. */
export const SOMALI_ENABLED = false;
/** Locales the UI offers right now. */
export const AVAILABLE_LOCALES: readonly Locale[] = SOMALI_ENABLED ? LOCALES : (["en"] as const);
import { useSettingsStore } from "@/lib/store";

export type { Locale };

export function toLocale(language: string): Locale {
  if (!SOMALI_ENABLED) return "en";
  return (LOCALES as readonly string[]).includes(language) ? (language as Locale) : "en";
}

export function useT(): { t: (key: string, vars?: Vars) => string; locale: Locale; setLocale: (l: Locale) => void } {
  const { language, setLanguage } = useSettingsStore();
  const locale = toLocale(language);
  return {
    t: (key, vars) => translate(locale, key, vars),
    locale,
    setLocale: (l) => setLanguage(l),
  };
}
