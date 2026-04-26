import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants";

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await AsyncStorage.getItem("accessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export const api = {
  get: <T = any>(path: string) => apiRequest<T>(path, { method: "GET" }),
  post: <T = any>(path: string, body: any) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T = any>(path: string, body: any) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = any>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};
