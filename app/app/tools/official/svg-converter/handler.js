/**
 * SVG to Raster Image Converter Handler
 * Converts SVG files to PNG, JPEG, WebP, or BMP using Canvas API.
 * Supports custom dimensions and scaling since SVG is resolution-independent.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @param {HandlerCallback} callback
 * @returns {Promise<HandlerReturnWidgets>}
 */

// Global state for conversion result persistence
let lastConversionResult = null;
let svgInfo = null;

async function handler(inputWidgets, changedWidgetIds, callback) {
  const file = inputWidgets.svgFile;
  const targetFormat = inputWidgets.targetFormat || "png";
  const sizeMode = inputWidgets.sizeMode || "original";
  const jpegQuality = inputWidgets.jpegQuality || 92;
  const backgroundColor = inputWidgets.backgroundColor || "#FFFFFF";
  // Parse toggle value defensively because widget values may be serialized as strings.
  const showPreview = parseToggleValue(inputWidgets.showPreview, true);

  // Read size options from the dynamic label
  const sizeData = getSizeOptionsData(inputWidgets.sizeOptions);

  const result = {};

  // Hide JPEG quality slider when not using JPEG
  // (handled via CSS visibility in UI, but we could also use label to show/hide)

  // Handle no file state
  if (!file) {
    result.statusLabel = buildNoFileStatus();
    result.sizeOptions = buildEmptySizeOptions();
    result.downloadOutput = buildEmptyDownloadUI();
    svgInfo = null;
    return result;
  }

  // Validate SVG file type
  const isSvg = file.type === "image/svg+xml" ||
                file.name?.toLowerCase().endsWith(".svg");

  if (!isSvg) {
    result.statusLabel = buildErrorStatus("Invalid file type. Please upload an SVG file (.svg).");
    result.sizeOptions = buildEmptySizeOptions();
    result.downloadOutput = buildEmptyDownloadUI();
    svgInfo = null;
    return result;
  }

  // Read SVG content and extract dimensions
  try {
    const svgContent = await file.text();
    const dimensions = extractSvgDimensions(svgContent);

    if (!dimensions.width || !dimensions.height) {
      result.statusLabel = buildErrorStatus("Could not determine SVG dimensions. Please ensure the SVG has valid width/height or viewBox attributes.");
      result.sizeOptions = buildEmptySizeOptions();
      result.downloadOutput = buildEmptyDownloadUI();
      return result;
    }

    svgInfo = {
      content       : svgContent,
      originalWidth : dimensions.width,
      originalHeight: dimensions.height,
      aspectRatio   : dimensions.width / dimensions.height,
    };

    console.log(`SVG loaded: ${file.name}, original size: ${dimensions.width}x${dimensions.height}`);

    // Show SVG info status
    result.statusLabel = buildSvgInfoStatus(file.name, dimensions.width, dimensions.height);

    // Build size options UI based on mode
    result.sizeOptions = buildSizeOptionsUI(sizeMode, svgInfo, sizeData);

  } catch (err) {
    console.error("Failed to parse SVG:", err);
    result.statusLabel = buildErrorStatus(`Failed to parse SVG: ${err.message}`);
    result.sizeOptions = buildEmptySizeOptions();
    result.downloadOutput = buildEmptyDownloadUI();
    return result;
  }

  // Handle size mode change - update size options UI
  if (changedWidgetIds === "sizeMode") {
    result.sizeOptions = buildSizeOptionsUI(sizeMode, svgInfo, sizeData);
  }

  // Handle convert button click
  if (changedWidgetIds === "convertBtn" && svgInfo) {
    console.log(`Starting conversion to ${targetFormat}, size mode: ${sizeMode}`);

    // Calculate output dimensions
    const outputSize = calculateOutputSize(sizeMode, svgInfo, sizeData);
    console.log(`Output size: ${outputSize.width}x${outputSize.height}`);

    callback({
      downloadOutput: buildProgressUI(),
    });

    try {
      lastConversionResult = await convertSvgToImage(
        svgInfo.content,
        outputSize.width,
        outputSize.height,
        targetFormat,
        jpegQuality / 100,
        backgroundColor,
        file.name
      );

      console.log(`Conversion complete: ${lastConversionResult.name}, size: ${lastConversionResult.sizeBytes} bytes`);
    } catch (err) {
      console.error("Conversion failed:", err);
      lastConversionResult = {
        error: err.message || "Conversion failed",
        name : file.name,
      };
    }
  }

  // Build download UI with result
  result.downloadOutput = buildDownloadUI(lastConversionResult, showPreview);

  return result;
}

