import { create } from "zustand";

export interface SessionUser {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
  country?: string;
}

interface AuthStore {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: SessionUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

function read(key: string): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function readUser(): SessionUser | null {
  const raw = read("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: readUser(),
  accessToken: read("accessToken"),
  refreshToken: read("refreshToken"),
  setAuth: (user, accessToken, refreshToken) => {
    try {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
    } catch {
      /* private mode */
    }
    set({ user, accessToken, refreshToken });
  },
  logout: () => {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    } catch {
      /* private mode */
    }
    set({ user: null, accessToken: null, refreshToken: null });
    window.location.href = "/auth/sign-in";
  },
}));

export type Language = "en" | "so";
export type Theme = "light" | "dark";

interface SettingsStore {
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  language: read("language") === "so" ? "so" : "en",
  theme: read("theme") === "dark" ? "dark" : "light",
  setLanguage: (language) => {
    try {
      localStorage.setItem("language", language);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("lang", language);
    set({ language });
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));
