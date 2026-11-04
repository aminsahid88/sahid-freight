/**
 * API client. Base URL from EXPO_PUBLIC_API_URL (set it to http://<your-lan-ip>:8000
 * for local development); production default otherwise. Tokens live in
 * SecureStore; a 401 triggers one refresh, then signs out.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://sahid-freight-production.up.railway.app").replace(/\/$/, "");

export const TOKEN_KEYS = { access: "accessToken", refresh: "refreshToken", user: "user" } as const;

const api = axios.create({ baseURL: API_URL, timeout: 30000, headers: { "x-channel": "MOBILE" } });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEYS.access);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;
let onSignedOut: (() => void) | null = null;
/** The auth store registers its sign-out so the interceptor never imports the store (no cycle). */
export function setSignedOutHandler(fn: () => void): void {
  onSignedOut = fn;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync(TOKEN_KEYS.refresh);
  if (!refresh) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh }, { timeout: 15000 });
    const token = res.data?.accessToken as string | undefined;
    if (!token) return null;
    await SecureStore.setItemAsync(TOKEN_KEYS.access, token);
    return token;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      await SecureStore.deleteItemAsync(TOKEN_KEYS.access);
      await SecureStore.deleteItemAsync(TOKEN_KEYS.refresh);
      onSignedOut?.();
    }
    return Promise.reject(error);
  },
);

/** True when the request never reached the server (offline, DNS, timeout). */
export function isNetworkError(err: unknown): boolean {
  const e = err as AxiosError | undefined;
  return !!e && !e.response && (e.code === "ERR_NETWORK" || e.code === "ECONNABORTED" || /network|timeout/i.test(e.message ?? ""));
}

export default api;
