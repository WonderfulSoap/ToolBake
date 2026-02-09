/**
 * JSON Data URI Viewer - Parses JSON and renders embedded Base64 Data URIs as media previews.
 * Supports two view modes: inline (JSON structure with embedded previews) and flat (list view).
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const rawJson = inputWidgets["json-input"] || "";
  const indentSize = normalizeIndentSize(inputWidgets["indent-size"]);

  // Read current tab state from label data
  const labelState = inputWidgets["media-preview"];
  const currentTab = labelState?.data?.["tab-container"]?.["data-tab"] || "inline";

  // Handle empty input
  if (!rawJson.trim()) {
    return { "media-preview": buildEmptyStateHtml() };
  }

  // Try to parse JSON
  let data;
  try {
    data = JSON.parse(rawJson);
  } catch (err) {
    return { "media-preview": buildErrorHtml(`Invalid JSON: ${err.message}`) };
  }

  // Find all Data URIs in the JSON
  const dataUris = [];
  findDataUris(data, "", dataUris);

  console.log(`Found ${dataUris.length} Data URI(s) in JSON`);

  // Build preview HTML with tabs
  const previewHtml = dataUris.length > 0
    ? buildTabbedPreview(data, dataUris, indentSize, currentTab)
    : buildNoDataUriHtml(data, indentSize);

  return { "media-preview": previewHtml };
}

/**
 * Normalize indent size to a valid range.
 */
function normalizeIndentSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 2;
  return Math.min(8, Math.floor(parsed));
}

/**
 * Recursively find all Data URI strings in a JSON object.
 */
function findDataUris(obj, path, results) {
  if (obj === null || obj === undefined) return;

  if (typeof obj === "string") {
    const dataUriInfo = parseDataUri(obj);
    if (dataUriInfo) {
      results.push({ path, dataUri: obj, ...dataUriInfo });
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      findDataUris(item, `${path}[${index}]`, results);
    });
    return;
  }

  if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      findDataUris(obj[key], childPath, results);
    }
  }
}

/**
 * Parse a Data URI string and extract its components.
 */
function parseDataUri(str) {
  const match = str.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;

  const mimeType = match[1] || "text/plain";
  const isBase64 = !!match[2];
  const data = match[3] || "";

  return {
    mimeType     : mimeType.toLowerCase(),
    isBase64,
    data,
    mediaCategory: getMediaCategory(mimeType),
  };
}

/**
 * Determine the media category based on MIME type.
 */
function getMediaCategory(mimeType) {
  const type = mimeType.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("text/") || type === "application/json" || type === "application/xml") return "text";
  return "unknown";
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build tabbed preview with inline and flat views.
 */
function buildTabbedPreview(data, dataUris, indentSize, activeTab) {
  const inlineHtml = buildInlinePreview(data, dataUris, indentSize);
  const flatHtml = buildFlatPreview(dataUris);

  const innerHtml = `
    <div id="tab-container" data-tab="${activeTab}" class="space-y-3">
      <div class="flex items-center gap-1 border-b border-border">
        <button id="tab-inline" class="px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "inline" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}">
          Inline Preview
        </button>
        <button id="tab-flat" class="px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "flat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}">
          Flat List (${dataUris.length})
        </button>
      </div>
      <div id="panel-inline" class="${activeTab === "inline" ? "" : "hidden"}">
        ${inlineHtml}
      </div>
      <div id="panel-flat" class="${activeTab === "flat" ? "" : "hidden"}">
        ${flatHtml}
      </div>
    </div>
  `;

  const afterHook = (container) => {
    const tabContainer = container.querySelector("#tab-container");
    const tabInline = container.querySelector("#tab-inline");
    const tabFlat = container.querySelector("#tab-flat");
    const panelInline = container.querySelector("#panel-inline");
    const panelFlat = container.querySelector("#panel-flat");

    if (!tabContainer || !tabInline || !tabFlat || !panelInline || !panelFlat) return;

    const switchTab = (tab) => {
      tabContainer.dataset.tab = tab;
      // Update tab styles
      tabInline.className = `px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${tab === "inline" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`;
      tabFlat.className = `px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${tab === "flat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`;
      // Update panel visibility
      panelInline.classList.toggle("hidden", tab !== "inline");
      panelFlat.classList.toggle("hidden", tab !== "flat");
    };

    tabInline.addEventListener("click", () => switchTab("inline"));
    tabFlat.addEventListener("click", () => switchTab("flat"));
  };

  return { innerHtml, afterHook };
}

/**
 * Build inline preview - JSON structure with embedded media.
 */
function buildInlinePreview(data, dataUris, indentSize) {
  // Create a map of paths to dataUri info for quick lookup
  const dataUriMap = new Map();
  dataUris.forEach(item => dataUriMap.set(item.path, item));

  // Render JSON with inline media
  const rendered = renderJsonWithMedia(data, "", indentSize, 0, dataUriMap);

  return `
    <div class="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
      <div class="p-4 font-mono text-sm leading-relaxed overflow-x-auto">
        <pre class="whitespace-pre">${rendered}</pre>
      </div>
    </div>
  `;
}

