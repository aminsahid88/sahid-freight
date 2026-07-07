"use client";

/**
 * SSR-safe breakpoint hooks. Server-side the app renders assuming DESKTOP
 * (matches Next.js prerendered static pages), and swaps to the correct
 * breakpoint on mount via matchMedia.
 *
 * Consistent breakpoints used across the app:
 *   sm  <= 640px   — phone
 *   md  <= 900px   — small tablet / landscape phone
 *   lg  <= 1180px  — large tablet / small laptop
 *
 * Prefer CSS media queries (via <style jsx> or globals.css) when you're
 * only re-styling — these hooks are for when JS *behavior* changes:
 * toggling a mobile menu, choosing a scene variant, gating heavy work.
 */

import { useEffect, useState } from "react";

type BpQuery =
  | "(max-width: 640px)"       // sm — phones
  | "(max-width: 900px)"       // md — small tablets / landscape phones
  | "(max-width: 1180px)"      // lg — large tablets
  | "(prefers-reduced-motion: reduce)"
  | "(hover: none) and (pointer: coarse)"; // "no hover" touch device

function useMediaQuery(query: BpQuery, ssrValue: boolean = false): boolean {
  const [matches, setMatches] = useState<boolean>(ssrValue);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Safari <14 uses addListener; modern browsers use addEventListener
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [query]);

  return matches;
}

/** True on phone-sized viewports (≤640px). SSR default: false (desktop). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 640px)", false);
}

/** True on small-tablet-and-below (≤900px). SSR default: false. */
export function useIsCompact(): boolean {
  return useMediaQuery("(max-width: 900px)", false);
}

/** True if the user asked for reduced motion. SSR default: false. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", false);
}

/** True on touch-only devices (no hover, coarse pointer). SSR default: false. */
export function useIsTouchDevice(): boolean {
  return useMediaQuery("(hover: none) and (pointer: coarse)", false);
}
