import { create } from "zustand";

interface AdminUser {
  id: string;
  fullName: string;
  email?: string;
  phone: string;
  role: string;
}

interface AdminAuthStore {
  admin: AdminUser | null;
  token: string | null;
  setAdminAuth: (admin: AdminUser, token: string) => void;
  adminLogout: () => void;
}

export const useAdminStore = create<AdminAuthStore>((set) => ({
  admin: typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("adminUser") || "null")
    : null,
  token: typeof window !== "undefined"
    ? localStorage.getItem("adminToken")
    : null,

  setAdminAuth: (admin, token) => {
    localStorage.setItem("adminUser", JSON.stringify(admin));
    localStorage.setItem("adminToken", token);
    set({ admin, token });
  },

  adminLogout: () => {
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminToken");
    set({ admin: null, token: null });
  },
}));
