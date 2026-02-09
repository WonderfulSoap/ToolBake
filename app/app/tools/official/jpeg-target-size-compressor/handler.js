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
  const files = normalizeInputFiles(inputWidgets.source_images);
  const targetSize = normalizeTargetSize(inputWidgets.target_size);
  const quality = normalizeQuality(inputWidgets.quality, 85);
  const stripMeta = Boolean(inputWidgets.strip_meta);
  const sampling420 = Boolean(inputWidgets.sampling_420);
  const interlacePlane = Boolean(inputWidgets.interlace_plane);
  const shouldRun = changedWidgetIds === "compress_trigger";

  console.log("inputWidgets:", JSON.stringify({
    fileCount: files.length,
    targetSize,
    quality,
    stripMeta,
    sampling420,
    interlacePlane,
    shouldRun,
    changedWidgetIds,
  }));

  // Only run compression after the explicit button click.
  if (changedWidgetIds && !shouldRun) {
    revokeObjectUrls();
    return buildIdleResponse(files.length, targetSize);
  }

  if (!files.length) {
    revokeObjectUrls();
    return buildEmptyResponse();
  }

  if (!targetSize) {
    revokeObjectUrls();
    return buildValidationResponse("Target size must look like 800KB or 1MB.");
  }

  if (!shouldRun) return buildIdleResponse(files.length, targetSize);

  const Magick = await getMagickModule();
  const results = [];
  const total = files.length;

  revokeObjectUrls();
  callback({ compress_progress: buildProgressValue(0, "Starting", "Preparing ImageMagick") });

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const label = `Compressing ${index + 1}/${total}`;
    const hint = file.name || "JPEG";

    callback({ compress_progress: buildProgressValue(percentForIndex(index, total, 0), label, hint) });

    if (!isJpegFile(file)) {
      results.push(buildErrorEntry(file, "Skipped: not a JPEG file."));
      callback({ compress_progress: buildProgressValue(percentForIndex(index + 1, total, 100), label, "Skipped") });
      continue;
    }

    const output = await compressJpeg(Magick, file, {
      targetSize,
      quality,
      stripMeta,
      sampling420,
      interlacePlane,
    });

    results.push(output);
    callback({ compress_progress: buildProgressValue(percentForIndex(index + 1, total, 100), label, "Done") });
  }

  return buildFinalResponse(results);
}

// Cache ImageMagick module to avoid repeated wasm initialization.
let magickModule = null;

// Track object URLs to release between runs.
let outputUrls = [];

// Normalize FilesUploadInput payloads to a stable array.
function normalizeInputFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item instanceof Blob);
  if (value instanceof Blob) return [value];
  return [];
}

// Normalize the target size text into a jpeg:extent compatible string.
function normalizeTargetSize(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i);
  if (!match) return null;
  const amount = match[1];
  const unit = (match[2] || "kb").toUpperCase();
  return `${amount}${unit}`;
}

// Normalize slider quality to a safe integer.
function normalizeQuality(value, fallback) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(1, Math.round(numeric)));
}

// Validate JPEG file type by mime or extension.
function isJpegFile(file) {
  const type = String(file.type || "").toLowerCase();
  if (type === "image/jpeg") return true;
  const name = String(file.name || "").toLowerCase();
  return name.endsWith(".jpg") || name.endsWith(".jpeg");
}

// Build a progress payload with normalized values.
function buildProgressValue(percent, label, hint) {
  const safe = clampPercent(percent);
  return {
    current: safe,
    total  : 100,
    percent: safe,
    label  : label || "",
    hint   : hint || "",
  };
}

// Clamp a percent value between 0 and 100.
function clampPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

// Calculate a progress percent for a file index and local percent.
function percentForIndex(index, total, localPercent) {
  if (total <= 0) return clampPercent(localPercent);
  const span = 100 / total;
  const local = clampPercent(localPercent) / 100;
  return Math.min(100, Math.round(index * span + span * local));
}

// Compress a single JPEG file with ImageMagick and return output metadata.
async function compressJpeg(Magick, file, options) {
  const { targetSize, quality, stripMeta, sampling420, interlacePlane } = options;
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  let outputBlob = null;

  Magick.ImageMagick.read(inputBytes, (image) => {
    console.log(`Compressing ${file.name} ${image.width}x${image.height}`);
    image.quality = quality;
    image.settings.setDefine("jpeg:extent", targetSize);
    if (stripMeta) image.strip();
    if (sampling420) image.settings.setDefine("jpeg:sampling-factor", "4:2:0");
    if (interlacePlane) image.interlace = Magick.Interlace.Plane;

    image.write(Magick.MagickFormat.Jpeg, (data) => {
      outputBlob = new Blob([data], { type: "image/jpeg" });
    });
  });

  if (!outputBlob) throw new Error("Failed to generate JPEG output.");
  const outputName = buildOutputName(file.name);
  const url = createObjectUrl(outputBlob);

  return {
    fileName  : outputName,
    url,
    beforeSize: file.size,
    afterSize : outputBlob.size,
  };
}