/**
 * Recursively render JSON with inline media previews.
 */
function renderJsonWithMedia(obj, path, indentSize, depth, dataUriMap) {
  const indent = " ".repeat(indentSize * depth);
  const childIndent = " ".repeat(indentSize * (depth + 1));

  if (obj === null) return "<span class=\"text-orange-500\">null</span>";
  if (obj === undefined) return "<span class=\"text-muted-foreground\">undefined</span>";

  if (typeof obj === "boolean") {
    return `<span class="text-orange-500">${obj}</span>`;
  }

  if (typeof obj === "number") {
    return `<span class="text-blue-500">${obj}</span>`;
  }

  if (typeof obj === "string") {
    const dataUriInfo = dataUriMap.get(path);
    if (dataUriInfo) {
      return renderInlineMedia(dataUriInfo, childIndent);
    }
    // Regular string - truncate if too long
    const displayStr = obj.length > 100 ? obj.slice(0, 100) + "..." : obj;
    return `<span class="text-green-600 dark:text-green-400">"${escapeHtml(displayStr)}"</span>`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";

    const items = obj.map((item, index) => {
      const childPath = `${path}[${index}]`;
      const rendered = renderJsonWithMedia(item, childPath, indentSize, depth + 1, dataUriMap);
      return `${childIndent}${rendered}`;
    });

    return `[\n${items.join(",\n")}\n${indent}]`;
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";

    const entries = keys.map(key => {
      const childPath = path ? `${path}.${key}` : key;
      const rendered = renderJsonWithMedia(obj[key], childPath, indentSize, depth + 1, dataUriMap);
      return `${childIndent}<span class="text-purple-600 dark:text-purple-400">"${escapeHtml(key)}"</span>: ${rendered}`;
    });

    return `{\n${entries.join(",\n")}\n${indent}}`;
  }

  return String(obj);
}

/**
 * Render inline media preview for a Data URI.
 * @param {Object} item - Data URI info object
 * @param {string} indent - Indentation string for multi-line alignment
 */
function renderInlineMedia(item, indent = "") {
  const { dataUri, mimeType, mediaCategory, isBase64, data } = item;
  const sizeInfo = calculateDataSize(data, isBase64);

  // Badge showing mime type and size (w-fit ensures badge doesn't stretch to parent width)
  const badge = `<span class="inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary">${escapeHtml(mimeType)} · ${sizeInfo}</span>`;

  switch (mediaCategory) {
    case "image":
      return `<span class="inline-flex flex-col items-start gap-1">
${indent}  ${badge}
${indent}  <span class="inline-flex items-center justify-center w-[80px] h-[60px] rounded overflow-hidden bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]">
${indent}    <img src="${dataUri}" class="w-full h-full object-contain" alt="preview" />
${indent}  </span>
${indent}</span>`;

    case "audio":
      return `<span class="inline-flex flex-col gap-1">
${indent}  ${badge}
${indent}  <audio controls src="${dataUri}" class="h-8 max-w-[250px]"></audio>
${indent}</span>`;

    case "video":
      return `<span class="inline-flex flex-col gap-1">
${indent}  ${badge}
${indent}  <video controls src="${dataUri}" class="max-w-[250px] max-h-[150px] rounded"></video>
${indent}</span>`;

    case "pdf":
      return `<span class="inline-flex flex-col gap-1">
${indent}  ${badge}
${indent}  <span class="text-[11px] text-muted-foreground italic">(PDF - click badge to view)</span>
${indent}</span>`;

    case "text":
      let preview = "";
      try {
        const dataPart = dataUri.split(",")[1] || "";
        preview = isBase64 ? atob(dataPart) : decodeURIComponent(dataPart);
        if (preview.length > 50) preview = preview.slice(0, 50) + "...";
      } catch (e) {
        preview = "(decode error)";
      }
      return `<span class="inline-flex flex-col gap-1">
${indent}  ${badge}
${indent}  <span class="text-green-600 dark:text-green-400 text-[11px]">"${escapeHtml(preview)}"</span>
${indent}</span>`;

    default:
      return `<span class="inline-flex flex-col gap-1">
${indent}  ${badge}
${indent}  <span class="text-[11px] text-muted-foreground italic">(no preview)</span>
${indent}</span>`;
  }
}

/**
 * Build flat list preview.
 */
function buildFlatPreview(dataUris) {
  const items = dataUris.map((item, index) => buildFlatPreviewItem(item, index));

  return `
    <div class="grid gap-4">
      ${items.join("")}
    </div>
  `;
}

/**
 * Build a single flat preview item.
 */
