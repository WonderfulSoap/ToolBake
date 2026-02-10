import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ThemeMode = "dark" | "light";

type ThemePreset = {
  label       : string;
  description : string;
  previewColor: string;
};

export const themeColorPresets = {
  default: {
    label       : "Default",
    description : "Minimal neutral interface baseline",
    previewColor: "#171717",
  },
  indigo: {
    label       : "Indigo",
    description : "Balanced cool accent for focused work",
    previewColor: "oklch(65% 0.17 270)",
  },
  emerald: {
    label       : "Emerald",
    description : "Vibrant green tones inspired by terminals",
    previewColor: "oklch(70% 0.2 150)",
  },
  amber: {
    label       : "Amber",
    description : "Warm accent ideal for dashboards",
    previewColor: "oklch(80% 0.17 80)",
  },
  rose: {
    label       : "Rose",
    description : "Playful yet bold for expressive tooling",
    previewColor: "oklch(70% 0.23 20)",
  },
  "quantum-rose": {
    label       : "Quantum Rose",
    description : "Neon rose glow with dreamy contrast",
    previewColor: "#e6067a",
  },
  claymorphism: {
    label       : "Claymorphism",
    description : "Soft clay surfaces with cool violet accents",
    previewColor: "#6366f1",
  },
  sunset: {
    label       : "Sunset",
    description : "Soft peach tones with cozy contrast",
    previewColor: "#ff7e5f",
  },
  clay: {
    label       : "Clay",
    description : "Earthy neutrals with soft vintage warmth",
    previewColor: "#a37764",
  },
  harbor: {
    label       : "Harbor",
    description : "Nautical blues with warm brass accents",
    previewColor: "#3a5ba0",
  },
  studio: {
    label       : "Studio",
    description : "High-contrast modern palette with bold accents",
    previewColor: "#4f46e5",
  },
  solarized: {
    label       : "Solarized",
    description : "Solarized-inspired palette with warm neutrals",
    previewColor: "#d33682",
  },
  tweakcn: {
    label       : "TweakCN",
    description : "Handcrafted artisan palette with typography tweaks",
    previewColor: "#b45309",
  },
} as const satisfies Record<string, ThemePreset>;

// Theme is explicitly limited to light/dark (no system mode).
type Theme = ThemeMode;
export type ThemeColor = keyof typeof themeColorPresets;

type ThemeProviderProps = {
  children        : React.ReactNode;
  storageKey?     : string;
  colorStorageKey?: string;
};

// Cookie helper functions for theme persistence (auto-sent to backend)
function getCookie(name: string): string | null {
  if (typeof document === "undefined" || !document.cookie) return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

type ThemeProviderState = {
  theme        : Theme;
  setTheme     : (theme: Theme) => void;
  themeColor   : ThemeColor | undefined;
  setThemeColor: (themeColor: ThemeColor | undefined) => void;
};

const initialState: ThemeProviderState = {
  theme        : "light",
  setTheme     : () => null,
  themeColor   : undefined,
  setThemeColor: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getThemeColorClass(themeColor: ThemeColor) {
  return `theme-color-${themeColor}`;
}

export function ThemeProvider({
  children,
  storageKey = "toolbake-ui-theme",
  colorStorageKey,
  ...props
}: ThemeProviderProps) {
  const resolvedColorStorageKey =
    colorStorageKey ?? `${storageKey}-color-option`;

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      console.log("[ThemeProvider] because window not defined, set theme to light");
      return "light";
    }
    // Read theme mode from html data attributes to avoid hydration flash.
    const htmlTheme = document.documentElement?.dataset?.theme as Theme || "light";
    console.log("[ThemeProvider] htmlTheme: ", htmlTheme);
    return htmlTheme;
  });

  const [themeColor, setThemeColorState] = useState<ThemeColor | undefined>(() => {
    if (typeof window === "undefined") {
      console.log("[ThemeProvider] because window not defined, set theme color to undefined");
      return undefined;
    }
    // Prefer server-rendered data-theme-color to avoid a flash before hydration.
    const htmlThemeColor = document.documentElement?.dataset?.themeColor as ThemeColor | undefined;
    const cookieThemeColor = getCookie(resolvedColorStorageKey) as ThemeColor | undefined;
    if (import.meta.env.DEV) {
      console.log("[ThemeProvider] init themeColor", {htmlThemeColor, cookieThemeColor, resolvedColorStorageKey});
    }
    return htmlThemeColor || cookieThemeColor;
  });

  const transitionResetRef = useRef<number | null>(null);

  function disableThemeTransitions() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    if (transitionResetRef.current !== null) {
      cancelAnimationFrame(transitionResetRef.current);
      transitionResetRef.current = null;
    }
    // Use double rAF to ensure the class takes effect before we remove it.
    transitionResetRef.current = requestAnimationFrame(() => {
      transitionResetRef.current = requestAnimationFrame(() => {
        root.classList.remove("theme-switching");
        transitionResetRef.current = null;
      });
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    // Always apply the explicit theme mode without system fallbacks.
    const applyTheme = (nextTheme: ThemeMode) => {
      disableThemeTransitions();
      root.classList.remove("light", "dark");
      root.classList.add(nextTheme);
    };

    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    disableThemeTransitions();
    const root = document.documentElement;
    const nextThemeColorClass = themeColor ? getThemeColorClass(themeColor) : undefined;
    if (import.meta.env.DEV) {
      console.log("[ThemeProvider] apply themeColor", {
        themeColor,
        htmlThemeColor: root.dataset.themeColor,
        nextThemeColorClass,
      });
    }
    // Apply the theme color class by name to let CSS handle token overrides.
    Object.keys(themeColorPresets).forEach((preset) => {
      root.classList.remove(getThemeColorClass(preset as ThemeColor));
    });
    if (!themeColor) {
      // Reset theme color data when no value is resolved yet.
      delete root.dataset.themeColor;
      return;
    }
    root.classList.add(nextThemeColorClass!);
    root.dataset.themeColor = themeColor;
  }, [themeColor]);

  const value = {
    theme,
    setTheme: (nextTheme: Theme) => {
      setCookie(storageKey, nextTheme);
      setThemeState(nextTheme);
    },
    themeColor,
    setThemeColor: (nextThemeColor: ThemeColor | undefined) => {
      if (!nextThemeColor) {
        setCookie(resolvedColorStorageKey, "");
        setThemeColorState(undefined);
        return;
      }
      setCookie(resolvedColorStorageKey, nextThemeColor);
      setThemeColorState(nextThemeColor);
    },
  };

  return (
    <ThemeProviderContext {...props} value={value}>
      {children}
    </ThemeProviderContext>
  );
}

export const useThemeContext = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
