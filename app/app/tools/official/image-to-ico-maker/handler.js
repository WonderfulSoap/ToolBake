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
let lastConversionResult = null;
let lastConversionKey = "";

async function handler(inputWidgets, changedWidgetIds, callback) {
  const file = inputWidgets.imageFile || null;
  const sizeListText = String(inputWidgets.icoSizes || "");
  const showPreview = parseToggleValue(inputWidgets.showPreview, true);
  const output = {};

  if (!file) {
    lastConversionResult = null;
    lastConversionKey = "";
    output.statusLabel = buildIdleStatus();
    output.downloadOutput = buildEmptyResult("Upload an image and click Generate ICO.");
    return output;
  }

  const parsedSizes = parseIconSizes(sizeListText);
  const conversionKey = `${file.name}|${file.size}|${file.lastModified}|${parsedSizes.sanitizedText}`;
  if (conversionKey !== lastConversionKey) lastConversionResult = null;

  if (!parsedSizes.ok) {
    lastConversionKey = "";
    lastConversionResult = null;
    output.statusLabel = buildInvalidSizeStatus(file, parsedSizes.errorMessage);
    output.downloadOutput = buildEmptyResult("Fix the icon size list first. Example: 16,24,32,48,64,128,256");
    return output;
  }

  if (changedWidgetIds === "convertBtn") {
    callback({ downloadOutput: buildProgressResult("Loading ImageMagick WASM...") });
    const Magick = await getImageMagick();
    callback({ downloadOutput: buildProgressResult("Converting image to multi-size ICO...") });
    lastConversionResult = await convertImageToIco(Magick, file, parsedSizes.values);
    lastConversionKey = conversionKey;
  }

  output.statusLabel = buildReadyStatus(file, parsedSizes.values, parsedSizes.warnings);
  output.downloadOutput = buildDownloadResult(lastConversionResult, parsedSizes.values, showPreview);
  return output;
}

/**
 * Load and cache ImageMagick WASM.
 */
async function getImageMagick() {
  if (magickModule) return magickModule;
  const Magick = await requirePackage("@imagemagick/magick-wasm");
  await Magick.initializeImageMagick();
  magickModule = Magick;
  return Magick;
}

/**
 * Convert a source image into ICO bytes with multiple icon sizes.
 */
async function convertImageToIco(Magick, file, sizes) {
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  let outputBlob = null;

  Magick.ImageMagick.read(inputBytes, (image) => {
    const autoResizeValue = sizes.join(",");
    image.settings.setDefine("icon:auto-resize", autoResizeValue);
    image.write(Magick.MagickFormat.Ico, (bytes) => {
      outputBlob = new Blob([bytes], { type: "image/x-icon" });
    });
  });

  if (!outputBlob) throw new Error("ICO conversion failed.");
  const dataUrl = await blobToDataUrl(outputBlob);
  const outputName = `${stripFileExtension(file.name) || "icon"}.ico`;
  return { name: outputName, dataUrl: dataUrl, sizeBytes: outputBlob.size };
}

/**
 * Parse and sanitize icon sizes from comma-separated text.
 */
