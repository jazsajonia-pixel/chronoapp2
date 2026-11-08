import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { safeStorage } from "@/lib/storage";

/**
 * Ember on Ink — Chrono's semantic colour tokens (hex). Ember is the single brand accent; Mint is
 * reserved for positive status and added lines, Coral for errors and removed lines. Light mode
 * swaps Ink for Paper and uses Ember Deep for accent text and buttons to keep 4.5:1 contrast.
 * `primaryText` is the accent for small text: Ember in dark mode, a step deeper than Ember Deep on Paper
 * (≥4.5:1 on every light surface). The editor WebView mirrors these values in editor/vars.css.
 */
export const BRAND = {
  ink: "#0B0D12",
  surface: "#14181F",
  raised: "#1C222B",
  ember: "#FF7A3C",
  mint: "#3DDC97",
  coral: "#FF5C6C",
  paper: "#FAF8F5",
  emberDeep: "#C94A12",
} as const;

type Tokens = Record<
  | "background" | "surface" | "surface2" | "border" | "foreground" | "muted" | "mutedForeground" | "primary" | "primaryText" | "primaryForeground"
  | "danger" | "warning" | "success" | "ring" | "sidebar" | "diffAdd" | "diffDel",
  string
>;

const DARK: Tokens = {
  background: BRAND.ink, surface: BRAND.surface, surface2: BRAND.raised, border: "#2A313C", foreground: "#ECEEF2",
  muted: "#181D25", mutedForeground: "#98A1B0", primary: BRAND.ember, primaryText: BRAND.ember, primaryForeground: BRAND.ink, danger: BRAND.coral,
  warning: "#F2B84B", success: BRAND.mint, ring: BRAND.ember, sidebar: "#0F1218", diffAdd: BRAND.mint, diffDel: BRAND.coral,
};
const LIGHT: Tokens = {
  background: BRAND.paper, surface: "#F3F0EB", surface2: "#EAE6E0", border: "#DCD7CF", foreground: "#14181F",
  muted: "#EEEAE4", mutedForeground: "#596070", primary: BRAND.emberDeep, primaryText: "#B5420F", primaryForeground: "#FFFFFF", danger: "#C42B3B",
  warning: "#8A5600", success: "#0D7A4B", ring: BRAND.emberDeep, sidebar: "#F3F0EB", diffAdd: "#0D7A4B", diffDel: "#C42B3B",
};

export type Theme = "dark" | "light";
export type ColorName = keyof Tokens;

export interface Palette {
  /** Solid colour. */
  c: Record<ColorName, string>;
  /** Colour with alpha, e.g. a("primary", 0.1) — like `bg-primary/10` on the web. */
  a: (name: ColorName, alpha: number) => string;
  dark: boolean;
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function palette(theme: Theme): Palette {
  const c = theme === "dark" ? DARK : LIGHT;
  return { c, a: (n, alpha) => rgba(c[n], alpha), dark: theme === "dark" };
}

export const FONT = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
};

export const RADIUS = { sm: 6, md: 8, lg: 12, xl: 16 };

interface ThemeValue extends Palette {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (safeStorage.get("theme") === "light" ? "light" : "dark"));
  const setTheme = useCallback((t: Theme) => {
    safeStorage.set("theme", t);
    setThemeState(t);
  }, []);
  const value = useMemo<ThemeValue>(
    () => ({ ...palette(theme), theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") }),
    [theme, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  // Outside the provider (e.g. the root error boundary) fall back to the dark theme.
  return useContext(ThemeContext) ?? FALLBACK;
}

const FALLBACK: ThemeValue = { ...palette("dark"), theme: "dark", setTheme: () => {}, toggle: () => {} };
