import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeProvider, useThemeContext } from "./theme-context";

/** Exercise the public theme action rather than mutating the root directly. */
function ThemeControls() {
  const { theme, setTheme } = useThemeContext();
  return <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme}</button>;
}

afterEach(() => {
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

it("keeps the selected mode, root class, data attribute, and cookie in sync on a dark system", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(console, "info").mockImplementation(() => {});
  document.documentElement.dataset.theme = "dark";
  document.documentElement.className = "dark";
  render(<ThemeProvider><ThemeControls /></ThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "dark" }));
  expect(document.documentElement.classList.contains("light")).toBe(true);
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.cookie).toContain("toolbake-ui-theme=light");
  fireEvent.click(screen.getByRole("button", { name: "light" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.cookie).toContain("toolbake-ui-theme=dark");
});
