/**
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widgetId"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * - Checks the 'uiWidgets' tab to check and modify the input/output UI widgets of this tool
 * - The 'handler.d.ts' tab shows the full auto generated type definitions for the handler function
 * 
 * !! The jsdoc comment below describes the handler function signature, and provides type information for the editor. Don't remove it.
 *
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  console.log("Image diff handler start", { changedWidgetIds });

  const imageA = inputWidgets["image-a-upload"] || null;
  const imageB = inputWidgets["image-b-upload"] || null;
  const shouldCompare = changedWidgetIds === "compare-diff-btn";
  const highlightColor = normalizeColor(inputWidgets["highlight-color"], "#ef4444");
  const lowlightColor = normalizeColor(inputWidgets["lowlight-color"], "#0f172a");

  const previewAUrl = await readFileAsDataUrl(imageA);
  const previewBUrl = await readFileAsDataUrl(imageB);

  const output = {
    "image-a-preview": buildPreviewLabel(previewAUrl, imageA, "No image selected."),
    "image-b-preview": buildPreviewLabel(previewBUrl, imageB, "No image selected."),
  };

  if (!imageA || !imageB) {
    console.log("Waiting for both images to be uploaded");
    output["diff-image"] = buildEmptyLabel("Upload two images to generate a diff.");
    output["diff-report"] = buildEmptyLabel("Upload two images and click Compare Diff to see the report.");
    return output;
  }

  if (!shouldCompare) {
    console.log("Images ready, waiting for compare action");
    output["diff-image"] = buildEmptyLabel("Ready to compare. Click Compare Diff.");
    output["diff-report"] = buildEmptyLabel("Ready. Click Compare Diff to run ImageMagick compare.");
    return output;
  }

  console.log("Loading ImageMagick WASM for diff compare");
  const Magick = await getImageMagick();
  console.log("ImageMagick loaded, starting compare");

  const imageABytes = new Uint8Array(await imageA.arrayBuffer());
  const imageBBytes = new Uint8Array(await imageB.arrayBuffer());

  const compareResult = compareImagesWithMagick(Magick, imageABytes, imageBBytes, highlightColor, lowlightColor);
  console.log("Compare result summary", {
    hasDiffBytes: Boolean(compareResult.diffBytes),
    distortion  : compareResult.distortion,
    error       : compareResult.errorMessage,
    sizeA       : compareResult.sizeA,
    sizeB       : compareResult.sizeB,
  });

  if (compareResult.errorMessage) {
    console.log("Compare aborted:", compareResult.errorMessage);
    output["diff-image"] = buildEmptyLabel(compareResult.errorMessage);
    output["diff-report"] = buildReportLabel(compareResult, imageA, imageB);
    return output;
  }

  if (!compareResult.diffBytes) throw new Error("ImageMagick compare failed to produce a diff image.");

  const diffDataUrl = await buildPngDataUrl(compareResult.diffBytes);
  console.log("Diff image generated, bytes:", compareResult.diffBytes.length, "distortion:", compareResult.distortion);

  output["diff-image"] = buildDiffLabel(diffDataUrl);
  output["diff-report"] = buildReportLabel(compareResult, imageA, imageB);
  return output;
}

let magickModule;

/**
 * Load and cache the ImageMagick WASM module for repeat comparisons.
 */
async function getImageMagick() {
  if (magickModule) return magickModule;
  const Magick = await requirePackage("@imagemagick/magick-wasm");
  await Magick.initializeImageMagick();
  magickModule = Magick;
  return Magick;
}

/**
 * Compare two images using ImageMagick and return diff image bytes plus metrics.
 */
function compareImagesWithMagick(Magick, imageABytes, imageBBytes, highlightColor, lowlightColor) {
  let diffBytes = null;
  let distortion = null;
  let sizeA = null;
  let sizeB = null;
  let errorMessage = "";

  const metricName = "RootMeanSquared";

  Magick.ImageMagick.read(imageABytes, (imageA) => {
    sizeA = { width: imageA.width, height: imageA.height, format: imageA.format, formatName: formatMagickFormat(Magick, imageA.format) };
    console.log("Image A loaded", sizeA);
    Magick.ImageMagick.read(imageBBytes, (imageB) => {
      sizeB = { width: imageB.width, height: imageB.height, format: imageB.format, formatName: formatMagickFormat(Magick, imageB.format) };
      console.log("Image B loaded", sizeB);
      if (sizeA.width !== sizeB.width || sizeA.height !== sizeB.height) {
        errorMessage = `Image sizes do not match (${sizeA.width}x${sizeA.height} vs ${sizeB.width}x${sizeB.height}).`;
        return;
      }

      const settings = new Magick.CompareSettings(Magick.ErrorMetric.RootMeanSquared);
      settings.highlightColor = new Magick.MagickColor(highlightColor);
      settings.lowlightColor = new Magick.MagickColor(lowlightColor);
      console.log("Compare settings", { metricName, highlightColor, lowlightColor });

      imageA.compare(imageB, settings, (result) => {
        distortion = result.distortion;
        console.log("Compare distortion value", distortion);
        const diffImage = result.difference;
        diffImage.write(Magick.MagickFormat.Png, (data) => { diffBytes = data; });
        console.log("Diff image bytes ready", diffBytes ? diffBytes.length : 0);
        if (diffBytes && diffBytes.length > 8) console.log("Diff image signature", bytesToHex(diffBytes.slice(0, 8)));
      });
    });
  });

  return { diffBytes, distortion, sizeA, sizeB, metricName, errorMessage, highlightColor, lowlightColor };
}

