/**
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widgetId"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * - Check the 'uiWidgets' tab to check and modify the input/output UI widgets of this tool
 * - The 'handler.d.ts' tab shows the full auto generated type definitions for the handler function
 *
 * !! The jsdoc comment below describes the handler function signature, and provides type information for the editor. Don't remove it.
 *
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */

let magickModule = null;
let lastExtractedItems = null;
let lastExtractedKey = "";

async function handler(inputWidgets, changedWidgetIds, callback) {
  const icoFile = inputWidgets.icoFile || null;
  const showPreview = parseToggleValue(inputWidgets.showPreview, true);
  const output = {};

  if (!icoFile) {
    lastExtractedItems = null;
    lastExtractedKey = "";
    output.statusLabel = buildIdleStatus();
    output.downloadOutput = buildEmptyResult("Upload an ICO file and click Extract PNG Layers.");
    return output;
  }

  if (!isLikelyIcoFile(icoFile)) {
    lastExtractedItems = null;
    lastExtractedKey = "";
    output.statusLabel = buildErrorStatus("Invalid file type. Please upload a .ico file.");
    output.downloadOutput = buildEmptyResult("Only ICO files are supported.");
    return output;
  }

  const currentKey = `${icoFile.name}|${icoFile.size}|${icoFile.lastModified}`;
  if (currentKey !== lastExtractedKey) lastExtractedItems = null;

  if (changedWidgetIds === "extractBtn") {
    callback({ downloadOutput: buildProgressResult("Loading ImageMagick WASM...") });
    const Magick = await getImageMagick();
    callback({ downloadOutput: buildProgressResult("Extracting PNG layers from ICO...") });
    lastExtractedItems = await extractIcoFramesToPng(Magick, icoFile, callback);
    lastExtractedKey = currentKey;
  }

  output.statusLabel = buildReadyStatus(icoFile, lastExtractedItems);
  output.downloadOutput = buildDownloadResult(lastExtractedItems, showPreview);
  return output;
}

/**
 * Load and cache ImageMagick module.
 */
async function getImageMagick() {
  if (magickModule) return magickModule;
  const Magick = await requirePackage("@imagemagick/magick-wasm");
  await Magick.initializeImageMagick();
  magickModule = Magick;
  return Magick;
}

/**
 * Extract each ICO frame and convert to PNG.
 */
