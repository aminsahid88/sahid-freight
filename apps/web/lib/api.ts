import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

/** Platform admin inside a company with a logged reason (see lib/company.ts). Session-only, never persisted across tabs. */
export const BREAK_GLASS_KEY = "backoffice.breakGlass";
export interface BreakGlassState {
  companyId: string;
  reason: string;
}
export function readBreakGlass(): BreakGlassState | null {
  try {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(BREAK_GLASS_KEY) : null;
    const v = raw ? (JSON.parse(raw) as BreakGlassState) : null;
    return v && typeof v.companyId === "string" && typeof v.reason === "string" ? v : null;
  } catch {
    return null;
  }
}

// Attach token to every request (and the break-glass reason on that company's routes)
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const glass = readBreakGlass();
    if (glass && (config.url ?? "").startsWith(`/companies/${glass.companyId}`)) config.headers["X-Break-Glass-Reason"] = glass.reason;
  }
  return config;
});

// Auto refresh token if expired
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem("accessToken", res.data.accessToken);
          error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return axios(error.config);
        } catch {
          localStorage.clear();
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
