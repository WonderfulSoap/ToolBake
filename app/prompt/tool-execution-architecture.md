# Tool Execution Architecture

This document explains how tools are invoked, how the UI is generated, and how the sandbox executes handler code. The three core files are:

- `app/components/tool/tool-ui-area.tsx` — UI orchestrator
- `app/components/tool/tool-sandbox.ts` — sandboxed handler execution engine
- `app/components/tool/tool-sandbox-scheduler.ts` — serial execution queue

---

## 1. Key Entities

### Tool (`entity/tool.ts`)

A `Tool` is the fundamental unit. It contains:

| Field         | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `id`          | Unique identifier                                          |
| `name`        | Display name                                               |
| `uiWidgets`   | Row-based UI widget definitions (`ToolUIRows`)             |
| `source`      | JavaScript handler source code (the logic)                 |
| `namespace`    | Workspace grouping                                        |
| `isOfficial`  | Whether it's a built-in tool                              |
| `extraInfo`   | Key-value metadata (e.g. `execInterval`)                  |

### ToolUIWidget (`entity/tool.ts`)

Each widget describes a single input or output control:

```ts
{
  id    : string;          // referenced in handler code
  type  : ToolInputType;   // e.g. "TextInput", "SliderInput", "LabelInput"
  title : string;          // display label
  mode  : "input" | "output";
  props?: Record<string, unknown>;  // widget-specific config (defaultValue, placeholder, etc.)
}
```

- **`mode: "input"`** — user-editable; changes trigger handler execution.
- **`mode: "output"`** — read-only; updated by handler return values.

### Widget Types (20 total)

`TextInput`, `NumberInput`, `TextareaInput`, `SelectListInput`, `RadioGroupInput`, `TagInput`, `ToggleInput`, `SliderInput`, `ButtonInput`, `ColorInput`, `ColorPickerInput`, `FileUploadInput`, `FilesUploadInput`, `LabelInput`, `RawHtmlInput`, `DividerInput`, `ProgressBarInput`, `MultiTextInput`, `SortableListInput`, `WaveformPlaylistInput`

Each type is registered in `ToolInputTypeUiComponentInfoConvertMap` (`input-types.ts`) with:
- `propsSchema` — Zod schema for prop validation
- `uiComponentFactory` — React component factory function

---

## 2. UI Generation Flow (`ToolUIArea`)

### 2.1 Widget Rendering

`ToolUIArea` receives `uiWidgets: ToolUIWidget[][]` (already converted from `ToolUIRows` via `generateToolWidgets()`). Each inner array is a **row**; each row may contain one or more widgets displayed side-by-side.

```
uiWidgets = [
  [widget_A],              // row 0: single column
  [widget_B, widget_C],    // row 1: two columns
  [widget_D],              // row 2: single column
]
```

Layout rules:
- Multi-column rows use CSS grid (`grid-template-columns`) or flexbox depending on whether widgets specify custom `width`.
- Rows are separated by a configurable gap (default 20px). `DividerInput` rows can customize gap via `gap`, `gapBefore`, `gapAfter` props.

### 2.2 Widget Value Collection

Each widget exposes a `WidgetValueCollectorInf` ref with two methods:

```ts
interface WidgetValueCollectorInf<T> {
  getValue(): T;              // read current value
  setValue(value: T): void;   // write value without triggering onChange
}
```

`ToolUIArea` maintains a `widgetValueCollectors` ref — a map of `widgetId → collectorRef`. This allows:
- **Collecting all values** at execution time via `collectValuesFromWidgets()`.
- **Updating output widgets** silently (without re-triggering handler) via `updateWidgetValues()`.

### 2.3 The `generateToolWidgets()` Function

Located in `input-types.ts`, this function converts raw `ToolUIRows` (from tool definition) into `ToolUIWidget[][]` for rendering:

1. Iterates each row and each widget within the row.
2. Looks up the widget type in `ToolInputTypeUiComponentInfoConvertMap`.
3. Validates `props` against the Zod schema for that widget type.
4. Returns structured `ToolUIWidget` descriptors with attached factory functions.

---

## 3. Handler — The Tool's Logic

A handler is an `async` JavaScript function defined in `tool.source`:

