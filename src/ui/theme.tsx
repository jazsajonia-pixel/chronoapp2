import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { safeStorage } from "@/lib/storage";

/** Same design tokens as the website's index.css (HSL), dark mode first. */
type Hsl = [number, number, number];
const LIGHT = {
  background: [0, 0, 99], surface: [220, 20, 97], surface2: [220, 16, 93], border: [220, 13, 87], foreground: [222, 24, 10],
  muted: [220, 14, 93], mutedForeground: [220, 9, 38], primary: [214, 92, 48], primaryForeground: [0, 0, 100], danger: [0, 70, 46],
  warning: [32, 92, 38], success: [186, 88, 42], ring: [190, 95, 45], sidebar: [220, 22, 96], diffAdd: [145, 60, 40], diffDel: [0, 70, 50],
} satisfies Record<string, Hsl>;
const DARK: typeof LIGHT = {
  background: [222, 42, 7], surface: [222, 34, 11], surface2: [221, 30, 16], border: [218, 24, 22], foreground: [210, 20, 95],
  muted: [220, 10, 15], mutedForeground: [218, 11, 64], primary: [198, 96, 58], primaryForeground: [220, 45, 8], danger: [0, 78, 64],
  warning: [38, 92, 60], success: [185, 90, 54], ring: [190, 95, 62], sidebar: [224, 46, 6], diffAdd: [145, 55, 50], diffDel: [0, 75, 62],
};

export type Theme = "dark" | "light";
export type ColorName = keyof typeof LIGHT;

export interface Palette {
  /** Solid colour. */
  c: Record<ColorName, string>;
  /** Colour with alpha, e.g. a("primary", 0.1) — like `bg-primary/10` on the web. */
  a: (name: ColorName, alpha: number) => string;
  dark: boolean;
}

function palette(theme: Theme): Palette {
  const src = theme === "dark" ? DARK : LIGHT;
  const c = Object.fromEntries(Object.entries(src).map(([k, [h, s, l]]) => [k, `hsl(${h}, ${s}%, ${l}%)`])) as Record<ColorName, string>;
  return { c, a: (n, alpha) => `hsla(${src[n][0]}, ${src[n][1]}%, ${src[n][2]}%, ${alpha})`, dark: theme === "dark" };
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
