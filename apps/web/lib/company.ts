/**
 * Selected company for the back-office screens. Persisted per browser so a
 * bookkeeper (partner) working several carriers keeps their place.
 */
import { create } from "zustand";
import { BREAK_GLASS_KEY, readBreakGlass } from "@/lib/api";
import type { CompanyRole, CompanySummary } from "@/lib/backoffice";

export interface SelectedCompany {
  company: CompanySummary;
  roles: CompanyRole[];
  /** Platform admin inside this company with a logged reason (no membership). */
  breakGlass?: { reason: string };
}

interface CompanyStore {
  selected: SelectedCompany | null;
  list: SelectedCompany[];
  loaded: boolean;
  setList: (list: SelectedCompany[]) => void;
  select: (id: string) => void;
  /** Platform admin enters a company they are not a member of. The reason is sent with every request and lands in that company's audit log. */
  enterBreakGlass: (company: CompanySummary, reason: string) => void;
  leaveBreakGlass: () => void;
}

const KEY = "backoffice.companyId";
const GLASS_COMPANY_KEY = "backoffice.breakGlassCompany";

function rememberedBreakGlass(): SelectedCompany | null {
  const glass = readBreakGlass();
  if (!glass) return null;
  try {
    const raw = sessionStorage.getItem(GLASS_COMPANY_KEY);
    const company = raw ? (JSON.parse(raw) as CompanySummary) : null;
    return company && company.id === glass.companyId ? { company, roles: ["ADMIN"], breakGlass: { reason: glass.reason } } : null;
  } catch {
    return null;
  }
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  selected: null,
  list: [],
  loaded: false,
  setList: (memberships) => {
    let remembered: string | null = null;
    try {
      remembered = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    } catch {
      remembered = null;
    }
    const glass = typeof window !== "undefined" ? rememberedBreakGlass() : null;
    const list = glass && !memberships.some((c) => c.company.id === glass.company.id) ? [...memberships, glass] : memberships;
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
  enterBreakGlass: (company, reason) => {
    const entry: SelectedCompany = { company, roles: ["ADMIN"], breakGlass: { reason } };
    try {
      sessionStorage.setItem(BREAK_GLASS_KEY, JSON.stringify({ companyId: company.id, reason }));
      sessionStorage.setItem(GLASS_COMPANY_KEY, JSON.stringify(company));
      localStorage.setItem(KEY, company.id);
    } catch {
      /* private mode: the entry lasts for this page load only */
    }
    const rest = get().list.filter((c) => !c.breakGlass && c.company.id !== company.id);
    set({ list: [...rest, entry], selected: entry });
  },
  leaveBreakGlass: () => {
    try {
      sessionStorage.removeItem(BREAK_GLASS_KEY);
      sessionStorage.removeItem(GLASS_COMPANY_KEY);
    } catch {
      /* ignore */
    }
    const list = get().list.filter((c) => !c.breakGlass);
    const selected = get().selected?.breakGlass ? (list[0] ?? null) : get().selected;
    if (selected) {
      try {
        localStorage.setItem(KEY, selected.company.id);
      } catch {
        /* ignore */
      }
    }
    set({ list, selected });
  },
}));

/** Highest role the user holds in the selected company. */
export function primaryRole(roles: CompanyRole[]): CompanyRole {
  const order: CompanyRole[] = ["OWNER", "ADMIN", "PARTNER", "REVIEWER", "STAFF", "DRIVER"];
  return order.find((r) => roles.includes(r)) ?? "STAFF";
}
