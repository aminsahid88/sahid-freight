import type { Config } from "tailwindcss";

/**
 * Design tokens come from CSS variables in app/globals.css (light + dark), so
 * Tailwind classes like `bg-surface text-ink border-line` follow the theme.
 * bg-canvas = glass surfaces (cards, inputs); bg-surface = the page.
 */
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        "canvas-solid": "var(--bg-solid)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        ink: "var(--text)",
        "ink-2": "var(--text-secondary)",
        "ink-3": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-2": "var(--accent-2)",
        "accent-dim": "var(--accent-dim)",
        mint: "var(--mint)",
        navy: "var(--navy)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        sidebar: "var(--sidebar)",
        "sidebar-text": "var(--sidebar-text)",
        "sidebar-muted": "var(--sidebar-muted)",
        "sidebar-line": "var(--sidebar-border)",
        "sidebar-active": "var(--sidebar-active-bg)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "18px",
        control: "11px",
      },
      boxShadow: {
        card: "var(--card-shadow)",
        "card-hover": "var(--card-shadow-hover)",
        panel: "var(--panel-shadow)",
        dropdown: "var(--dropdown-shadow)",
        button: "var(--button-shadow)",
      },
      ringColor: {
        accent: "var(--accent-ring)",
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
