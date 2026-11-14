/** Capture only theme-related state; never include unrelated cookies or user data. */
export function logThemeDebug(stage: string, details: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    console.info(`[ThemeDebug] ${stage}`, {
      timestamp: new Date().toISOString(),
      classes: root.className,
      dataTheme: root.dataset.theme,
      dataThemeColor: root.dataset.themeColor,
      systemDark: window.matchMedia?.("(prefers-color-scheme: dark)").matches,
      forcedColors: window.matchMedia?.("(forced-colors: active)").matches,
      backgroundToken: computed.getPropertyValue("--color-background").trim(),
      foregroundToken: computed.getPropertyValue("--color-foreground").trim(),
      colorScheme: computed.colorScheme,
      bodyBackground: document.body ? getComputedStyle(document.body).backgroundColor : undefined,
      bodyForeground: document.body ? getComputedStyle(document.body).color : undefined,
      ...details,
    });
  } catch (error) {
    // Diagnostics must not prevent theme switching in restricted browser environments.
    console.warn(`[ThemeDebug] ${stage}: snapshot unavailable`, error);
  }
}