```js
async function handler(inputWidgets, changedWidgetId, callback, context) {
  // inputWidgets: { "widget-id": currentValue, ... }
  // changedWidgetId: the widget that triggered this run (undefined on first run)
  // callback: function to push mid-execution UI updates
  // context: sandbox globals (requirePackage, fetch, etc.)

  const input = inputWidgets["my-input"];
  const result = doSomething(input);

  return {
    "output-label": result,   // updates the "output-label" widget
  };
}
```

### Handler Signature (generated `.d.ts`)

The system auto-generates TypeScript declarations for IDE autocompletion:

```ts
declare type InputUIWidgets = {
  "my-input": string;      // resolved from widget type
};
declare type ChangedUIWidget = "my-input";
declare type AllUIWidgets = {
  "my-input": string;
  "output-label": string;
};
declare type HandlerReturnWidgets = Partial<AllUIWidgets>;
declare function handler(
  input: InputUIWidgets,
  widgetId: ChangedUIWidget,
  callback: HandlerCallback
): HandlerReturnValue;
```

### Handler Return Value

- **`Record<string, unknown>`** — partial map of widget IDs to new values. Only returned widgets are updated.
- **`undefined` / `void`** — no widget updates.
- **Must be an object** if non-null; primitive returns throw an error.

### Mid-Execution Callback

The third argument `callback` allows the handler to push UI updates **during** execution (before returning). This is useful for long-running tasks:

```js
async function handler(input, changedId, callback) {
  callback({ "progress-bar": 0.5 });   // update progress mid-execution
  await heavyWork();
  callback({ "progress-bar": 1.0 });
  return { "output": result };
}
```

---

## 4. ToolSandbox — Isolated Execution Engine

### 4.1 Construction

```ts
const sandbox = new ToolSandbox(tool, contextOverrides, requirePackageHooks);
```

During construction:
1. **Build sandbox context** — a controlled set of globals (see below).
2. **Compile handler** — wraps `tool.source` in `new Function("sandbox", "with (sandbox) { ... }")`.
3. **Execute once** — runs the compiled function to extract the `handler` reference and **preserve its closure state**.

The handler function is discovered by checking:
- Direct `handler` variable in scope.

### 4.2 Sandbox Context (Allowlisted Globals)

Only these globals are exposed to handler code:

