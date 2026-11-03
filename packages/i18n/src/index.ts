/**
 * UI strings for the back-office platform. English is the source language;
 * Somali is a first draft pending review by a native speaker (see locales/README.md).
 *
 * Keys are dotted paths into the JSON files ("nav.inbox"). Interpolation uses
 * `{name}` placeholders. Missing keys fall back to English, then to the key
 * itself, so a missing translation never crashes a screen.
 */
import en from "../locales/en.json";
import so from "../locales/so.json";

export const LOCALES = ["en", "so"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", so: "Soomaali" };

type Dict = { [key: string]: string | Dict };
const dictionaries: Record<Locale, Dict> = { en: en as Dict, so: so as Dict };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export type Vars = Record<string, string | number>;

export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name];
    return v === undefined ? match : String(v);
  });
}

/** Translate a key for a locale. */
export function t(locale: Locale, key: string, vars?: Vars): string {
  const raw = lookup(dictionaries[locale], key) ?? lookup(dictionaries[DEFAULT_LOCALE], key) ?? key;
  return interpolate(raw, vars);
}

/** Bind a locale once: `const tr = translator("so"); tr("nav.inbox")`. */
export function translator(locale: Locale): (key: string, vars?: Vars) => string {
  return (key, vars) => t(locale, key, vars);
}

/** Flatten a dictionary into dotted keys (used by tests and tooling). */
export function flattenKeys(dict: Dict, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(dict)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push(key);
    else out.push(...flattenKeys(v, key));
  }
  return out.sort();
}

export function dictionary(locale: Locale): Dict {
  return dictionaries[locale];
}