/**
 * Parse toggle-like values from input widgets to a strict boolean.
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
 * Extract width and height from SVG content.
 * Parses width/height attributes or viewBox.
 */
function extractSvgDimensions(svgContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgEl = doc.querySelector("svg");

  if (!svgEl) {
    return { width: null, height: null };
  }

  let width = null;
  let height = null;

  // Try to get explicit width/height attributes
  const widthAttr = svgEl.getAttribute("width");
  const heightAttr = svgEl.getAttribute("height");

  if (widthAttr && heightAttr) {
    width = parseSize(widthAttr);
    height = parseSize(heightAttr);
  }

  // If no explicit dimensions, try viewBox
  if (!width || !height) {
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/);
      if (parts.length >= 4) {
        const vbWidth = parseFloat(parts[2]);
        const vbHeight = parseFloat(parts[3]);
        if (!isNaN(vbWidth) && !isNaN(vbHeight) && vbWidth > 0 && vbHeight > 0) {
          width = width || vbWidth;
          height = height || vbHeight;
        }
      }
    }
  }

  // Default fallback
  if (!width) width = 300;
  if (!height) height = 150;

  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Parse SVG size value (e.g., "100px", "50%", "200")
 */
function parseSize(value) {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

/**
 * Read LabelInput collected data for size options.
 */
function getSizeOptionsData(labelValue) {
  const rawData = labelValue && labelValue.data ? labelValue.data : {};
  return rawData["size-options-root"] || {};
}

/**
 * Get data attribute value with fallback.
 */
function getDataAttr(data, key, fallback) {
  const value = data ? data[`data-${key}`] : undefined;
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

/**
 * Calculate output dimensions based on size mode.
 */
function calculateOutputSize(sizeMode, svgInfo, sizeData) {
  const { originalWidth, originalHeight } = svgInfo;

  switch (sizeMode) {
    case "custom": {
      const customWidth = parseInt(getDataAttr(sizeData, "custom-width", String(originalWidth)), 10);
      const customHeight = parseInt(getDataAttr(sizeData, "custom-height", String(originalHeight)), 10);
      const lockRatio = getDataAttr(sizeData, "lock-ratio", "true") === "true";

      if (lockRatio) {
        // Use width as primary, calculate height
        const ratio = originalHeight / originalWidth;
        return {
          width : Math.max(1, customWidth),
          height: Math.max(1, Math.round(customWidth * ratio)),
        };
      }
      return {
        width : Math.max(1, customWidth || originalWidth),
        height: Math.max(1, customHeight || originalHeight),
      };
    }

    case "scale": {
      const scalePercent = parseInt(getDataAttr(sizeData, "scale-percent", "100"), 10);
      const scale = Math.max(1, scalePercent) / 100;
      return {
        width : Math.max(1, Math.round(originalWidth * scale)),
        height: Math.max(1, Math.round(originalHeight * scale)),
      };
    }

    case "original":
    default:
      return { width: originalWidth, height: originalHeight };
  }
}

/**
 * Convert SVG to raster image using Canvas API.
 */
async function convertSvgToImage(svgContent, width, height, format, quality, bgColor, originalName) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Create blob URL for SVG
    const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        // Create canvas with target dimensions
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // Fill background color (important for JPEG which doesn't support transparency)
        if (format === "jpg" || format === "bmp" || (bgColor && bgColor !== "transparent" && bgColor !== "#00000000")) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, width, height);
        }

        // Draw SVG onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Get MIME type and extension
        const { mimeType, ext } = getFormatInfo(format);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create image blob"));
              return;
            }

            // Create data URL
            const reader = new FileReader();
            reader.onload = () => {
              const baseName = originalName.replace(/\.[^.]+$/, "");
              resolve({
                name     : `${baseName}.${ext}`,
                dataUrl  : reader.result,
                sizeBytes: blob.size,
                width,
                height,
              });
            };
            reader.onerror = () => reject(new Error("Failed to read blob"));
            reader.readAsDataURL(blob);
          },
          mimeType,
          format === "jpg" || format === "webp" ? quality : undefined
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG image"));
    };

    img.src = url;
  });
}

/**
 * Get MIME type and extension for format.
 */
