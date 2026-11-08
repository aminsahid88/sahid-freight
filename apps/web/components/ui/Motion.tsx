"use client";
/**
 * Motion primitives (framer-motion). Entry motion only: short, eased, and off
 * under prefers-reduced-motion. Safe to use from server components.
 */
import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Fade and rise into place on mount (once). Mount-based rather than
 * viewport-based so content is never left invisible when an observer is slow.
 */
export function Reveal({ children, delay = 0, className = "", y = 14 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease, delay }}>
      {children}
    </motion.div>
  );
}

/** Children rise one after another. */
export function Stagger({ children, className = "", step = 0.06 }: { children: ReactNode; className?: string; step?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: step } } }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}>
      {children}
    </motion.div>
  );
}

/** Cross-fade between office pages. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
