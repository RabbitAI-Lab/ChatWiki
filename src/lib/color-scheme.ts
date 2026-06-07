/**
 * Color scheme utility module
 * Defines types, defaults, CSS variable mappings, and script generation
 * for the admin appearance settings feature.
 */

export type ColorKey =
  | "primaryBtn"
  | "primaryBtnHover"
  | "accent"
  | "sidebarBg"
  | "mainBg"
  | "foreground"
  | "background"
  | "senderBg";

export type ColorSchemeMode = {
  [K in ColorKey]: string;
};

export type ColorScheme = {
  light: ColorSchemeMode;
  dark: ColorSchemeMode;
};

/** Mapping from ColorKey to CSS variable name */
export const CSS_VAR_MAP: Record<ColorKey, string> = {
  primaryBtn: "--color-primary",
  primaryBtnHover: "--color-primary-hover",
  accent: "--marketing-accent",
  sidebarBg: "--sidebar-bg",
  mainBg: "--main-bg",
  foreground: "--foreground",
  background: "--background",
  senderBg: "--sender-bg",
};

/** Default color values matching globals.css */
export const DEFAULT_COLORS: ColorScheme = {
  light: {
    primaryBtn: "#3B82F6",
    primaryBtnHover: "#2563EB",
    accent: "#3B82F6",
    sidebarBg: "#ffffff",
    mainBg: "#f9fafb",
    foreground: "#171717",
    background: "#ffffff",
    senderBg: "#ffffff",
  },
  dark: {
    primaryBtn: "#60a5fa",
    primaryBtnHover: "#3B82F6",
    accent: "#60a5fa",
    sidebarBg: "#111113",
    mainBg: "#09090b",
    foreground: "#ededed",
    background: "#0a0a0a",
    senderBg: "transparent",
  },
};

/** All color keys in display order */
export const COLOR_KEYS: ColorKey[] = [
  "primaryBtn",
  "primaryBtnHover",
  "accent",
  "sidebarBg",
  "mainBg",
  "foreground",
  "background",
  "senderBg",
];

/**
 * Parse a stored color_scheme JSON string, merging with defaults.
 * Returns DEFAULT_COLORS if raw is null/empty or parsing fails.
 */
export function parseColorScheme(raw: string | null): ColorScheme {
  if (!raw) return { ...DEFAULT_COLORS };
  try {
    const parsed = JSON.parse(raw) as Partial<ColorScheme>;
    return {
      light: { ...DEFAULT_COLORS.light, ...parsed.light },
      dark: { ...DEFAULT_COLORS.dark, ...parsed.dark },
    };
  } catch {
    return { ...DEFAULT_COLORS };
  }
}

/**
 * Merge a partial color scheme patch into an existing scheme.
 * Used for PATCH requests that only update some fields.
 */
export function mergeColorScheme(
  existing: ColorScheme | null,
  patch: Partial<ColorScheme>
): ColorScheme {
  const base = existing ?? { ...DEFAULT_COLORS };
  return {
    light: { ...base.light, ...(patch.light ?? {}) },
    dark: { ...base.dark, ...(patch.dark ?? {}) },
  };
}

/**
 * Generate an inline script that synchronously applies CSS variables
 * to document.documentElement.style, preventing FOUC on initial load.
 *
 * Timing issue: this script renders BEFORE next-themes adds the 'dark'
 * class to <html>, so the initial read of classList may return false.
 * The script therefore:
 *   1. Applies colors immediately (best-guess based on current class)
 *   2. Installs a MutationObserver to re-apply when the class changes,
 *      guaranteeing correct values once next-themes finishes initializing.
 */
export function generateColorScript(scheme: ColorScheme): string {
  const keys = COLOR_KEYS;
  const varMap = CSS_VAR_MAP;

  const statements = keys
    .map((key) => {
      const varName = varMap[key];
      return `if(c.${key})r.setProperty('${varName}',c.${key});`;
    })
    .join("");

  return [
    "(function(){",
    "try{",
    "var s=", JSON.stringify(scheme), ";",
    "var r=document.documentElement.style;",
    "function a(){",
    "var d=document.documentElement.classList.contains('dark');",
    "var c=d?s.dark:s.light;",
    statements,
    "}",
    "a();",
    "new MutationObserver(a).observe(",
    "document.documentElement,",
    "{attributes:true,attributeFilter:['class']}",
    ");",
    "}catch(e){}",
    "})();",
  ].join("");
}

/**
 * Apply color scheme CSS variables dynamically based on the given mode.
 * Used by ThemeRoot's useEffect to update colors when theme switches.
 */
export function applyColorScheme(scheme: ColorScheme, isDark: boolean): void {
  const colors = isDark ? scheme.dark : scheme.light;
  const root = document.documentElement.style;
  for (const key of COLOR_KEYS) {
    const varName = CSS_VAR_MAP[key];
    const value = colors[key];
    if (value) {
      root.setProperty(varName, value);
    }
  }
}
