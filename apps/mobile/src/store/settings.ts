import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Locale } from "@tbo/i18n";

export type ThemeMode = "light" | "dark" | "system";

interface SettingsState {
  language: Locale;
  theme: ThemeMode;
  companyId: string | null;
  /** The truck pre-selected for new captures (driver's usual unit). */
  defaultVehicleId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (l: Locale) => void;
  setTheme: (t: ThemeMode) => void;
  setCompany: (id: string | null) => void;
  setDefaultVehicle: (id: string | null) => void;
}

const KEY = "settings.v1";

async function persist(partial: Partial<SettingsState>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const current = raw ? (JSON.parse(raw) as Partial<SettingsState>) : {};
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...partial }));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: "en",
  theme: "system",
  companyId: null,
  defaultVehicleId: null,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<SettingsState>) : {};
      set({
        language: saved.language === "so" ? "so" : "en",
        theme: saved.theme === "dark" || saved.theme === "light" ? saved.theme : "system",
        companyId: saved.companyId ?? null,
        defaultVehicleId: saved.defaultVehicleId ?? null,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
  setLanguage: (language) => {
    set({ language });
    void persist({ language });
  },
  setTheme: (theme) => {
    set({ theme });
    void persist({ theme });
  },
  setCompany: (companyId) => {
    set({ companyId });
    void persist({ companyId });
  },
  setDefaultVehicle: (defaultVehicleId) => {
    set({ defaultVehicleId });
    void persist({ defaultVehicleId });
  },
}));