| Category   | Globals                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| Screen     | `screen`, `innerWidth`, `innerHeight`, `outerWidth`, `outerHeight`, `devicePixelRatio` |
| Navigation | `navigator`, `performance`                                             |
| APIs       | `URL`, `URLSearchParams`, `Worker`, `Blob`                             |
| Timers     | `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `setImmediate`, `clearImmediate` |
| Network    | `fetch`                                                                 |
| Encoding   | `btoa`, `atob`                                                         |
| Aliases    | `window`, `self`, `globalThis` (all point to the sandbox context)      |
| Custom     | `requirePackage` (async package loader from embedded whitelist)         |
| Overrides  | `console` (hooked to capture logs for LogPanel)                        |

Constructors like `URL`, `Blob`, `Worker` are **unbound** so static methods (e.g. `URL.createObjectURL`) work correctly.

### 4.3 `executeHandler()` Method

```ts
async executeHandler(
  inputWidgets: Record<string, unknown>,
  changedWidgetId: string | undefined,
  uiUpdateCallback: (output: Record<string, unknown>) => void
): Promise<Record<string, unknown> | undefined>
```

1. Validates that the handler is a function (throws if not).
2. Calls `handler(inputWidgets, changedWidgetId, uiUpdateCallback, sandboxContext)`.
3. Validates the return type (must be object or undefined).
4. Returns the result.

### 4.4 Closure Preservation

Because the handler source is executed **once** during sandbox construction, any top-level variables in the handler code persist across calls:

```js
let count = 0;
async function handler(input) {
  count++;                    // increments on every call
  return { "counter": count };
}
```

This enables stateful tools without external storage.

---

## 5. ToolSandboxScheduler — Serial Execution Queue

### 5.1 Purpose

Prevents concurrent handler executions. When a user types rapidly or clicks multiple buttons, only the latest request matters.

### 5.2 Scheduling Strategy

| Strategy       | Behavior                                              |
| -------------- | ----------------------------------------------------- |
| `"queue-all"`  | Queue all requests and execute in order               |
| `"keep-latest"`| **Default.** Keep only the currently executing + the latest pending request. Discard all others. |

### 5.3 `commit()` Method

```ts
commit(
  inputWidgets, changedWidgetId, uiUpdateCallback,
  onExecutionStart?, onEnd?, onError?
): Promise<Record<string, unknown> | undefined>
```

1. Wraps the request in a Promise with `resolve`/`reject` for the caller to await.
2. If strategy is `"keep-latest"` and queue is non-empty, **discards all pending requests**.
3. Pushes the new request into the queue.
4. Triggers `processQueue()` if not already processing.

### 5.4 `processQueue()` — Serial Processing Loop

```
while (queue has items) {
  request = queue.shift()
  request.onExecutionStart()
  result = await toolSandbox.executeHandler(...)
  request.onEnd(result)        // or request.onError(error)
  request.resolve(result)      // or request.reject(error)
}
```

Only one execution runs at a time. The `isProcessing` flag prevents re-entry.

### 5.5 Lifecycle Hooks

| Hook               | When                          | Typical Use                          |
| ------------------- | ----------------------------- | ------------------------------------ |
| `onExecutionStart`  | Before `executeHandler()`     | Clear logs, set status to "running"  |
| `onEnd`             | After successful execution    | Set status to "success"              |
| `onError`           | On execution failure          | Log error, set status to "error"     |

---

## 6. Complete Execution Flow

### First Run (on component mount)

```
ToolUIArea mounts
  → useEffect creates ToolSandbox + ToolSandboxScheduler (once)
  → useEffect (tool dependency) triggers firstRunSandbox()
    → collectValuesFromWidgets() — reads defaultValues from all widgets
    → scheduler.commit(values, undefined, ...)
      → onExecutionStart: clear logs, set status "running"
      → sandbox.executeHandler(values, undefined, uiUpdateCallback)
        → handler(values, undefined, callback, context)
        → handler returns { "output-1": value, ... }
      → onEnd: set status "success"
    → updateWidgetValues(result) — calls setValue on each returned widget
```

### User Changes an Input Widget

```
User types in TextInput "my-input"
  → TextInput calls onChange("my-input", "new text")
  → ToolUIArea.onWidgetValueChange("my-input", "new text")
    → collectValuesFromWidgets() — reads current values from ALL widgets
    → scheduler.commit(collectedValues, "my-input", ...)
      → If another execution is running:
          keep-latest strategy discards previous pending, queues this one
      → When ready to execute:
          onExecutionStart: clear logs, set status "running"
          sandbox.executeHandler(collectedValues, "my-input", uiUpdateCallback)
            → handler(collectedValues, "my-input", callback, context)
            → handler can call callback({ ... }) for mid-execution updates
            → handler returns { "output-widget": newValue }
          onEnd: set status "success"
    → updateWidgetValues(result) — silently updates output widgets via setValue
```

### Key Detail: Silent Updates

When `updateWidgetValues()` calls `widget.setValue(value)`, this does **not** trigger `onChange`. This prevents infinite loops:

```
Input changes → handler runs → handler returns output values
  → output widgets updated via setValue (no onChange)
  → NO re-triggering of handler
```

---

## 7. Hooked Console

`ToolUIArea` creates a custom console object that forwards all log calls to the `LogPanel` component:

```ts
const hookedConsole = {
  log:   (...args) => logPanelRef.current?.appendLog("log", ...args),
  info:  (...args) => logPanelRef.current?.appendLog("info", ...args),
  warn:  (...args) => logPanelRef.current?.appendLog("warn", ...args),
  error: (...args) => logPanelRef.current?.appendLog("error", ...args),
  debug: (...args) => logPanelRef.current?.appendLog("debug", ...args),
};
```

This is injected into the sandbox context as `console`, so any `console.log()` in handler code appears in the UI's log panel instead of the browser console.

---

## 8. Package Loading (`requirePackage`)

Handlers can dynamically load packages from a whitelist via `requirePackage`:

```js
async function handler(input, changedId, callback, context) {
  const dayjs = await context.requirePackage("dayjs");
  return { "output": dayjs().format("YYYY-MM-DD") };
}
```

### 8.1 Embedded Packages Registry (`config/embedded-packages.ts`)

All loadable packages are registered in a whitelist:

```ts
export interface EmbeddedPackageConfig {
  load: () => Promise<any>;   // Dynamic import() function
  url : string;               // npmjs.com link for documentation
}

