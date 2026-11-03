/**
 * Selected company for the back-office screens. Persisted per browser so a
 * bookkeeper (partner) working several carriers keeps their place.
 */
import { create } from "zustand";
import type { CompanyRole, CompanySummary } from "@/lib/backoffice";

export interface SelectedCompany {
  company: CompanySummary;
  roles: CompanyRole[];
}

interface CompanyStore {
  selected: SelectedCompany | null;
  list: SelectedCompany[];
  loaded: boolean;
  setList: (list: SelectedCompany[]) => void;
  select: (id: string) => void;
}

const KEY = "backoffice.companyId";

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  selected: null,
  list: [],
  loaded: false,
  setList: (list) => {
    let remembered: string | null = null;
    try {
      remembered = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    } catch {
      remembered = null;
    }
    const selected = list.find((c) => c.company.id === remembered) ?? list[0] ?? null;
    set({ list, selected, loaded: true });
  },
  select: (id) => {
    const found = get().list.find((c) => c.company.id === id) ?? null;
    if (found) {
      try {
        localStorage.setItem(KEY, id);
      } catch {
        /* private mode: selection just won't persist */
      }
    }
    set({ selected: found });
  },
}));

/** Highest role the user holds in the selected company. */
export function primaryRole(roles: CompanyRole[]): CompanyRole {
  const order: CompanyRole[] = ["OWNER", "ADMIN", "PARTNER", "REVIEWER", "STAFF", "DRIVER"];
  return order.find((r) => roles.includes(r)) ?? "STAFF";
}
