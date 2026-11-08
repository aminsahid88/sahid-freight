"use client";
/**
 * First-run state for the signed-in user: whether the tour was finished and
 * whether the getting-started checklist was dismissed. Stored on the user
 * (PATCH /users/me {onboarding}) and mirrored in localStorage so the tour
 * never flashes twice on a slow connection.
 */
import { useSyncExternalStore } from "react";
import api from "@/lib/api";

export interface OnboardingState {
  tourDoneAt?: string | null;
  checklistDismissedAt?: string | null;
}

const KEY = "sf.onboarding";
const listeners = new Set<() => void>();
let cache: OnboardingState | null = null;
let fetched = false;

function readLocal(): OnboardingState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingState) : null;
  } catch {
    return null;
  }
}

function writeLocal(state: OnboardingState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

function emit() {
  for (const l of listeners) l();
}

export async function loadOnboarding(): Promise<OnboardingState> {
  if (cache) return cache;
  let state: OnboardingState = readLocal() ?? {};
  cache = state;
  emit();
  if (!fetched) {
    fetched = true;
    try {
      const { data } = await api.get<{ user?: { onboarding?: OnboardingState | null } } & { onboarding?: OnboardingState | null }>("/users/me");
      const server = data.user?.onboarding ?? data.onboarding ?? null;
      if (server) {
        state = { ...state, ...server };
        cache = state;
        writeLocal(state);
        emit();
      }
    } catch {
      /* offline or old API: local state stands */
    }
  }
  return state;
}

export async function updateOnboarding(patch: OnboardingState): Promise<void> {
  const next: OnboardingState = { ...(cache ?? readLocal() ?? {}), ...patch };
  cache = next;
  writeLocal(next);
  emit();
  try {
    await api.patch("/users/me", { onboarding: patch });
  } catch {
    /* keep the local copy; the next load retries nothing, the user already saw the tour */
  }
}

/** Clear the cached state (sign-out). */
export function resetOnboardingCache() {
  cache = null;
  fetched = false;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function useOnboarding(): OnboardingState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      void loadOnboarding();
      return () => listeners.delete(cb);
    },
    () => cache,
    () => null,
  );
}