export const EMBEDDED_PACKAGES: Record<string, EmbeddedPackageConfig> = {
  "crypto-js":  { load: () => import("crypto-js"),  url: "https://npmjs.com/package/crypto-js" },
  "dayjs":      { load: () => import("dayjs"),       url: "https://npmjs.com/package/dayjs" },
  "ffmpeg":     { load: () => import("@ffmpeg/ffmpeg"), url: "..." },
  // ... ~28 packages total
};
```

Current whitelist categories:
- **Utilities**: `crypto-js`, `uuid`, `ulid`, `dayjs` (+ plugins), `colorjs.io`, `change-case`
- **Parsing/Encoding**: `chardet`, `fast-xml-parser`, `iconv-lite`, `js-yaml`, `toml`, `markdown-it`
- **Data Query**: `jsonpath-plus`, `jsonata`, `csv-parse`
- **Generation**: `qrcode`, `sql-formatter`
- **Network**: `ip-address`, `node-forge`
- **Heavy/WASM**: `ffmpeg`, `7z-wasm`, `decimal.js`, `@imagemagick/magick-wasm`
- **Templates**: `handlebars`

Packages **not** in this whitelist will throw a runtime error when requested.

The registry also provides helper functions:
- `getEmbeddedPackagesMdTable()` — generates a markdown table of all packages (used by LLM prompts).
- `getEmbeddedPackageDTsDef()` — generates TypeScript `declare function requirePackage(...)` overloads for handler IDE autocomplete.

### 8.2 `ToolSandboxRequirePackage` Class (`components/tool/tool-sandbox-require-package.ts`)

This class implements the loading logic, caching, and special wrappers. It is instantiated once via DI (`globalDI.toolSandboxRequirePackage`).

#### Factory method: `requirePackageFactory(onStart?, onEnd?)`

Returns the `async (pkg: string) => Promise<any>` function that gets injected into the sandbox context. The resolution order:

```
1. Cache hit?          → return cachedModules.get(pkg)
2. HTTPS URL?          → fetch as ESM module via dynamic import
3. Embedded package?   → call embeddedPkg.load() (dynamic import)
4. Not found?          → throw Error("Package not available")
```

After loading:
- If the package has a **special wrapper** (ffmpeg, 7z-wasm, imagemagick), apply it.
- Normalize: `module.default ?? module` (ESM/CJS compatibility).
- Cache the result in `cachedModules` Map for subsequent calls.
- Call `onStart(pkg)` before loading and `onEnd(pkg, error?)` after — these drive the `PackageLoadingIndicator` UI.

### 8.3 Special Package Wrappers (WASM Packages)

Three packages require custom wrappers because they need to locate WASM/worker files at runtime. The wrappers inject the correct asset URLs from the manifest.

#### FFmpeg — `wrapFfmpeg(module)`

FFmpeg requires multiple WASM and worker files. The wrapper creates a `CustomFFmpeg` class with two convenience methods:

```js
const ffmpeg = await requirePackage("ffmpeg");
const ff = new ffmpeg.FFmpeg();

// Single-threaded (smaller, wider browser support)
await ff.load_ffmpeg();