// Get or initialize the ImageMagick wasm module.
async function getMagickModule() {
  if (!magickModule) {
    magickModule = await requirePackage("@imagemagick/magick-wasm");
    await magickModule.initializeImageMagick();
  }
  return magickModule;
}

// Build an output name with jpg extension.
function buildOutputName(name) {
  const safeName = sanitizeFileName(name, "image");
  const base = safeName.replace(/\.[^.]+$/, "");
  return `${base || "image"}.jpg`;
}

// Sanitize file names for safe output display.
function sanitizeFileName(value, fallback) {
  const raw = String(value || "").split(/[\\/]/).pop() || "";
  const cleaned = raw.replace(/\s+/g, " ").replace(/["']/g, "").trim();
  return cleaned || fallback;
}

// Create a stable object URL and keep it for cleanup.
function createObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  outputUrls.push(url);
  return url;
}

// Release all previous object URLs before generating new ones.
function revokeObjectUrls() {
  outputUrls.forEach((url) => URL.revokeObjectURL(url));
  outputUrls = [];
}

// Build an error entry for skipped files.
function buildErrorEntry(file, message) {
  return {
    fileName: sanitizeFileName(file.name, "image"),
    error   : message,
  };
}

// Build the response for the empty state.
function buildEmptyResponse() {
  return {
    compress_progress: buildProgressValue(0, "Idle", "Waiting for images"),
    status_label     : buildStatusHtml("Upload JPEG files to start compression."),
    output_label     : buildPlaceholderHtml("Compressed files will appear here."),
  };
}

// Build an idle response when inputs change but compression is not requested yet.
function buildIdleResponse(fileCount, targetSize) {
  const sizeNote = targetSize ? `Target ${targetSize}.` : "Set a target size.";
  const label = fileCount ? `Ready to compress ${fileCount} file(s). ${sizeNote}` : "Upload JPEG files to begin.";
  return {
    compress_progress: buildProgressValue(0, "Idle", "Waiting for confirmation"),
    status_label     : buildStatusHtml(label),
    output_label     : buildPlaceholderHtml("Click the button to start compression."),
  };
}

// Build the response for validation errors.
function buildValidationResponse(message) {
  return {
    compress_progress: buildProgressValue(0, "Invalid input", "Check target size"),
    status_label     : buildStatusHtml(message),
    output_label     : buildPlaceholderHtml("No output generated."),
  };
}

// Build the final response with downloads and status summary.
function buildFinalResponse(results) {
  const successCount = results.filter((item) => !item.error).length;
  const errorCount = results.length - successCount;
  const statusMessage = errorCount
    ? `Completed with ${successCount} success(es) and ${errorCount} skipped file(s).`
    : `Compressed ${successCount} file(s).`;

  return {
    compress_progress: buildProgressValue(100, "Done", "Compression finished"),
    status_label     : buildStatusHtml(statusMessage),
    output_label     : buildResultsHtml(results),
  };
}

// Build a consistent status label HTML block.
function buildStatusHtml(message) {
  return `<div class="text-sm text-muted-foreground">${escapeHtml(message)}</div>`;
}

// Build placeholder HTML blocks for empty output.
function buildPlaceholderHtml(message) {
  return `<div class="text-sm text-muted-foreground">${escapeHtml(message)}</div>`;
}

// Build the results HTML including Download All when possible.
function buildResultsHtml(results) {
  if (!results.length) return buildPlaceholderHtml("No output generated.");
  const successResults = results.filter((item) => !item.error);
  const downloadAll = successResults.length
    ? `
      <a
        href="#"
        class="text-sm text-primary underline"
        onclick="(function(el){var root=el.closest('[data-download-container]');if(!root)return false;var links=root.querySelectorAll('a[data-download-file]');links.forEach(function(link,index){setTimeout(function(){link.click();},index*100);});return false;})(this)"
      >
        Download All (${successResults.length})
      </a>
    `
    : "";

  const rows = results.map((item) => buildResultRow(item)).join("");
  return `
    <div class="space-y-3" data-download-container="true">
      ${downloadAll}
      <div class="space-y-2">
        ${rows}
      </div>
    </div>
  `;
}

// Build each row for success or error entries.
function buildResultRow(item) {
  if (item.error) {
    return `
      <div class="rounded border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <div class="font-medium text-foreground">${escapeHtml(item.fileName)}</div>
        <div>${escapeHtml(item.error)}</div>
      </div>
    `;
  }

  const sizeLine = `${formatBytes(item.beforeSize)} → ${formatBytes(item.afterSize)}`;
  return `
    <div class="rounded border border-border bg-background p-3 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="space-y-1">
          <div class="font-medium text-foreground">${escapeHtml(item.fileName)}</div>
          <div class="text-muted-foreground">${escapeHtml(sizeLine)}</div>
        </div>
        <a
          href="${item.url}"
          download="${escapeHtml(item.fileName)}"
          data-download-file="true"
          class="text-primary underline"
        >
          Download
        </a>
      </div>
    </div>
  `;
}

// Format bytes into a human readable string.
function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value)) return "-";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let unitIndex = -1;
  let current = value;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// Escape HTML to keep label content safe.
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
