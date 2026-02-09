// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

import { EMBEDDED_PACKAGES } from "./app/config/embedded-packages";

/** Compute a short content hash for a file, similar to Vite/Webpack build hashes (8 chars by default) */
async function computeFileHash(filePath: string, length = 8): Promise<string> {
  const content = await readFile(filePath);
  return createHash("md5").update(content).digest("hex").slice(0, length);
}

// Plugin to force full page reload instead of HMR
function fullPageReloadPlugin() {
  return {
    name: "full-page-reload",
    handleHotUpdate({ file, server }: any) {
      console.log(`File changed: ${file}`);
      server.ws.send({
        type   : "full",
        event  : "full-reload",
        payload: { path: "*" },
      });
      return [];
    },
  };
}

function devCookieEchoPlugin() {
  // Expose request cookies in dev server for quick verification.
  return {
    name : "dev-cookie-echo",
    apply: "serve" as const,
    configureServer(server: any) {
      server.middlewares.use("/__dev-cookie", (req: any, res: any) => {
        const cookie = req.headers?.cookie ?? "";
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(cookie);
      });
    },
  };
}

// Inject window and document objects for SSG/prerender builds
// Some third-party libraries (e.g., @waveform-playlist/ui-components, styled-components) 
// access window/document at module load time
function injectWindowPolyfillPlugin() {
  // Setup function that can be called at different stages
  function setupGlobals() {
    // Mock Storage API (localStorage/sessionStorage) for SSG builds - create instances first
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

    const mockLocalStorage = new MockStorage();
    const mockSessionStorage = new MockStorage();

    // Inject window object globally for Node.js environment during SSG build
    if (typeof globalThis.window === "undefined") {
      (globalThis as any).window = globalThis;
    }
    // Ensure window has localStorage and sessionStorage immediately
    (globalThis as any).window.localStorage = mockLocalStorage;
    (globalThis as any).window.sessionStorage = mockSessionStorage;

    // Also set self for compatibility
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
  }

  return {
    name: "inject-window-polyfill",
    // Setup globals as early as possible
    configResolved() {
      setupGlobals();
    },
    buildStart() {
      setupGlobals();
    },
    // Also setup when resolving modules
    resolveId(id: string) {
      if (id === "virtual:window-polyfill") {
        return id;
      }
      return null;
    },
    load(id: string) {
      if (id === "virtual:window-polyfill") {
        setupGlobals();
        return "// Window polyfill injected";
      }
      return null;
    },
  };
}

// Build 7z-worker.ts to public/assets/7z/7z-worker.js using esbuild
async function build7zWorker() {
  const { build } = await import("esbuild");
  const outDir = path.resolve("build/assets/7z");
  await mkdir(outDir, { recursive: true });
  await build({
    entryPoints: [path.resolve("app/workers/7z-worker.ts")],
    outfile    : path.join(outDir, "7z-worker.js"),
    bundle     : true,
    format     : "esm",
    platform   : "browser",
    target     : "es2020",
    minify     : false, // Disable minify for stable output hash
    // 7z-wasm has Node.js polyfill code that checks for module at runtime
    // Mark it as external since it won't be used in browser
    external   : ["module"],
  });
}

// Build Monaco Editor workers using esbuild
async function buildMonacoWorkers() {
  const { build } = await import("esbuild");
  const outDir = path.resolve("public/assets/monacoeditorwork");
  await mkdir(outDir, { recursive: true });

  const workers = [
    { entry: "node_modules/monaco-editor/esm/vs/editor/editor.worker.js", out: "editor.worker.js" },
    { entry: "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js", out: "ts.worker.js" },
    { entry: "node_modules/monaco-editor/esm/vs/language/json/json.worker.js", out: "json.worker.js" },
  ];

  for (const { entry, out } of workers) {
    await build({
      entryPoints: [path.resolve(entry)],
      outfile    : path.join(outDir, out),
      bundle     : true,
      format     : "iife", // Workers need to be self-contained
      platform   : "browser",
      target     : "es2020",
      minify     : true,
    });
    console.log(`Built Monaco worker: ${out}`);
  }
}

// Build Monaco Editor main bundle using esbuild (avoids Rollup OOM on 5000+ Monaco modules)
async function buildMonacoBundle() {
  const { build } = await import("esbuild");
  const outDir = path.resolve("public/assets/monacoeditorwork");
  await mkdir(outDir, { recursive: true });

  await build({
    entryPoints: { "monaco": "node_modules/monaco-editor/esm/vs/editor/editor.main.js" },
    outdir  : outDir,
    bundle  : true,
    format  : "esm",
    platform: "browser",
    target  : "es2020",
    minify  : true,
    loader  : { ".ttf": "dataurl" }, // Embed codicon font in CSS
  });
  console.log("Built Monaco bundle: monaco.js + monaco.css");
}

