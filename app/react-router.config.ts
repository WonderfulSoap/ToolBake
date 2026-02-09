// Inject window and document objects globally for SSG/prerender builds
// Some third-party libraries (e.g., @waveform-playlist/ui-components, styled-components) 
// access window/document at module load time

// Mock Storage API (localStorage/sessionStorage) for SSG builds
class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

// Create storage instances first
const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

// Set up window object and attach storage immediately
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = globalThis;
}
// Ensure window has localStorage and sessionStorage
(globalThis as any).window.localStorage = mockLocalStorage;
(globalThis as any).window.sessionStorage = mockSessionStorage;

if (typeof globalThis.self === "undefined") {
  (globalThis as any).self = globalThis;
}

// Also inject directly into globalThis for compatibility
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;

// Mock DOM classes that some libraries expect to exist
class MockNode {
  nodeType = 1;
  nodeName = "";
  nodeValue = null;
  parentNode = null;
  childNodes: any[] = [];
  firstChild = null;
  lastChild = null;
  nextSibling = null;
  previousSibling = null;
  textContent = "";
  appendChild() { return this; }
  removeChild() { return this; }
  insertBefore() { return this; }
  replaceChild() { return this; }
  cloneNode() { return this; }
  contains() { return false; }
}

class MockElement extends MockNode {
  tagName = "";
  id = "";
  className = "";
  classList = {
    add     : () => {},
    remove  : () => {},
    contains: () => false,
    toggle  : () => false,
  };
  attributes: any = {};
  style     : any = {};
  innerHTML = "";
  outerHTML = "";
  setAttribute() {}
  getAttribute() { return null; }
  removeAttribute() {}
  hasAttribute() { return false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getElementsByTagName() { return []; }
  getElementsByClassName() { return []; }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

class MockHTMLElement extends MockElement {
  offsetWidth = 0;
  offsetHeight = 0;
  clientWidth = 0;
  clientHeight = 0;
  scrollWidth = 0;
  scrollHeight = 0;
  offsetTop = 0;
  offsetLeft = 0;
  scrollTop = 0;
  scrollLeft = 0;
}

// Inject DOM classes into global scope
if (typeof (globalThis as any).Node === "undefined") {
  (globalThis as any).Node = MockNode;
}
if (typeof (globalThis as any).Element === "undefined") {
  (globalThis as any).Element = MockElement;
}
if (typeof (globalThis as any).HTMLElement === "undefined") {
  (globalThis as any).HTMLElement = MockHTMLElement;
}

if (typeof globalThis.document === "undefined") {
  // Create a minimal but functional document mock for SSG builds
  const mockDocument = {
    body           : new MockHTMLElement(),
    documentElement: new MockHTMLElement(),
    head           : new MockHTMLElement(),
    createElement  : (tagName: string) => {
      const el = new MockHTMLElement();
      el.tagName = tagName.toUpperCase();
      return el;
    },
    createTextNode: (text: string) => {
      const node = new MockNode();
      node.textContent = text;
      node.nodeType = 3; // TEXT_NODE
      return node;
    },
    querySelector         : () => null,
    querySelectorAll      : () => [],
    getElementsByTagName  : () => [],
    getElementsByClassName: () => [],
    getElementById        : () => null,
    addEventListener      : () => {},
    removeEventListener   : () => {},
  };
  (globalThis as any).document = mockDocument;
}

import type { Config } from "@react-router/dev/config";
import { officialToolsMeta } from "./app/tools/official-tools-meta";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,

  // Static pre-rendering for SEO
  // Generate static HTML for all official tools at build time
  // Uses lightweight officialToolsMeta instead of full tool data to minimize build dependencies
  async prerender() {
    // Ensure globals are set up before prerender execution
    // This is needed because prerender may run in a separate process
    if (typeof globalThis.window === "undefined") {
      (globalThis as any).window = globalThis;
    }
    if (typeof (globalThis as any).window.localStorage === "undefined") {
      (globalThis as any).window.localStorage = mockLocalStorage;
    }
    if (typeof (globalThis as any).window.sessionStorage === "undefined") {
      (globalThis as any).window.sessionStorage = mockSessionStorage;
    }
    if (typeof (globalThis as any).localStorage === "undefined") {
      (globalThis as any).localStorage = mockLocalStorage;
    }
    if (typeof (globalThis as any).sessionStorage === "undefined") {
      (globalThis as any).sessionStorage = mockSessionStorage;
    }

    const urls: string[] = [
      "/", // Home page
      "/privacy-policy",
      "/terms-of-service",
    ];

    // Generate URLs for all official tools using lightweight meta
    for (const toolId of Object.keys(officialToolsMeta)) {
      urls.push(`/t/${toolId}`);
    }

    return urls;
  },
} satisfies Config;