/**
 * Build a preview label HTML for an uploaded file.
 */
function buildPreviewLabel(dataUrl, file, emptyMessage) {
  if (!dataUrl || !file) return `<div class='text-sm text-muted-foreground'>${emptyMessage}</div>`;
  const sizeLabel = formatBytes(file.size || 0);
  return `<div class='space-y-2'><img class='max-h-64 w-full rounded border border-border object-contain' src='${dataUrl}' alt='Image preview' /><div class='text-xs text-muted-foreground'>${escapeHtml(file.name || "image")} | ${sizeLabel}</div></div>`;
}

/**
 * Build the diff image label HTML.
 */
function buildDiffLabel(dataUrl) {
  return `<div class='space-y-2'><img class='max-h-[420px] w-full rounded border border-border object-contain' src='${dataUrl}' alt='Diff image' /><div class='text-xs text-muted-foreground'>Diff image generated by ImageMagick compare.</div></div>`;
}

/**
 * Build a placeholder label when no output is available.
 */
function buildEmptyLabel(message) {
  return `<div class='text-sm text-muted-foreground'>${message}</div>`;
}

/**
 * Build a report label HTML from compare results.
 */
function buildReportLabel(result, imageA, imageB) {
  if (result.errorMessage) {
    return `<div class='space-y-2'><p class='text-sm font-semibold text-destructive'>Comparison Failed</p><div class='text-sm text-destructive'>${result.errorMessage}</div><ul class='list-disc pl-4 space-y-1 text-sm text-muted-foreground'><li>Image A: ${escapeHtml(imageA?.name || "Image A")} (${formatBytes(imageA?.size || 0)})</li><li>Image B: ${escapeHtml(imageB?.name || "Image B")} (${formatBytes(imageB?.size || 0)})</li></ul></div>`;
  }
  if (!result.sizeA || !result.sizeB || !Number.isFinite(result.distortion)) {
    return "<div class='text-sm text-muted-foreground'>No comparison data available.</div>";
  }

  const sizeA = `${result.sizeA.width}x${result.sizeA.height}`;
  const sizeB = `${result.sizeB.width}x${result.sizeB.height}`;
  const distortionText = formatNumber(result.distortion, 6);
  const statusText = result.distortion === 0 ? "Identical" : "Different";
  const formatA = result.sizeA.formatName || String(result.sizeA.format || "-");
  const formatB = result.sizeB.formatName || String(result.sizeB.format || "-");

  return `<div class='space-y-2'><p class='text-sm font-semibold text-foreground'>Comparison Report</p><ul class='list-disc pl-4 space-y-1 text-sm text-muted-foreground'><li>Status: <span class='font-medium text-foreground'>${statusText}</span></li><li>Metric: <span class='font-medium text-foreground'>${result.metricName}</span></li><li>Distortion: <span class='font-medium text-foreground'>${distortionText}</span></li><li>Highlight Color: <span class='font-medium text-foreground'>${escapeHtml(result.highlightColor || "-")}</span></li><li>Lowlight Color: <span class='font-medium text-foreground'>${escapeHtml(result.lowlightColor || "-")}</span></li><li>Image A: ${escapeHtml(imageA?.name || "Image A")} (${sizeA}, ${formatA}, ${formatBytes(imageA?.size || 0)})</li><li>Image B: ${escapeHtml(imageB?.name || "Image B")} (${sizeB}, ${formatB}, ${formatBytes(imageB?.size || 0)})</li></ul></div>`;
}

/**
 * Read a file as a Data URL for preview rendering.
 */
function readFileAsDataUrl(file) {
  if (!file) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert PNG bytes into a Data URL for output display.
 */
function buildPngDataUrl(bytes) {
  const blob = new Blob([bytes], { type: "image/png" });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      console.log("Diff dataUrl generated", { length: dataUrl.length, prefix: dataUrl.slice(0, 40) });
      resolve(dataUrl);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Normalize a color value for ImageMagick, fallback when invalid.
 */
function normalizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed) ? trimmed : fallback;
}

/**
 * Resolve the ImageMagick format enum to a readable label.
 */
function formatMagickFormat(Magick, value) {
  if (!Magick || !Magick.MagickFormat) return "";
  const entries = Object.entries(Magick.MagickFormat);
  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    if (val === value) return key;
  }
  return "";
}

/**
 * Convert bytes to hex string for quick signature inspection.
 */
function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Format byte counts for readable UI output.
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * Format numbers with a fixed precision.
 */
function formatNumber(value, digits) {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toFixed(digits);
}

/**
 * Escape HTML text to avoid markup breaks in labels.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
