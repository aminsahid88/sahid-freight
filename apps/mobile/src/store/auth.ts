import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type UserRole = "CARGO_SENDER" | "TRUCK_OWNER" | "DRIVER" | "ADMIN";

export interface User {
  id: string;
  fullName: string;
  name?: string;
  companyName?: string;
  email?: string;
  phone: string;
  role: UserRole;
  status: string;
  isVerified: boolean;
  city?: string;
  country?: string;
  profilePhoto?: string;
  averageRating?: number;
  totalRatings?: number;
  preferredLanguage?: 'EN' | 'AM' | 'SO';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string | null, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    if (accessToken) await SecureStore.setItemAsync("accessToken", accessToken);
    if (refreshToken) await SecureStore.setItemAsync("refreshToken", refreshToken);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    set({ user, ...(accessToken ? { accessToken } : {}) });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("user");
    set({ user: null, accessToken: null });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync("accessToken");
      const stored = await SecureStore.getItemAsync("user");
      if (token && stored) {
        set({ user: JSON.parse(stored), accessToken: token });
      }
    } catch {}
    finally { set({ isLoading: false }); }
  },
}));
