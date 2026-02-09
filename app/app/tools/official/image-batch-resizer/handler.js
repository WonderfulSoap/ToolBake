/**
 * Image Batch Resizer Handler
 * Batch resize images to target pixel dimensions or scale percentage using ImageMagick WASM.
 * Aspect ratio locking uses the first image's dimensions as reference and applies to all images.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @param {HandlerCallback} callback
 * @returns {Promise<HandlerReturnWidgets>}
 */

// Cached state across handler invocations
let firstImageSize = null;
let cachedFirstFile = null;
let lastResults = [];
let magickModule = null;

async function handler(inputWidgets, changedWidgetIds, callback) {
  const files = inputWidgets.imageFiles;
  const resizeMode = inputWidgets.resizeMode || "pixel";
  const keepAspect = inputWidgets.keepAspect !== false;
  const targetWidth = inputWidgets.targetWidth || "";
  const targetHeight = inputWidgets.targetHeight || "";
  const outputFormat = inputWidgets.outputFormat || "keep";

  const result = {};

  // --- No files uploaded: reset state ---
  if (!files || files.length === 0) {
    firstImageSize = null;
    cachedFirstFile = null;
    result.imageInfo = "<div class='text-xs text-muted-foreground'>Upload images to see dimensions.</div>";
    result.resizeProgress = { current: 0, total: 100, percent: 0, label: "Waiting", hint: "" };
    result.resultOutput = "<div class='text-xs text-muted-foreground py-2'>Click <b>Resize All Images</b> to generate resized outputs.</div>";
    return result;
  }

  // --- Load first image dimensions (used as aspect ratio reference) ---
  const isNewFile = cachedFirstFile !== files[0];
  if (!firstImageSize || isNewFile) {
    cachedFirstFile = files[0];
    firstImageSize = await getImageDimensions(files[0]);
    console.log("First image dimensions:", firstImageSize.width, "x", firstImageSize.height);
  }

  // --- Display image info ---
  if (files.length === 1) {
    result.imageInfo = `<div class='text-sm text-muted-foreground'><span class='font-medium text-foreground'>${escapeHtml(files[0].name)}</span> \u2014 ${firstImageSize.width} \u00d7 ${firstImageSize.height}px</div>`;
  } else {
    result.imageInfo = `<div class='text-sm text-muted-foreground'><span class='font-medium text-foreground'>${files.length} images</span> \u2014 First: ${escapeHtml(files[0].name)} (${firstImageSize.width} \u00d7 ${firstImageSize.height}px)</div>`;
  }

  // --- Set default width/height when files change ---
  if (changedWidgetIds === "imageFiles") {
    if (resizeMode === "pixel") {
      result.targetWidth = String(firstImageSize.width);
      result.targetHeight = String(firstImageSize.height);
    } else {
      result.targetWidth = "100";
      result.targetHeight = "100";
    }
  }

  // --- Set default width/height when resize mode changes ---
  if (changedWidgetIds === "resizeMode") {
    if (resizeMode === "pixel") {
      result.targetWidth = String(firstImageSize.width);
      result.targetHeight = String(firstImageSize.height);
    } else {
      result.targetWidth = "100";
      result.targetHeight = "100";
    }
  }

  // --- Aspect ratio auto-calculation ---
  if (keepAspect && firstImageSize) {
    const aspectRatio = firstImageSize.width / firstImageSize.height;

    if (resizeMode === "pixel") {
      // Pixel mode: derive the other dimension from aspect ratio
      if (changedWidgetIds === "targetWidth" && targetWidth) {
        const w = parseFloat(targetWidth);
        if (!isNaN(w) && w > 0) {
          result.targetHeight = String(Math.round(w / aspectRatio));
        }
      } else if (changedWidgetIds === "targetHeight" && targetHeight) {
        const h = parseFloat(targetHeight);
        if (!isNaN(h) && h > 0) {
          result.targetWidth = String(Math.round(h * aspectRatio));
        }
      }
    } else {
      // Scale mode: keep both percentages in sync
      if (changedWidgetIds === "targetWidth" && targetWidth) {
        result.targetHeight = targetWidth;
      } else if (changedWidgetIds === "targetHeight" && targetHeight) {
        result.targetWidth = targetHeight;
      }
    }
  }

  // --- Batch resize on button click ---
  if (changedWidgetIds === "runResize") {
    const w = parseFloat(targetWidth);
    const h = parseFloat(targetHeight);

    if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      result.resultOutput = "<div class='text-sm text-destructive py-2'>Please enter valid width and height values.</div>";
      return result;
    }

    // Initialize ImageMagick WASM
    if (!magickModule) {
      console.log("Loading ImageMagick WASM...");
      callback({
        resizeProgress: { current: 0, total: 100, percent: 0, label: "Loading ImageMagick...", hint: "First load may take a few seconds" },
      });
      magickModule = await requirePackage("@imagemagick/magick-wasm");
      await magickModule.initializeImageMagick();
      console.log("ImageMagick WASM initialized");
    }

    console.log(`Starting batch resize: ${files.length} images, mode=${resizeMode}, w=${w}, h=${h}, format=${outputFormat}`);
    lastResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Resizing ${i + 1}/${files.length}: ${file.name}`);

      callback({
        resizeProgress: {
          current: i,
          total: files.length,
          percent: Math.round((i / files.length) * 100),
          label: `Resizing ${i + 1}/${files.length}`,
          hint: file.name,
        },
      });

      try {
        const resized = await resizeImage(magickModule, file, resizeMode, w, h, outputFormat);
        lastResults.push(resized);
      } catch (err) {
        console.error(`Failed to resize ${file.name}:`, err);
        lastResults.push({ name: file.name, error: err.message || "Resize failed" });
      }
    }

    console.log("Batch resize complete:", lastResults.filter(r => !r.error).length, "succeeded,", lastResults.filter(r => r.error).length, "failed");

    result.resizeProgress = {
      current: files.length,
      total: files.length,
      percent: 100,
      label: "Complete",
      hint: `${lastResults.filter(r => !r.error).length} images resized`,
    };
  }

  // --- Build result output ---
  result.resultOutput = buildResultHtml(lastResults);

  return result;
}

// ─── Helper Functions ────────────────────────────────────────────────

/**
 * Get image dimensions from a File object using an offscreen Image element.
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

/**
 * Resize a single image using ImageMagick WASM.
 * Uses Lanczos filter for high-quality downsampling.
 *
 * @param {object} Magick - ImageMagick WASM module
 * @param {File} file - Source image file
 * @param {string} mode - "pixel" or "scale"
 * @param {number} targetW - Target width (pixels) or width percentage
 * @param {number} targetH - Target height (pixels) or height percentage
 * @param {string} outputFormat - "keep" | "png" | "jpeg" | "webp"
 */
async function resizeImage(Magick, file, mode, targetW, targetH, outputFormat) {
  const arrayBuffer = await file.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  let finalW, finalH;
  let resultDataUrl = null;
  let outputName = file.name;

  Magick.ImageMagick.read(inputBytes, (image) => {
    const origW = image.width;
    const origH = image.height;

    // Calculate target dimensions
    if (mode === "pixel") {
      finalW = Math.max(1, Math.round(targetW));
      finalH = Math.max(1, Math.round(targetH));
    } else {
      // Scale mode: interpret as percentages of original image
      finalW = Math.max(1, Math.round(origW * (targetW / 100)));
      finalH = Math.max(1, Math.round(origH * (targetH / 100)));
    }

    console.log(`  ${file.name}: ${origW}x${origH} -> ${finalW}x${finalH}`);

    // Resize with Lanczos filter (high quality)
    image.resize(finalW, finalH);

    // Determine output format
    const magickFormat = resolveOutputFormat(Magick, file, outputFormat);
    const ext = getExtFromMagickFormat(magickFormat);

    // Apply JPEG quality if outputting JPEG
    if (magickFormat === Magick.MagickFormat.Jpeg) {
      image.quality = 92;
    } else if (magickFormat === Magick.MagickFormat.WebP) {
      image.quality = 90;
    }

    // Write output
    image.write(magickFormat, (data) => {
      const base64 = arrayBufferToBase64(data);
      const mimeType = getMimeFromExt(ext);
      resultDataUrl = `data:${mimeType};base64,${base64}`;

      const baseName = file.name.replace(/\.[^.]+$/, "");
      outputName = `${baseName}_${finalW}x${finalH}.${ext}`;
    });
  });

  return { name: outputName, dataUrl: resultDataUrl, width: finalW, height: finalH };
}

/**
 * Resolve the MagickFormat enum for the desired output.
 */
function resolveOutputFormat(Magick, file, outputFormat) {
  if (outputFormat !== "keep") {
    const formatMap = {
      png : Magick.MagickFormat.Png,
      jpeg: Magick.MagickFormat.Jpeg,
      webp: Magick.MagickFormat.WebP,
      gif : Magick.MagickFormat.Gif,
      bmp : Magick.MagickFormat.Bmp,
      tiff: Magick.MagickFormat.Tiff,
    };
    return formatMap[outputFormat] || Magick.MagickFormat.Png;
  }

  // "keep" - try to infer from file extension
  const ext = file.name.split(".").pop().toLowerCase();
  const extMap = {
    jpg : Magick.MagickFormat.Jpeg,
    jpeg: Magick.MagickFormat.Jpeg,
    png : Magick.MagickFormat.Png,
    webp: Magick.MagickFormat.WebP,
    gif : Magick.MagickFormat.Gif,
    bmp : Magick.MagickFormat.Bmp,
    tiff: Magick.MagickFormat.Tiff,
    tif : Magick.MagickFormat.Tiff,
  };
  return extMap[ext] || Magick.MagickFormat.Png;
}

/**
 * Get file extension string from MagickFormat value.
 */
function getExtFromMagickFormat(format) {
  // MagickFormat values are strings like "Png", "Jpeg", etc.
  const map = { Jpeg: "jpg", Png: "png", WebP: "webp", Gif: "gif", Bmp: "bmp", Tiff: "tiff" };
  return map[format] || "png";
}

/**
 * Get MIME type from file extension.
 */
function getMimeFromExt(ext) {
  const map = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", bmp: "image/bmp", tiff: "image/tiff" };
  return map[ext] || "image/png";
}

/**
 * Convert Uint8Array to Base64 string.
 */
function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Build the result gallery HTML with per-file download links and a Download All button.
 */
function buildResultHtml(results) {
  if (!results || results.length === 0) {
    return "<div class='text-xs text-muted-foreground py-2'>Click <b>Resize All Images</b> to generate resized outputs.</div>";
  }

  const success = results.filter(r => !r.error);
  const errors = results.filter(r => r.error);

  let html = "<div data-download-container class='space-y-3'>";

  // Summary line
  html += "<div class='text-sm font-medium text-foreground'>";
  html += `Resized ${success.length} image${success.length !== 1 ? "s" : ""}`;
  if (errors.length > 0) html += ` <span class='text-destructive'>(${errors.length} failed)</span>`;
  html += "</div>";

  // Download All button (only if > 1 success)
  if (success.length > 1) {
    html += `<a href="#" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20" onclick="(function(el){var root=el.closest('[data-download-container]');if(!root)return false;var links=root.querySelectorAll('a[data-download-file]');links.forEach(function(link,index){setTimeout(function(){link.click();},index*100);});return false;})(this)">Download All (${success.length})</a>`;
  }

  // Per-file download links
  html += "<div class='flex flex-wrap gap-2'>";
  results.forEach(function (r) {
    if (r.error) {
      html += `<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-destructive/10 text-destructive">${escapeHtml(r.name)}: ${escapeHtml(r.error)}</span>`;
    } else {
      html += `<a href="${r.dataUrl}" download="${escapeHtml(r.name)}" data-download-file="true" class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors">${escapeHtml(r.name)} (${r.width}\u00d7${r.height})</a>`;
    }
  });
  html += "</div>";

  html += "</div>";
  return html;
}

/**
 * Escape HTML special characters to prevent XSS in dynamic content.
 */
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
