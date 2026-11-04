import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import api, { setSignedOutHandler, TOKEN_KEYS } from "../lib/api";

export interface SessionUser {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: string;
}

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
  load: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,

  load: async () => {
    try {
      const [token, raw] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEYS.access), SecureStore.getItemAsync(TOKEN_KEYS.user)]);
      set({ user: token && raw ? (JSON.parse(raw) as SessionUser) : null, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },

  signIn: async (identifier, password) => {
    const res = await api.post("/auth/login", { identifier: identifier.trim(), password });
    const user: SessionUser = { id: res.data.user.id, fullName: res.data.user.fullName, email: res.data.user.email, phone: res.data.user.phone, role: res.data.user.role };
    await SecureStore.setItemAsync(TOKEN_KEYS.access, res.data.accessToken);
    await SecureStore.setItemAsync(TOKEN_KEYS.refresh, res.data.refreshToken);
    await SecureStore.setItemAsync(TOKEN_KEYS.user, JSON.stringify(user));
    set({ user });
  },

  signOut: async () => {
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEYS.access), SecureStore.deleteItemAsync(TOKEN_KEYS.refresh), SecureStore.deleteItemAsync(TOKEN_KEYS.user)]);
    set({ user: null });
  },
}));

setSignedOutHandler(() => useAuthStore.setState({ user: null }));