function parseIconSizes(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return { ok: false, values: [], sanitizedText: "", warnings: [], errorMessage: "Icon sizes cannot be empty." };
  const tokens = text.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  if (tokens.length === 0) return { ok: false, values: [], sanitizedText: "", warnings: [], errorMessage: "No valid icon size found." };

  const values = [];
  const seen = new Set();
  const warnings = [];

  for (let i = 0; i < tokens.length; i++) {
    const num = Number(tokens[i]);
    if (!Number.isFinite(num) || num < 1) return { ok: false, values: [], sanitizedText: "", warnings: [], errorMessage: `Invalid icon size: ${escapeHtml(tokens[i])}` };
    const intNum = Math.round(num);
    if (intNum > 1024) return { ok: false, values: [], sanitizedText: "", warnings: [], errorMessage: `Icon size too large: ${intNum}. Max is 1024.` };
    if (intNum > 256) warnings.push(`Size ${intNum}px may not be supported by all icon consumers.`);
    if (!seen.has(intNum)) {
      seen.add(intNum);
      values.push(intNum);
    }
  }

  values.sort((a, b) => a - b);
  return { ok: true, values: values, sanitizedText: values.join(","), warnings: warnings, errorMessage: "" };
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
 * Build initial idle status content.
 */
function buildIdleStatus() {
  return "<div class='text-sm text-muted-foreground'>Upload an image file to prepare ICO conversion.</div>";
}

/**
 * Build status content when size input is invalid.
 */
function buildInvalidSizeStatus(file, errorMessage) {
  const safeName = escapeHtml(file?.name || "source-image");
  return `<div class='space-y-1'><p class='text-sm font-medium text-foreground'>Source: ${safeName}</p><p class='text-sm text-destructive'>${escapeHtml(errorMessage)}</p></div>`;
}

/**
 * Build status content when conversion settings are valid.
 */
function buildReadyStatus(file, sizes, warnings) {
  const safeName = escapeHtml(file?.name || "source-image");
  const sizeText = escapeHtml(sizes.join(", "));
  const warningHtml = warnings.length ? `<ul class='list-disc pl-4 space-y-1 text-xs text-yellow-600'>${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
  return `<div class='space-y-2'><div class='text-sm text-muted-foreground'>Source: <span class='font-medium text-foreground'>${safeName}</span></div><div class='text-sm text-muted-foreground'>ICO sizes: <span class='font-medium text-foreground'>${sizeText}</span></div>${warningHtml}</div>`;
}

/**
 * Build empty result content.
 */
function buildEmptyResult(message) {
  return { innerHtml: `<div class='text-xs text-muted-foreground py-2'>${escapeHtml(message)}</div>` };
}

/**
 * Build conversion progress UI.
 */
function buildProgressResult(message) {
  return {
    innerHtml: `<div class='space-y-2'><div class='text-sm text-muted-foreground'>${escapeHtml(message)}</div><div class='h-2 w-full overflow-hidden rounded-full bg-muted'><div class='h-full w-2/3 animate-pulse rounded-full bg-primary'></div></div></div>`,
  };
}

/**
 * Build downloadable conversion output UI.
 */
function buildDownloadResult(result, sizes, showPreview) {
  if (!result) return buildEmptyResult("Ready to convert. Click Generate ICO.");
  const sizeBadges = sizes.map((size) => `<span class='inline-flex items-center rounded-sm bg-muted/60 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground'>${size}x${size}</span>`).join(" ");
  const fileSize = formatBytes(result.sizeBytes || 0);
  const previewHtml = showPreview ? `<div class='rounded-md border border-border bg-muted/20 p-3'><img class='h-16 w-16 rounded object-contain' src='${result.dataUrl}' alt='ICO preview' /><div class='mt-2 text-xs text-muted-foreground'>Preview depends on browser support for ICO rendering.</div></div>` : "";
  return {
    innerHtml: `<div class='space-y-3'><div class='text-sm font-medium text-foreground'>ICO generated successfully</div><div class='flex flex-wrap gap-1'>${sizeBadges}</div><div class='text-xs text-muted-foreground'>File: <span class='font-medium text-foreground'>${escapeHtml(result.name)}</span> (${escapeHtml(fileSize)})</div><a href='${result.dataUrl}' download='${escapeHtml(result.name)}' class='inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20'>Download ICO</a>${previewHtml}</div>`,
  };
}

/**
 * Convert blob to Data URL for direct download link and preview.
 */
function blobToDataUrl(blob) {
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function handleLoad() {
      resolve(String(reader.result || ""));
    };
    reader.onerror = function handleError() {
      reject(new Error("Failed to read ICO blob."));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Remove file extension from filename.
 */
function stripFileExtension(filename) {
  const text = String(filename || "");
  return text.replace(/\.[^.]+$/, "");
}

/**
 * Format bytes for output UI.
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
