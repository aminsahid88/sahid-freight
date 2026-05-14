import axios from "axios";

const adminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("adminToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("adminUser");
        localStorage.removeItem("adminToken");
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;
