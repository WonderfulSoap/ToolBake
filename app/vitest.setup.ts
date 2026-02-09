import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Provide Pointer Events API shims for Radix Select in JSDOM.
const noop = () => {};

// Mock ResizeObserver for Radix UI components (Slider, etc.)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = noop;
}

if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = noop;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = noop;
}

// Cleanup after each test to avoid DOM pollution
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