// Copy wasm and worker assets into public so runtime URLs stay stable.
function copyWasmAssetsPlugin() {
  return {
    name : "copy-wasm-assets",
    // Avoid dev-server file watcher loops by only running during builds.
    apply: "build" as const,
    async buildStart() {

      // Build workers and Monaco bundle first
      await build7zWorker();
      await buildMonacoWorkers();
      await buildMonacoBundle();

      // Target uses URL-style paths with leading slash, matching runtime URLs
      const copies = [
        { source: "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js", target: "/assets/ffmpeg/core/esm/ffmpeg-core.js" },
        { source: "node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm", target: "/assets/ffmpeg/core/esm/ffmpeg-core.wasm" },
        { source: "node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.js", target: "/assets/ffmpeg/core-mt/esm/ffmpeg-core.js" },
        { source: "node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.wasm", target: "/assets/ffmpeg/core-mt/esm/ffmpeg-core.wasm" },
        { source: "node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.worker.js", target: "/assets/ffmpeg/core-mt/esm/ffmpeg-core.worker.js" },
        { source: "node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js", target: "/assets/ffmpeg/ffmpeg-worker.js" },
        { source: "node_modules/@ffmpeg/ffmpeg/dist/esm/const.js", target: "/assets/ffmpeg/const.js" },
        { source: "node_modules/@ffmpeg/ffmpeg/dist/esm/errors.js", target: "/assets/ffmpeg/errors.js" },
        { source: "node_modules/@imagemagick/magick-wasm/dist/magick.wasm", target: "/assets/imagemagick/magick.wasm" },
        // 7z is special
        { source: "node_modules/7z-wasm/7zz.wasm", target: "/assets/7z/7zz.wasm" },
        { source: "build/assets/7z/7z-worker.js", target: "/assets/7z/7z-worker.js" },
      ];

      // Copy files to public directory and update manifest with hashed URLs
      const manifestPath = path.resolve("app/config/manifest-list.ts");
      let manifestContent = await readFile(manifestPath, "utf-8");
      for (const { source, target } of copies) {
        const resolvedSource = path.resolve(source);
        await mkdir(path.dirname("public" + target), { recursive: true });
        await copyFile(resolvedSource, "public" + target);

        // Update manifest: match target with optional existing ?hash query string (escape . for regex)
        const escaped = target.replace(/\./g, "\\.");
        const regex = new RegExp(`"${escaped}(\\?[a-f0-9]*)?"`, "g");
        if (regex.test(manifestContent)) {
          regex.lastIndex = 0; // Reset regex state after test()
          const hash = await computeFileHash(resolvedSource);
          console.log(`Updated manifest entry for ${target} with hash ${hash}`);
          manifestContent = manifestContent.replace(regex, `"${target}?${hash}"`);
        }
      }
      await writeFile(manifestPath, manifestContent);
    },
  };
}

export default defineConfig({
  plugins: [
    // Inject window polyfill first, before other plugins that might need it
    injectWindowPolyfillPlugin(),
    nodePolyfills({
      include        : ["buffer", "string_decoder"],
      globals        : { Buffer: true, process: false, global: false },
      protocolImports: true,
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    fullPageReloadPlugin(),
    devCookieEchoPlugin(),
    copyWasmAssetsPlugin(),
    VitePWA({
      strategies    : "injectManifest",
      srcDir        : "app",
      filename      : "sw.ts",
      registerType  : "autoUpdate",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        globIgnores : [
          "**/*.wasm",
          "**/assets/monacoeditorwork/*",
          "**/assets/editor.main-*.js",
          "**/assets/shikijs-*.js",
          "**/assets/ts.worker-*.js",
        ],
      },
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest     : {
        name            : "ToolBake",
        short_name      : "ToolBake",
        description     : "A customizable developer tool platform.",
        start_url       : "/",
        scope           : "/",
        display         : "standalone",
        background_color: "#ffffff",
        theme_color     : "#4f46e5",
        icons           : [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],

  server: {
    middlewareMode: false,
  },

  // Exclude monaco-editor from SSR bundling - it's browser-only
  ssr: {
    external: ["monaco-editor"],
  },

  build: {
    rollupOptions: {
      // Externalize monaco-editor so Rollup doesn't process its 5000+ ESM modules (causes OOM).
      // The pre-built bundle in public/assets/monacoeditorwork/monaco.js is loaded at runtime instead.
      external: ["monaco-editor"],
      output: {
        // Rewrite externalized monaco-editor import to the pre-built bundle URL
        paths: {
          "monaco-editor": "/assets/monacoeditorwork/monaco.js",
        },
        manualChunks(id) {
          // Split official tools into a separate chunk for lazy loading
          // This keeps the main bundle small and loads tool data on demand
          if (id.includes("/app/tools/official/") || id.includes("/app/tools/official-tool-list")) {
            return "official-tools-data";
          }
          if (id.includes("node_modules/@shikijs")) {
            return "shikijs";
          }
          for (const pkg of Object.keys(EMBEDDED_PACKAGES)) {
            if (id.includes(`node_modules/${pkg}`)) {
              return `dynamic-lib/${pkg}`; // Use package name as chunk name
            }
          }
        },
      },
    },
  },
});
