import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./app-layout";

vi.mock("../header/header", () => ({
  Header: ({ isSidebarOpen, onToggleSidebar }: { isSidebarOpen: boolean; onToggleSidebar: () => void }) => (
    <button aria-label={isSidebarOpen ? "Close menu" : "Open menu"} onClick={onToggleSidebar}>Menu</button>
  ),
}));
vi.mock("./sidebar", () => ({ Sidebar: () => <aside /> }));

afterEach(() => vi.unstubAllGlobals());

describe("AppLayout hydration", () => {
  it.each([375, 1280])("hydrates without menu markup mismatches at width %i", async (width) => {
    vi.stubGlobal("innerWidth", width);
    const content = <AppLayout><div>Tool content</div></AppLayout>;
    const container = document.createElement("div");
    container.innerHTML = renderToString(content);
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Open menu");
    document.body.append(container);
    const onRecoverableError = vi.fn();
    let root: Root | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, content, { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelector("button")?.getAttribute("aria-label")).toBe(width >= 768 ? "Close menu" : "Open menu");
      await act(async () => { container.querySelector("button")?.click(); });
      expect(container.querySelector("button")?.getAttribute("aria-label")).toBe(width >= 768 ? "Open menu" : "Close menu");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
