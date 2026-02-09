/**
 * Custom Monaco Editor imports for ESM mode with vite-plugin-monaco-editor-esm.
 * Uses dynamic import to ensure monaco-editor only loads on the client side,
 * avoiding CSS import errors during SSR.
 */

import type * as Monaco from "monaco-editor";

// Lazy-loaded monaco instance
let monacoInstance: typeof Monaco | null = null;
let loadingPromise: Promise<typeof Monaco> | null = null;

/**
 * Configure MonacoEnvironment to tell Monaco where to find worker files.
 * Must be called before Monaco is loaded.
 */
function setupMonacoEnvironment() {
  if (typeof window === "undefined") return;

  // Worker label to file mapping
  const workerPaths: Record<string, string> = {
    editorWorkerService: "editor.worker.js",
    typescript         : "ts.worker.js",
    javascript         : "ts.worker.js",
    json               : "json.worker.js",
  };

  (window as any).MonacoEnvironment = {
    getWorkerUrl(_moduleId: string, label: string): string {
      const filename = workerPaths[label] || "editor.worker.js";
      // In production, workers are in monacoeditorwork folder
      // In development, the plugin serves them via middleware
      return `/assets/monacoeditorwork/${filename}`;
    },
  };
}

/**
 * Inject Monaco CSS from the pre-built bundle (production only).
 * In dev, Vite handles CSS injection automatically.
 */
function injectMonacoCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-monaco-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/monacoeditorwork/monaco.css";
  link.setAttribute("data-monaco-css", "");
  document.head.appendChild(link);
}

/**
 * Dynamically load monaco-editor. Returns cached instance if already loaded.
 * This ensures monaco is only loaded in the browser, not during SSR.
 *
 * In production, Rollup externalizes "monaco-editor" and rewrites the import
 * to the pre-built ESM bundle via output.paths, avoiding OOM on 5000+ modules.
 */
export async function loadMonaco(): Promise<typeof Monaco> {
  if (monacoInstance) return monacoInstance;
  if (loadingPromise) return loadingPromise;

  // Setup worker environment before loading Monaco
  setupMonacoEnvironment();

  // Inject CSS for production (pre-built bundle has CSS extracted separately)
  if (!import.meta.env.DEV) {
    injectMonacoCss();
  }

  loadingPromise = import("monaco-editor").then((mod) => {
    monacoInstance = mod;
    return mod;
  });

  return loadingPromise;
}

/**
 * Get the monaco instance synchronously. Returns null if not loaded yet.
 * Use loadMonaco() first to ensure it's loaded.
 */
export function getMonaco(): typeof Monaco | null {
  return monacoInstance;
}

// Re-export types for convenience
export type { Monaco };
