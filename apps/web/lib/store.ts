import { create } from "zustand";

interface User {
  email?: string;
  id: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  country: string;
  city: string;
  isVerified: boolean;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("user") || "null")
    : null,
  accessToken: typeof window !== "undefined"
    ? localStorage.getItem("accessToken")
    : null,
  refreshToken: typeof window !== "undefined"
    ? localStorage.getItem("refreshToken")
    : null,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    set({ user, accessToken, refreshToken });
  },

  logout: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null, accessToken: null, refreshToken: null });
    window.location.href = "/auth/login";
  },
}));

interface GateStore {
  showGate: boolean;
  openGate: () => void;
  closeGate: () => void;
}
export const useGateStore = create<GateStore>((set) => ({
  showGate: false,
  openGate: () => set({ showGate: true }),
  closeGate: () => set({ showGate: false }),
}));

interface SettingsStore {
  language: "en" | "am" | "so";
  theme: "light" | "dark";
  setLanguage: (lang: "en" | "am" | "so") => void;
  setTheme: (theme: "light" | "dark") => void;
}
export const useSettingsStore = create<SettingsStore>((set) => ({
  language: typeof window !== "undefined" ? (localStorage.getItem("language") as any) || "en" : "en",
  theme: typeof window !== "undefined" ? (localStorage.getItem("theme") as any) || "light" : "light",
  setLanguage: (language) => {
    localStorage.setItem("language", language);
    set({ language });
  },
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));