function buildFlatPreviewItem(item, index) {
  const { path, dataUri, mimeType, mediaCategory, isBase64, data } = item;
  const sizeInfo = calculateDataSize(data, isBase64);

  let mediaHtml = "";
  switch (mediaCategory) {
    case "image":
      mediaHtml = `
        <div class="flex items-center justify-center w-full h-[200px] bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] rounded-md overflow-hidden">
          <img src="${dataUri}" class="max-w-full max-h-full object-contain" alt="preview" />
        </div>`;
      break;
    case "audio":
      mediaHtml = `
        <div class="flex flex-col items-center gap-2 py-4">
          <div class="text-[11px] text-muted-foreground uppercase font-medium tracking-widest">Audio Preview</div>
          <audio controls src="${dataUri}" class="w-full max-w-md h-10"></audio>
        </div>`;
      break;
    case "video":
      mediaHtml = `
        <div class="flex items-center justify-center bg-black rounded-md overflow-hidden max-h-[300px]">
          <video controls src="${dataUri}" class="max-w-full max-h-[300px]"></video>
        </div>`;
      break;
    case "pdf":
      mediaHtml = `<embed src="${dataUri}" type="application/pdf" width="100%" height="300px" class="rounded-md" />`;
      break;
    case "text":
      let text = "";
      try {
        const dataPart = dataUri.split(",")[1] || "";
        text = isBase64 ? atob(dataPart) : decodeURIComponent(dataPart);
        if (text.length > 2000) text = text.slice(0, 2000) + "\n... (truncated)";
      } catch (e) {
        text = "(Unable to decode)";
      }
      mediaHtml = `
        <div class="rounded-md bg-muted/30 border border-border/40">
          <pre class="p-3 text-xs leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-auto font-mono">${escapeHtml(text)}</pre>
        </div>`;
      break;
    default:
      mediaHtml = `
        <div class="py-6 text-center bg-muted/20 rounded-md">
          <div class="text-sm text-muted-foreground">No preview available</div>
        </div>`;
  }

  return `
    <div class="rounded-lg border border-border/60 bg-card overflow-hidden">
      <div class="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border/60">
        <div class="flex flex-col gap-1 min-w-0">
          <code class="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground break-all">${escapeHtml(path)}</code>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-primary">${escapeHtml(mimeType)}</span>
            <span class="text-[10px] text-muted-foreground">${sizeInfo}</span>
          </div>
        </div>
        <a href="${dataUri}" download="datauri-${index + 1}.${getExtensionFromMime(mimeType)}" class="text-xs font-medium text-primary underline underline-offset-2 whitespace-nowrap">Download</a>
      </div>
      <div class="p-3">${mediaHtml}</div>
    </div>
  `;
}

/**
 * Calculate approximate data size.
 */
function calculateDataSize(data, isBase64) {
  if (!data) return "0 B";
  const bytes = isBase64 ? Math.floor((data.length * 3) / 4) : data.length;
  if (bytes < 1024) return `~${bytes} B`;
  if (bytes < 1024 * 1024) return `~${(bytes / 1024).toFixed(1)} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get file extension from MIME type.
 */
function getExtensionFromMime(mimeType) {
  const map = {
    "image/png"       : "png", "image/jpeg"      : "jpg", "image/gif"       : "gif", "image/webp"      : "webp",
    "image/svg+xml"   : "svg", "image/bmp"       : "bmp", "image/x-icon"    : "ico",
    "audio/mpeg"      : "mp3", "audio/mp3"       : "mp3", "audio/wav"       : "wav", "audio/ogg"       : "ogg",
    "audio/webm"      : "webm", "audio/flac"      : "flac", "audio/aac"       : "aac",
    "video/mp4"       : "mp4", "video/webm"      : "webm", "video/ogg"       : "ogv", "video/quicktime" : "mov",
    "application/pdf" : "pdf", "text/plain"      : "txt", "text/html"       : "html",
    "application/json": "json", "application/xml" : "xml",
  };
  return map[mimeType.toLowerCase()] || "bin";
}

/**
 * Build empty state HTML.
 */
function buildEmptyStateHtml() {
  return "<div class=\"text-xs text-muted-foreground italic\">Paste JSON to preview embedded Data URIs...</div>";
}

/**
 * Build error HTML.
 */
function buildErrorHtml(message) {
  return `
    <div class="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
      <span class="text-sm text-destructive">${escapeHtml(message)}</span>
    </div>
  `;
}

/**
 * Build "no Data URI found" HTML - still show prettified JSON.
 */
function buildNoDataUriHtml(data, indentSize) {
  const prettified = JSON.stringify(data, null, indentSize);
  return `
    <div class="space-y-3">
      <div class="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/40">
        <span class="text-xs text-muted-foreground">No Data URIs found. Showing prettified JSON:</span>
      </div>
      <div class="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
        <pre class="p-4 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre">${escapeHtml(prettified)}</pre>
      </div>
    </div>
  `;
}