// Multi-threaded (faster, requires SharedArrayBuffer)
await ff.load_ffmpeg_mt();
```

Internally, `load_ffmpeg()` calls the original `load()` with injected URLs:

| Asset                          | Manifest Constant              | Path                                          |
| ------------------------------ | ------------------------------ | --------------------------------------------- |
| Core JS (single-thread)       | `MANIFEST_FFMPEG_CORE_JS`     | `/assets/ffmpeg/core/esm/ffmpeg-core.js`      |
| Core WASM (single-thread)     | `MANIFEST_FFMPEG_CORE_WASM`   | `/assets/ffmpeg/core/esm/ffmpeg-core.wasm`    |
| Class Worker                  | `MANIFEST_FFMPEG_WORKER_JS`   | `/assets/ffmpeg/ffmpeg-worker.js`             |
| Core JS (multi-thread)        | `MANIFEST_FFMPEG_CORE_MT_JS`  | `/assets/ffmpeg/core-mt/esm/ffmpeg-core.js`   |
| Core WASM (multi-thread)      | `MANIFEST_FFMPEG_CORE_MT_WASM`| `/assets/ffmpeg/core-mt/esm/ffmpeg-core.wasm` |
| Core Worker (multi-thread)    | `MANIFEST_FFMPEG_CORE_MT_WORKER_JS` | `/assets/ffmpeg/core-mt/esm/ffmpeg-core.worker.js` |

The wrapper uses `Object.setPrototypeOf` to preserve `instanceof` checks.

#### 7z-wasm — `wrap7ZipModule(module)`

7z-wasm uses a factory pattern with a `locateFile` callback. The wrapper intercepts it:

```js
const SevenZip = await requirePackage("7z-wasm");
const sevenZip = await SevenZip();  // wrapper injects locateFile automatically
```

The injected `locateFile` redirects `.wasm` requests to `MANIFEST_7ZZ_WASM` (`/assets/7z/7zz.wasm?hash`).

#### ImageMagick — `wrapImageMagickModule(module)`

ImageMagick's `initializeImageMagick` normally requires WASM bytes as the first argument. The wrapper provides a default that auto-fetches from `MANIFEST_MAGICK_WASM`:

```js
const im = await requirePackage("@imagemagick/magick-wasm");

// Without args: wrapper auto-fetches wasm from /assets/imagemagick/magick.wasm
await im.initializeImageMagick();

// With explicit bytes: passes through to original
await im.initializeImageMagick(customWasmBytes);
```

### 8.4 Manifest List (`config/manifest-list.ts`)

A central registry of all static WASM/worker asset URLs with content hashes:

```ts
export const MANIFEST_7ZZ_WASM = "/assets/7z/7zz.wasm?c292b4bb";
export const MANIFEST_FFMPEG_CORE_WASM = "/assets/ffmpeg/core/esm/ffmpeg-core.wasm?3730c055";
export const MANIFEST_MAGICK_WASM = "/assets/imagemagick/magick.wasm?d3834de6";
// ... etc.
```

- Each URL has a `?hash` query string (MD5, first 8 chars of file content).
- If file content changes at build time, the hash updates → browser cache invalidates.
- Enables aggressive HTTP caching (`Cache-Control: max-age=31536000`).

### 8.5 Vite Build Integration (`vite.config.ts`)

Two build-time mechanisms keep the main bundle small and WASM assets available:

#### Manual Chunks — Code Splitting

```ts
manualChunks(id) {
  for (const pkg of Object.keys(EMBEDDED_PACKAGES)) {
    if (id.includes(`node_modules/${pkg}`)) {
      return `dynamic-lib/${pkg}`;   // e.g. "dynamic-lib/crypto-js"
    }
  }
}
```

Each embedded package becomes its own chunk file (e.g. `dist/assets/dynamic-lib/crypto-js-HASH.js`). The main bundle never includes these — they are fetched only when `requirePackage()` triggers the dynamic `import()`.

#### `copyWasmAssetsPlugin` — Asset Pipeline

A custom Vite plugin that runs at `buildStart`:

1. **Compiles workers** — builds `7z-worker.ts` and Monaco editor workers via esbuild.
2. **Copies assets** — copies WASM, JS worker, and helper files from `node_modules` to `public/assets/`.
3. **Updates manifest** — computes MD5 hash of each file and writes the hashed URLs into `manifest-list.ts`.

Copy targets include:

| Package         | Files Copied                                                          |
| --------------- | --------------------------------------------------------------------- |
| FFmpeg (ST)     | `ffmpeg-core.js`, `ffmpeg-core.wasm`                                 |
| FFmpeg (MT)     | `ffmpeg-core.js`, `ffmpeg-core.wasm`, `ffmpeg-core.worker.js`        |
| FFmpeg (shared) | `worker.js`, `const.js`, `errors.js`                                 |
| 7z-wasm         | `7zz.wasm`, `7z-worker.js` (pre-built)                              |
| ImageMagick     | `magick.wasm`                                                         |

These copied files are served as static assets from `public/assets/` and are **gitignored** to avoid committing build artifacts.

### 8.6 Adding a New Embedded Package

Steps to add a new package to the whitelist:

1. Install the dependency: `npm install your-pkg`
2. Register in `config/embedded-packages.ts`:
   ```ts
   "your-pkg": { load: () => import("your-pkg"), url: "https://npmjs.com/package/your-pkg" },
   ```
3. Rebuild — `vite.config.ts` `manualChunks` will automatically split it into its own chunk.
4. If the package uses **WASM**:
   - Add copy entries in `vite.config.ts` `copyWasmAssetsPlugin`.
   - Add manifest constants in `config/manifest-list.ts`.
   - Write a special wrapper in `tool-sandbox-require-package.ts` if the package needs URL injection.
   - Add the `public/assets/<pkg>` directory to `.gitignore`.

### 8.7 `requirePackage` Loading Flow Diagram

```
Handler calls: await requirePackage("ffmpeg")
  │
  ├─ Cache hit? ──yes──→ return cached module
  │
  no
  │
  ├─ onStart("ffmpeg") → PackageLoadingIndicator shows "ffmpeg"
  │
  ├─ HTTPS URL? ──yes──→ dynamic import(url) → normalize → cache → return
  │
  no
  │
  ├─ EMBEDDED_PACKAGES["ffmpeg"] exists? ──no──→ throw Error
  │
  yes
  │
  ├─ embeddedPkg.load() → import("@ffmpeg/ffmpeg")
  │   → browser fetches dist/assets/dynamic-lib/ffmpeg-HASH.js (lazy chunk)
  │
  ├─ specialPackages["ffmpeg"] exists? ──yes──→ wrapFfmpeg(module)
  │   → injects load_ffmpeg() / load_ffmpeg_mt() with manifest URLs
  │
  ├─ normalize: module.default ?? module
  │
  ├─ cachedModules.set("ffmpeg", normalizedModule)
  │
  ├─ onEnd("ffmpeg") → PackageLoadingIndicator removes "ffmpeg"
  │
  └─ return normalizedModule