function getFormatInfo(format) {
  const formats = {
    png : { mimeType: "image/png", ext: "png" },
    jpg : { mimeType: "image/jpeg", ext: "jpg" },
    webp: { mimeType: "image/webp", ext: "webp" },
    bmp : { mimeType: "image/bmp", ext: "bmp" },
  };
  return formats[format] || formats.png;
}

/**
 * Build no file status message.
 */
function buildNoFileStatus() {
  return {
    innerHtml: "",
  };
}

/**
 * Build error status message.
 */
function buildErrorStatus(message) {
  return {
    innerHtml: `
      <div class="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
        <svg class="w-4 h-4 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="text-sm text-destructive">${escapeHtml(message)}</span>
      </div>
    `,
  };
}

/**
 * Build SVG info status message.
 */
function buildSvgInfoStatus(filename, width, height) {
  return {
    innerHtml: `
      <div class="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
        <svg class="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="text-sm text-foreground">
          <span class="font-medium">${escapeHtml(filename)}</span>
          <span class="text-muted-foreground ml-2">${width} x ${height} px</span>
        </span>
      </div>
    `,
  };
}

/**
 * Build empty size options placeholder.
 */
function buildEmptySizeOptions() {
  return {
    innerHtml: "<div class='text-xs text-muted-foreground'>Upload an SVG to see size options.</div>",
  };
}

/**
 * Build size options UI based on mode.
 */
function buildSizeOptionsUI(sizeMode, svgInfo, currentData) {
  if (!svgInfo) {
    return buildEmptySizeOptions();
  }

  const { originalWidth, originalHeight } = svgInfo;
  const customWidth = getDataAttr(currentData, "custom-width", String(originalWidth));
  const customHeight = getDataAttr(currentData, "custom-height", String(originalHeight));
  const lockRatio = getDataAttr(currentData, "lock-ratio", "true") === "true";
  const scalePercent = getDataAttr(currentData, "scale-percent", "100");

  let innerHtml = "";
  let afterHook = undefined;

  switch (sizeMode) {
    case "original":
      innerHtml = `
        <div class="p-3 rounded-md bg-muted/50 border border-border">
          <div class="text-sm text-muted-foreground">
            Output size: <span class="font-medium text-foreground">${originalWidth} x ${originalHeight} px</span>
          </div>
        </div>
      `;
      break;

    case "custom":
      innerHtml = `
        <div id="size-options-root" class="space-y-3"
             data-custom-width="${customWidth}"
             data-custom-height="${customHeight}"
             data-lock-ratio="${lockRatio}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-16">Width</label>
            <input type="number" id="custom-width" value="${customWidth}" min="1" max="10000"
                   class="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm" />
            <span class="text-xs text-muted-foreground">px</span>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-16">Height</label>
            <input type="number" id="custom-height" value="${customHeight}" min="1" max="10000"
                   class="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm" ${lockRatio ? "disabled" : ""} />
            <span class="text-xs text-muted-foreground">px</span>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="lock-ratio" class="w-4 h-4 rounded border-muted accent-primary" ${lockRatio ? "checked" : ""} />
            <label for="lock-ratio" class="text-xs text-muted-foreground">Lock aspect ratio</label>
          </div>
          <div id="preview-size" class="text-xs text-muted-foreground">
            Preview: ${customWidth} x ${lockRatio ? Math.round(customWidth * originalHeight / originalWidth) : customHeight} px
          </div>
        </div>
      `;
      afterHook = buildCustomSizeAfterHook(originalWidth, originalHeight);
      break;

    case "scale":
      const scaledWidth = Math.round(originalWidth * parseInt(scalePercent, 10) / 100);
      const scaledHeight = Math.round(originalHeight * parseInt(scalePercent, 10) / 100);
      innerHtml = `
        <div id="size-options-root" class="space-y-3" data-scale-percent="${scalePercent}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-16">Scale</label>
            <input type="range" id="scale-slider" min="10" max="500" value="${scalePercent}" step="10"
                   class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
            <span class="text-sm font-medium w-16 text-right" id="scale-value">${scalePercent}%</span>
          </div>
          <div id="preview-size" class="text-xs text-muted-foreground">
            Output: ${scaledWidth} x ${scaledHeight} px
          </div>
        </div>
      `;
      afterHook = buildScaleSizeAfterHook(originalWidth, originalHeight);
      break;
  }

  return { innerHtml, afterHook };
}

/**
 * Build afterHook for custom size controls.
 */