async function extractIcoFramesToPng(Magick, file, callback) {
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  let rawItems = [];
  try {
    // Explicitly pass ICO format because byte-array inputs do not carry filename extension.
    rawItems = await Magick.ImageMagick.readCollection(inputBytes, Magick.MagickFormat.Ico, async (images) => {
      const items = [];
      for (let index = 0; index < images.length; index++) {
        const image = images[index];
        callback({ downloadOutput: buildProgressResult(`Converting layer ${index + 1}/${images.length} to PNG...`) });
        let pngBlob = null;
        image.write(Magick.MagickFormat.Png, (pngBytes) => {
          pngBlob = new Blob([pngBytes], { type: "image/png" });
        });
        if (!pngBlob) throw new Error(`Failed to export layer ${index + 1}.`);
        const width = image.width || 0;
        const height = image.height || 0;
        const dataUrl = await blobToDataUrl(pngBlob);
        items.push({ index: index + 1, width: width, height: height, sizeBytes: pngBlob.size, dataUrl: dataUrl });
      }
      return items;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    throw new Error(`Failed to decode ICO file. ${message}`);
  }

  const baseName = stripFileExtension(file.name) || "icon";
  const duplicatedCount = countDuplicatedSizes(rawItems);
  return rawItems.map((item) => {
    const key = `${item.width}x${item.height}`;
    const suffix = duplicatedCount[key] > 1 ? `-${item.index}` : "";
    return { ...item, fileName: `${baseName}-${item.width}x${item.height}${suffix}.png` };
  });
}

/**
 * Count duplicated size entries for stable output naming.
 */
function countDuplicatedSizes(items) {
  const counts = {};
  for (let i = 0; i < items.length; i++) {
    const key = `${items[i].width}x${items[i].height}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Check whether uploaded file is likely ICO.
 */
function isLikelyIcoFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  if (name.endsWith(".ico")) return true;
  return type === "image/x-icon" || type === "image/vnd.microsoft.icon";
}

/**
 * Parse toggle-like values into strict booleans.
 */
function parseToggleValue(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no") return false;
    if (normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes") return true;
  }
  return Boolean(value);
}

/**
 * Build idle status text.
 */
function buildIdleStatus() {
  return "<div class='text-sm text-muted-foreground'>Upload an ICO file to inspect and extract icon layers.</div>";
}

/**
 * Build error status text.
 */
function buildErrorStatus(message) {
  return `<div class='text-sm text-destructive'>${escapeHtml(message)}</div>`;
}

/**
 * Build status text for current extraction state.
 */
function buildReadyStatus(file, items) {
  const safeName = escapeHtml(file?.name || "icon.ico");
  if (!items || items.length === 0) {
    return `<div class='space-y-1'><div class='text-sm text-muted-foreground'>Source: <span class='font-medium text-foreground'>${safeName}</span></div><div class='text-sm text-muted-foreground'>Click <span class='font-medium text-foreground'>Extract PNG Layers</span> to parse all icon sizes.</div></div>`;
  }
  const sizeList = items.map((item) => `${item.width}x${item.height}`).join(", ");
  return `<div class='space-y-1'><div class='text-sm text-muted-foreground'>Source: <span class='font-medium text-foreground'>${safeName}</span></div><div class='text-sm text-muted-foreground'>Extracted layers: <span class='font-medium text-foreground'>${items.length}</span></div><div class='text-xs text-muted-foreground'>Sizes: ${escapeHtml(sizeList)}</div></div>`;
}

/**
 * Build empty output placeholder.
 */
function buildEmptyResult(message) {
  return { innerHtml: `<div class='text-xs text-muted-foreground py-2'>${escapeHtml(message)}</div>` };
}

/**
 * Build progress output content.
 */
function buildProgressResult(message) {
  return {
    innerHtml: `<div class='space-y-2'><div class='text-sm text-muted-foreground'>${escapeHtml(message)}</div><div class='h-2 w-full overflow-hidden rounded-full bg-muted'><div class='h-full w-2/3 animate-pulse rounded-full bg-primary'></div></div></div>`,
  };
}

/**
 * Build extraction output with download links and previews.
 */
function buildDownloadResult(items, showPreview) {
  if (!items || items.length === 0) return buildEmptyResult("No extracted PNG yet. Click Extract PNG Layers.");
  const downloadLinksHtml = items.map((item) => {
    const sizeLabel = `${item.width}x${item.height}`;
    const fileSize = formatBytes(item.sizeBytes || 0);
    return `<a href='${item.dataUrl}' download='${escapeHtml(item.fileName)}' data-download-file class='inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20'>${escapeHtml(sizeLabel)} (${escapeHtml(fileSize)})</a>`;
  }).join(" ");

  const previewHtml = showPreview ? `<div class='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'>${items.map((item) => `<a href='${item.dataUrl}' download='${escapeHtml(item.fileName)}' class='group space-y-1 rounded-md border border-border bg-muted/20 p-2 hover:border-primary/40'><img src='${item.dataUrl}' alt='${escapeHtml(item.fileName)}' class='h-16 w-16 rounded object-contain' /><div class='text-[11px] text-muted-foreground'>${escapeHtml(item.width)}x${escapeHtml(item.height)}</div></a>`).join("")}</div>` : "";

  return {
    innerHtml: `<div class='space-y-3' data-download-container='true'><div class='flex items-center justify-between'><div class='text-sm font-medium text-foreground'>Extracted ${items.length} PNG file${items.length > 1 ? "s" : ""}</div><a href='#' class='text-sm font-semibold text-primary underline underline-offset-2' onclick='(function(el){var root=el.closest(\"[data-download-container]\");if(!root)return false;var links=root.querySelectorAll(\"a[data-download-file]\");links.forEach(function(link,index){setTimeout(function(){link.click();},index*120);});return false;})(this)'>Download All</a></div><div class='flex flex-wrap gap-2'>${downloadLinksHtml}</div>${previewHtml}</div>`,
  };
}

/**
 * Convert blob to Data URL.
 */
function blobToDataUrl(blob) {
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function handleLoad() {
      resolve(String(reader.result || ""));
    };
    reader.onerror = function handleError() {
      reject(new Error("Failed to read PNG blob."));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Remove file extension from a filename.
 */
function stripFileExtension(filename) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

/**
 * Format byte count for human-readable UI.
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

/**
 * Escape HTML special chars for safe label rendering.
 */
function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