```

---

## 9. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    ToolUIArea                        │
│                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │ Widget A │ │ Widget B │ │ Widget C │  ← UI Row   │
│  │ (input)  │ │ (input)  │ │ (output) │              │
│  └────┬─────┘ └────┬─────┘ └────▲─────┘              │
│       │ onChange    │ onChange    │ setValue (silent)  │
│       ▼             ▼            │                    │
│  ┌──────────────────────────┐    │                    │
│  │  onWidgetValueChange()   │    │                    │
│  │  collectValuesFromWidgets│    │                    │
│  └────────────┬─────────────┘    │                    │
│               │                  │                    │
│               ▼                  │                    │
│  ┌──────────────────────────┐    │                    │
│  │  ToolSandboxScheduler    │    │                    │
│  │  ┌────────────────────┐  │    │                    │
│  │  │  Queue (keep-latest)│  │    │                    │
│  │  └─────────┬──────────┘  │    │                    │
│  └────────────┼─────────────┘    │                    │
│               │                  │                    │
│               ▼                  │                    │
│  ┌──────────────────────────┐    │                    │
│  │      ToolSandbox         │    │                    │
│  │  ┌────────────────────┐  │    │                    │
│  │  │  handler(values,   │  │    │                    │
│  │  │    changedId,      │  │    │                    │
│  │  │    callback,       │  │    │                    │
│  │  │    context)        │  │    │                    │
│  │  └─────────┬──────────┘  │    │                    │
│  └────────────┼─────────────┘    │                    │
│               │                  │                    │
│               ▼                  │                    │
│       return { "C": value }──────┘                    │
│               │                                      │
│               ▼                                      │
│  ┌──────────────────────────┐                        │
│  │  updateWidgetValues()    │                        │
│  └──────────────────────────┘                        │
│                                                     │
│  ┌────────────┐  ┌───────────────────┐              │
│  │  LogPanel   │  │ ExecutionIndicator│              │
│  │  (console)  │  │ (running/success) │              │
│  └────────────┘  └───────────────────┘              │
└─────────────────────────────────────────────────────┘
```