function buildCustomSizeAfterHook(originalWidth, originalHeight) {
  const aspectRatio = originalHeight / originalWidth;

  return function afterHook(container) {
    const root = container.querySelector("#size-options-root");
    const widthInput = container.querySelector("#custom-width");
    const heightInput = container.querySelector("#custom-height");
    const lockCheck = container.querySelector("#lock-ratio");
    const previewEl = container.querySelector("#preview-size");

    if (!root || !widthInput || !heightInput || !lockCheck || !previewEl) return;

    const updatePreview = () => {
      const w = parseInt(widthInput.value, 10) || originalWidth;
      const h = lockCheck.checked ? Math.round(w * aspectRatio) : (parseInt(heightInput.value, 10) || originalHeight);
      previewEl.textContent = `Preview: ${w} x ${h} px`;
      root.dataset.customWidth = String(w);
      root.dataset.customHeight = String(h);
    };

    widthInput.addEventListener("input", () => {
      if (lockCheck.checked) {
        const w = parseInt(widthInput.value, 10) || originalWidth;
        heightInput.value = String(Math.round(w * aspectRatio));
      }
      updatePreview();
    });

    heightInput.addEventListener("input", updatePreview);

    lockCheck.addEventListener("change", () => {
      root.dataset.lockRatio = String(lockCheck.checked);
      heightInput.disabled = lockCheck.checked;
      if (lockCheck.checked) {
        const w = parseInt(widthInput.value, 10) || originalWidth;
        heightInput.value = String(Math.round(w * aspectRatio));
      }
      updatePreview();
    });
  };
}

/**
 * Build afterHook for scale size controls.
 */
function buildScaleSizeAfterHook(originalWidth, originalHeight) {
  return function afterHook(container) {
    const root = container.querySelector("#size-options-root");
    const slider = container.querySelector("#scale-slider");
    const valueEl = container.querySelector("#scale-value");
    const previewEl = container.querySelector("#preview-size");

    if (!root || !slider || !valueEl || !previewEl) return;

    slider.addEventListener("input", () => {
      const percent = parseInt(slider.value, 10);
      valueEl.textContent = `${percent}%`;
      root.dataset.scalePercent = String(percent);

      const w = Math.round(originalWidth * percent / 100);
      const h = Math.round(originalHeight * percent / 100);
      previewEl.textContent = `Output: ${w} x ${h} px`;
    });
  };
}

/**
 * Build empty download UI.
 */
function buildEmptyDownloadUI() {
  return {
    innerHtml: "<div class='text-xs text-muted-foreground py-2'>Converted image will appear here for download.</div>",
  };
}

/**
 * Build progress UI during conversion.
 */
function buildProgressUI() {
  return {
    innerHtml: `
      <div class="flex items-center gap-2 py-2">
        <svg class="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm text-muted-foreground">Converting...</span>
      </div>
    `,
  };
}

/**
 * Build download UI with conversion result.
 */
function buildDownloadUI(result, showPreview) {
  if (!result) {
    return buildEmptyDownloadUI();
  }

  if (result.error) {
    return {
      innerHtml: `
        <div class="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <svg class="w-4 h-4 text-destructive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm text-destructive">Conversion failed: ${escapeHtml(result.error)}</span>
        </div>
      `,
    };
  }

  const sizeKb = result.sizeBytes ? (result.sizeBytes / 1024).toFixed(1) : 0;

  let previewHtml = "";
  if (showPreview && result.dataUrl) {
    previewHtml = `
      <div class="mt-3 pt-3 border-t border-border">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Preview</div>
        <a href="${result.dataUrl}" download="${escapeHtml(result.name)}" class="block max-w-full">
          <img src="${result.dataUrl}" alt="${escapeHtml(result.name)}"
               class="max-w-full max-h-64 rounded-md border border-border bg-muted/30 object-contain" />
        </a>
      </div>
    `;
  }

  return {
    innerHtml: `
      <div class="space-y-2">
        <div class="text-sm font-medium text-foreground">Conversion complete</div>
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <span>${result.width} x ${result.height} px</span>
          <span class="w-1 h-1 rounded-full bg-muted-foreground"></span>
          <span>${sizeKb} KB</span>
        </div>
        <a href="${result.dataUrl}" download="${escapeHtml(result.name)}"
           class="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Download ${escapeHtml(result.name)}
        </a>
        ${previewHtml}
      </div>
    `,
  };
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
