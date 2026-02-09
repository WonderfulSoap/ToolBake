/**
 * Image Batch Processor Handler
 * Processes multiple images with crop, flip, rotate, resize, and format conversion using ImageMagick WASM.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @param {HandlerCallback} callback
 * @returns {Promise<HandlerReturnWidgets>}
 */

// Global state for batch results persistence
let lastBatchResults = [];
let originalImageSize = null;
let cachedPreviewFile = null;
let cachedPreviewDataUrl = null;
let magickModule = null;

async function handler(inputWidgets, changedWidgetIds, callback) {
  const files = inputWidgets.imageFiles;
  const targetFormat = inputWidgets.targetFormat || "keep";
  const enableCrop = inputWidgets.enableCrop || false;
  const flipHorizontal = inputWidgets.flipHorizontal || false;
  const flipVertical = inputWidgets.flipVertical || false;
  const rotateDegrees = inputWidgets.rotateDegrees || 0;
  const resizeMode = inputWidgets.resizeMode || "none";
  const keepAspect = inputWidgets.keepAspect !== false;
  const resizeWidth = inputWidgets.resizeWidth || "";
  const resizeHeight = inputWidgets.resizeHeight || "";
  const showResultPreviews = inputWidgets.showResultPreviews || false;

  // Read crop data from preview label
  const previewData = inputWidgets.previewOutput?.data || {};
  const cropX = parseFloat(previewData.cropX) || 0;
  const cropY = parseFloat(previewData.cropY) || 0;
  const cropW = parseFloat(previewData.cropW) || 0;
  const cropH = parseFloat(previewData.cropH) || 0;

  // Read format params from formatParams label
  const formatData = inputWidgets.formatParams?.data || {};

  const result = {};

  // Handle initial load or no files
  if (!files || files.length === 0) {
    originalImageSize = null;
    cachedPreviewFile = null;
    cachedPreviewDataUrl = null;
    result.previewOutput = buildEmptyPreview();
    result.formatParams = buildFormatParams(targetFormat, formatData);
    result.resultGallery = buildEmptyGallery();
    return result;
  }

  const firstFile = files[0];
  const fileCount = files.length;

  // Check if we need to reload image dimensions
  const isNewFile = cachedPreviewFile !== firstFile;

  // Load first image dimensions if needed
  if (!originalImageSize || isNewFile) {
    cachedPreviewFile = firstFile;
    cachedPreviewDataUrl = null;
    originalImageSize = await getImageDimensions(firstFile);
    console.log("Loaded image dimensions:", originalImageSize);
  }

  // Handle file change - auto-select resize mode and set default values
  if (changedWidgetIds === "imageFiles") {
    if (fileCount === 1) {
      result.resizeMode = "size";
      result.resizeWidth = String(originalImageSize.width);
      result.resizeHeight = String(originalImageSize.height);
    } else {
      result.resizeMode = "percent";
      result.resizeWidth = "100";
      result.resizeHeight = "100";
    }
  }

  // Handle resize mode change - set default values
  if (changedWidgetIds === "resizeMode") {
    if (resizeMode === "size" && originalImageSize) {
      result.resizeWidth = String(originalImageSize.width);
      result.resizeHeight = String(originalImageSize.height);
    } else if (resizeMode === "percent") {
      result.resizeWidth = "100";
      result.resizeHeight = "100";
    }
  }

  // Handle aspect ratio linking
  if (keepAspect && originalImageSize && resizeMode === "size") {
    const aspectRatio = originalImageSize.width / originalImageSize.height;

    if (changedWidgetIds === "resizeWidth" && resizeWidth) {
      const newWidth = parseFloat(resizeWidth);
      if (!isNaN(newWidth) && newWidth > 0) {
        result.resizeHeight = String(Math.round(newWidth / aspectRatio));
      }
    } else if (changedWidgetIds === "resizeHeight" && resizeHeight) {
      const newHeight = parseFloat(resizeHeight);
      if (!isNaN(newHeight) && newHeight > 0) {
        result.resizeWidth = String(Math.round(newHeight * aspectRatio));
      }
    }
  }

  // Determine if preview needs regeneration with ImageMagick
  const needsTransform = flipHorizontal || flipVertical || rotateDegrees > 0;
  const transformTriggers = ["flipHorizontal", "flipVertical", "rotateDegrees", "imageFiles"];
  const shouldRegeneratePreview = isNewFile || transformTriggers.includes(changedWidgetIds);

  // Reset crop box when preview changes due to transforms
  let resetCrop = false;
  if (shouldRegeneratePreview && enableCrop && changedWidgetIds !== "enableCrop") {
    resetCrop = true;
  }

  // Generate preview using ImageMagick if transforms are applied
  if (shouldRegeneratePreview || !cachedPreviewDataUrl) {
    if (needsTransform) {
      // Initialize ImageMagick if not already done
      if (!magickModule) {
        magickModule = await requirePackage("@imagemagick/magick-wasm");
        await magickModule.initializeImageMagick();
        console.log("ImageMagick initialized for preview");
      }

      cachedPreviewDataUrl = await generateTransformedPreview(
        magickModule,
        firstFile,
        flipHorizontal,
        flipVertical,
        rotateDegrees
      );

      // Update image size after transforms (rotation may change dimensions)
      if (rotateDegrees === 90 || rotateDegrees === 270) {
        const tempSize = { width: originalImageSize.height, height: originalImageSize.width };
        result.previewOutput = buildPreviewLabel(
          cachedPreviewDataUrl,
          tempSize,
          enableCrop,
          resetCrop ? { x: 10, y: 10, w: 80, h: 80 } : { x: cropX, y: cropY, w: cropW, h: cropH }
        );
      } else {
        result.previewOutput = buildPreviewLabel(
          cachedPreviewDataUrl,
          originalImageSize,
          enableCrop,
          resetCrop ? { x: 10, y: 10, w: 80, h: 80 } : { x: cropX, y: cropY, w: cropW, h: cropH }
        );
      }
    } else {
      // No transforms, use original image
      cachedPreviewDataUrl = await fileToDataUrl(firstFile);
      result.previewOutput = buildPreviewLabel(
        cachedPreviewDataUrl,
        originalImageSize,
        enableCrop,
        resetCrop ? { x: 10, y: 10, w: 80, h: 80 } : { x: cropX, y: cropY, w: cropW, h: cropH }
      );
    }
  } else {
    // Use cached preview
    result.previewOutput = buildPreviewLabel(
      cachedPreviewDataUrl,
      originalImageSize,
      enableCrop,
      { x: cropX, y: cropY, w: cropW, h: cropH }
    );
  }

  // Update format params UI
  result.formatParams = buildFormatParams(targetFormat, formatData);

  // Handle batch processing button click
  if (changedWidgetIds === "runBatch") {
    console.log("Starting batch processing for", fileCount, "images");

    // Initialize ImageMagick if not already done
    if (!magickModule) {
      magickModule = await requirePackage("@imagemagick/magick-wasm");
      await magickModule.initializeImageMagick();
      console.log("ImageMagick initialized");
    }

    // Parse format params
    const formatOptions = parseFormatOptions(targetFormat, formatData);

    lastBatchResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Processing image ${i + 1}/${fileCount}: ${file.name}`);

      callback({
        resultGallery: buildProgressGallery(i + 1, fileCount, file.name),
      });

      try {
        const processedResult = await processImage(
          magickModule,
          file,
          {
            targetFormat,
            formatOptions,
            enableCrop,
            cropX,
            cropY,
            cropW,
            cropH,
            flipHorizontal,
            flipVertical,
            rotateDegrees,
            resizeMode,
            resizeWidth : parseFloat(resizeWidth) || 0,
            resizeHeight: parseFloat(resizeHeight) || 0,
          }
        );

        lastBatchResults.push(processedResult);
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
        lastBatchResults.push({
          name : file.name,
          error: err.message || "Processing failed",
        });
      }
    }

    console.log("Batch processing complete");
  }

  // Build result gallery
  result.resultGallery = buildResultGallery(lastBatchResults, showResultPreviews);

  return result;
}

/**
 * Get image dimensions from a File object
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Convert File to DataURL
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generate transformed preview using ImageMagick
 */
async function generateTransformedPreview(Magick, file, flipH, flipV, rotate) {
  const arrayBuffer = await file.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  let resultDataUrl = null;

  Magick.ImageMagick.read(inputBytes, (image) => {
    // Apply flip
    if (flipH) {
      image.flop();
    }
    if (flipV) {
      image.flip();
    }

    // Apply rotation
    if (rotate > 0) {
      image.rotate(rotate);
    }

    // Write to PNG for preview
    image.write(Magick.MagickFormat.Png, (data) => {
      const blob = new Blob([data], { type: "image/png" });
      const reader = new FileReader();
      reader.onload = () => {
        resultDataUrl = reader.result;
      };
      reader.readAsDataURL(blob);
    });
  });

  // Wait for FileReader to complete (synchronous workaround)
  // Since ImageMagick.read callback is synchronous, we need to ensure dataUrl is ready
  if (!resultDataUrl) {
    // Fallback: use synchronous approach
    let syncResult = null;
    Magick.ImageMagick.read(inputBytes, (image) => {
      if (flipH) image.flop();
      if (flipV) image.flip();
      if (rotate > 0) image.rotate(rotate);

      image.write(Magick.MagickFormat.Png, (data) => {
        const base64 = arrayBufferToBase64(data);
        syncResult = "data:image/png;base64," + base64;
      });
    });
    return syncResult;
  }

  return resultDataUrl;
}

/**
 * Convert ArrayBuffer/Uint8Array to Base64 string
 */
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Build empty preview placeholder
 */
function buildEmptyPreview() {
  return {
    innerHtml: "<div class=\"text-xs text-muted-foreground py-4 text-center\">Upload images to generate a live preview.</div>",
  };
}

/**
 * Build preview label with image and optional crop box
 */
function buildPreviewLabel(dataUrl, imageSize, enableCrop, cropState) {
  const cropOverlay = enableCrop
    ? `<div id="crop-box" class="absolute border-2 border-dashed border-primary bg-primary/10 cursor-move" style="left:${cropState.x || 10}%;top:${cropState.y || 10}%;width:${cropState.w || 80}%;height:${cropState.h || 80}%;">
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="nw" style="top:-6px;left:-6px;cursor:nwse-resize;"></div>
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="n" style="top:-6px;left:50%;transform:translateX(-50%);cursor:ns-resize;"></div>
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="ne" style="top:-6px;right:-6px;cursor:nesw-resize;"></div>
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="e" style="top:50%;right:-6px;transform:translateY(-50%);cursor:ew-resize;"></div>
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="se" style="bottom:-6px;right:-6px;cursor:nwse-resize;"></div>
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="s" style="bottom:-6px;left:50%;transform:translateX(-50%);cursor:ns-resize;"></div>
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="sw" style="bottom:-6px;left:-6px;cursor:nesw-resize;"></div>
        <div class="crop-handle absolute w-3 h-3 bg-primary border border-background rounded-sm" data-handle="w" style="top:50%;left:-6px;transform:translateY(-50%);cursor:ew-resize;"></div>
      </div>`
    : "";

  const innerHtml = `
    <div class="relative inline-block max-w-full" id="preview-container" data-crop-x="${cropState.x || 10}" data-crop-y="${cropState.y || 10}" data-crop-w="${cropState.w || 80}" data-crop-h="${cropState.h || 80}" data-img-w="${imageSize.width}" data-img-h="${imageSize.height}">
      <img src="${dataUrl}" alt="Preview" class="max-w-full max-h-[400px] rounded" />
      ${cropOverlay}
    </div>
    <div class="text-xs text-muted-foreground mt-2">Preview: ${imageSize.width} x ${imageSize.height}px${enableCrop ? " | Drag crop box corners/edges to adjust" : ""}</div>
  `;

  const script = enableCrop
    ? `
    const box = container.querySelector("#crop-box");
    const previewContainer = container.querySelector("#preview-container");
    if (!box || !previewContainer) return;

    // Restore state from data attributes
    const storedX = parseFloat(previewContainer.dataset.cropX) || 10;
    const storedY = parseFloat(previewContainer.dataset.cropY) || 10;
    const storedW = parseFloat(previewContainer.dataset.cropW) || 80;
    const storedH = parseFloat(previewContainer.dataset.cropH) || 80;

    box.style.left = storedX + "%";
    box.style.top = storedY + "%";
    box.style.width = storedW + "%";
    box.style.height = storedH + "%";

    let isDragging = false;
    let isResizing = false;
    let activeHandle = null;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    function getContainerRect() {
      return previewContainer.getBoundingClientRect();
    }

    function updateDataAttrs() {
      const rect = getContainerRect();
      const boxRect = box.getBoundingClientRect();
      const x = ((boxRect.left - rect.left) / rect.width) * 100;
      const y = ((boxRect.top - rect.top) / rect.height) * 100;
      const w = (boxRect.width / rect.width) * 100;
      const h = (boxRect.height / rect.height) * 100;

      previewContainer.dataset.cropX = Math.max(0, Math.min(100 - w, x)).toFixed(2);
      previewContainer.dataset.cropY = Math.max(0, Math.min(100 - h, y)).toFixed(2);
      previewContainer.dataset.cropW = Math.max(5, Math.min(100, w)).toFixed(2);
      previewContainer.dataset.cropH = Math.max(5, Math.min(100, h)).toFixed(2);
    }

    function clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }

    function onMouseDown(e) {
      e.preventDefault();
      const handle = e.target.dataset?.handle;

      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(box.style.left);
      startTop = parseFloat(box.style.top);
      startWidth = parseFloat(box.style.width);
      startHeight = parseFloat(box.style.height);

      if (handle) {
        isResizing = true;
        activeHandle = handle;
      } else if (e.target === box) {
        isDragging = true;
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
      const rect = getContainerRect();
      const dx = ((e.clientX - startX) / rect.width) * 100;
      const dy = ((e.clientY - startY) / rect.height) * 100;

      if (isDragging) {
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;
        newLeft = clamp(newLeft, 0, 100 - startWidth);
        newTop = clamp(newTop, 0, 100 - startHeight);
        box.style.left = newLeft + "%";
        box.style.top = newTop + "%";
      } else if (isResizing && activeHandle) {
        let newLeft = startLeft;
        let newTop = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (activeHandle.includes("w")) {
          newLeft = clamp(startLeft + dx, 0, startLeft + startWidth - 5);
          newWidth = startWidth - (newLeft - startLeft);
        }
        if (activeHandle.includes("e")) {
          newWidth = clamp(startWidth + dx, 5, 100 - startLeft);
        }
        if (activeHandle.includes("n")) {
          newTop = clamp(startTop + dy, 0, startTop + startHeight - 5);
          newHeight = startHeight - (newTop - startTop);
        }
        if (activeHandle.includes("s")) {
          newHeight = clamp(startHeight + dy, 5, 100 - startTop);
        }

        box.style.left = newLeft + "%";
        box.style.top = newTop + "%";
        box.style.width = newWidth + "%";
        box.style.height = newHeight + "%";
      }

      updateDataAttrs();
    }

    function onMouseUp() {
      isDragging = false;
      isResizing = false;
      activeHandle = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    box.addEventListener("mousedown", onMouseDown);

    return () => {
      box.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  `
    : "";

  return { innerHtml, script };
}

/**
 * Build format parameters UI based on selected format
 */
function buildFormatParams(format, currentData) {
  const quality = currentData.quality || "85";
  const compression = currentData.compression || "6";
  const lossless = currentData.lossless === "true";
  const tiffCompression = currentData.tiffCompression || "none";

  let innerHtml = "";
  let script = "";

  switch (format) {
    case "jpg":
      innerHtml = `
        <div class="space-y-2" data-quality="${quality}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-20">Quality</label>
            <input type="range" min="1" max="100" value="${quality}" class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" id="quality-slider" />
            <span class="text-sm font-medium w-8 text-right" id="quality-value">${quality}</span>
          </div>
          <div class="text-xs text-muted-foreground">Higher quality = larger file size. 85 is recommended for most uses.</div>
        </div>
      `;
      script = `
        const slider = container.querySelector("#quality-slider");
        const valueEl = container.querySelector("#quality-value");
        if (!slider || !valueEl) return;

        slider.addEventListener("input", (e) => {
          const val = e.target.value;
          valueEl.textContent = val;
          container.dataset.quality = val;
        });
      `;
      break;

    case "png":
      innerHtml = `
        <div class="space-y-2" data-compression="${compression}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Compression</label>
            <input type="range" min="0" max="9" value="${compression}" class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" id="compression-slider" />
            <span class="text-sm font-medium w-8 text-right" id="compression-value">${compression}</span>
          </div>
          <div class="text-xs text-muted-foreground">0 = no compression (fastest), 9 = max compression (smallest file). PNG is always lossless.</div>
        </div>
      `;
      script = `
        const slider = container.querySelector("#compression-slider");
        const valueEl = container.querySelector("#compression-value");
        if (!slider || !valueEl) return;

        slider.addEventListener("input", (e) => {
          const val = e.target.value;
          valueEl.textContent = val;
          container.dataset.compression = val;
        });
      `;
      break;

    case "webp":
      innerHtml = `
        <div class="space-y-3" data-quality="${quality}" data-lossless="${lossless}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-20">Quality</label>
            <input type="range" min="1" max="100" value="${quality}" class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" id="quality-slider" ${lossless ? "disabled" : ""} />
            <span class="text-sm font-medium w-8 text-right" id="quality-value">${quality}</span>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-20">Lossless</label>
            <input type="checkbox" id="lossless-check" class="w-4 h-4 rounded border-muted" ${lossless ? "checked" : ""} />
            <span class="text-xs text-muted-foreground">Enable lossless compression (ignores quality setting)</span>
          </div>
        </div>
      `;
      script = `
        const slider = container.querySelector("#quality-slider");
        const valueEl = container.querySelector("#quality-value");
        const checkbox = container.querySelector("#lossless-check");
        if (!slider || !valueEl || !checkbox) return;

        slider.addEventListener("input", (e) => {
          const val = e.target.value;
          valueEl.textContent = val;
          container.dataset.quality = val;
        });

        checkbox.addEventListener("change", (e) => {
          const isLossless = e.target.checked;
          container.dataset.lossless = String(isLossless);
          slider.disabled = isLossless;
        });
      `;
      break;

    case "tiff":
      innerHtml = `
        <div class="space-y-2" data-tiff-compression="${tiffCompression}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Compression</label>
            <select id="tiff-compression" class="flex-1 h-8 px-2 rounded border border-input bg-background text-sm">
              <option value="none" ${tiffCompression === "none" ? "selected" : ""}>None</option>
              <option value="lzw" ${tiffCompression === "lzw" ? "selected" : ""}>LZW</option>
              <option value="zip" ${tiffCompression === "zip" ? "selected" : ""}>ZIP/Deflate</option>
            </select>
          </div>
          <div class="text-xs text-muted-foreground">LZW and ZIP are lossless compression methods.</div>
        </div>
      `;
      script = `
        const select = container.querySelector("#tiff-compression");
        if (!select) return;

        select.addEventListener("change", (e) => {
          container.dataset.tiffCompression = e.target.value;
        });
      `;
      break;

    case "gif":
      innerHtml = "<div class=\"text-xs text-muted-foreground\">GIF format uses lossless compression with 256-color palette. No additional parameters available.</div>";
      break;

    case "bmp":
      innerHtml = "<div class=\"text-xs text-muted-foreground\">BMP format is uncompressed. No additional parameters available.</div>";
      break;

    case "keep":
    default:
      innerHtml = "<div class=\"text-xs text-muted-foreground\">Images will keep their original format. No conversion parameters needed.</div>";
      break;
  }

  return { innerHtml, script };
}

/**
 * Parse format options from data attributes
 */
function parseFormatOptions(format, data) {
  const options = {};

  switch (format) {
    case "jpg":
      options.quality = parseInt(data.quality, 10) || 85;
      break;
    case "png":
      options.compression = parseInt(data.compression, 10) || 6;
      break;
    case "webp":
      options.quality = parseInt(data.quality, 10) || 80;
      options.lossless = data.lossless === "true";
      break;
    case "tiff":
      options.compression = data.tiffCompression || "none";
      break;
  }

  return options;
}

/**
 * Build empty gallery placeholder
 */
function buildEmptyGallery() {
  return {
    innerHtml: "<div class=\"text-xs text-muted-foreground py-2\">Run batch processing to generate outputs and downloads.</div>",
  };
}

/**
 * Build progress gallery during processing
 */
function buildProgressGallery(current, total, filename) {
  const percent = Math.round((current / total) * 100);
  return {
    innerHtml: `
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Processing...</span>
          <span class="font-medium">${current}/${total}</span>
        </div>
        <div class="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div class="h-full bg-primary transition-all" style="width:${percent}%"></div>
        </div>
        <div class="text-xs text-muted-foreground truncate">Current: ${filename}</div>
      </div>
    `,
  };
}

/**
 * Build result gallery with download links
 */
function buildResultGallery(results, showPreviews) {
  if (!results || results.length === 0) {
    return buildEmptyGallery();
  }

  const successCount = results.filter((r) => !r.error).length;
  const errorCount = results.filter((r) => r.error).length;

  let statusHtml = "<div class=\"text-sm font-medium text-foreground\">Processed " + successCount + " image" + (successCount !== 1 ? "s" : "");
  if (errorCount > 0) {
    statusHtml += " <span class=\"text-destructive\">(" + errorCount + " failed)</span>";
  }
  statusHtml += "</div>";

  // Build download buttons
  let downloadsHtml = "<div class=\"flex flex-wrap gap-2 mt-3\">";

  results.forEach((r) => {
    if (r.error) {
      downloadsHtml += "<span class=\"inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-destructive/10 text-destructive\">" + r.name + ": " + r.error + "</span>";
    } else {
      downloadsHtml += "<a href=\"" + r.dataUrl + "\" download=\"" + r.name + "\" class=\"inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors\">" + r.name + "</a>";
    }
  });

  downloadsHtml += "</div>";

  // Download all button
  const downloadAllBtn =
    successCount > 1
      ? `<button id="download-all-btn" class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Download All (${successCount})</button>`
      : "";

  // Preview grid
  let previewGridHtml = "";
  if (showPreviews && successCount > 0) {
    previewGridHtml = "<div class=\"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-4\">";
    results.forEach((r) => {
      if (!r.error && r.dataUrl) {
        previewGridHtml += "<a href=\"" + r.dataUrl + "\" download=\"" + r.name + "\" class=\"group relative aspect-square rounded overflow-hidden bg-muted\">" +
          "<img src=\"" + r.dataUrl + "\" alt=\"" + r.name + "\" class=\"w-full h-full object-cover\" />" +
          "<div class=\"absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center\">" +
          "<span class=\"text-xs text-white font-medium\">Download</span>" +
          "</div></a>";
      }
    });
    previewGridHtml += "</div>";
  }

  const innerHtml = `
    <div class="space-y-2">
      ${statusHtml}
      ${downloadsHtml}
      ${downloadAllBtn}
      ${previewGridHtml}
    </div>
  `;

  // Script for download all functionality
  const script =
    successCount > 1
      ? `
    const btn = container.querySelector("#download-all-btn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Downloading...";

      const links = container.querySelectorAll("a[download]");
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        link.click();
        // Small delay between downloads to prevent browser blocking
        await new Promise(r => setTimeout(r, 300));
      }

      btn.disabled = false;
      btn.textContent = "Download All (${successCount})";
    });
  `
      : "";

  return { innerHtml, script };
}

/**
 * Process a single image with ImageMagick
 */
async function processImage(Magick, file, options) {
  const {
    targetFormat,
    formatOptions,
    enableCrop,
    cropX,
    cropY,
    cropW,
    cropH,
    flipHorizontal,
    flipVertical,
    rotateDegrees,
    resizeMode,
    resizeWidth,
    resizeHeight,
  } = options;

  // Read file as Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  // Determine output format
  let outputFormat = targetFormat === "keep" ? getFileExtension(file.name) : targetFormat;
  const magickFormat = getMagickFormat(outputFormat);

  let resultBlob = null;
  let outputName = file.name;

  // Process with ImageMagick
  Magick.ImageMagick.read(inputBytes, (image) => {
    console.log(`Processing: ${file.name}, original size: ${image.width}x${image.height}`);

    // Apply flip first (before crop)
    if (flipHorizontal) {
      console.log("Flipping horizontally");
      image.flop();
    }

    if (flipVertical) {
      console.log("Flipping vertically");
      image.flip();
    }

    // Apply rotation (before crop)
    if (rotateDegrees > 0) {
      console.log(`Rotating: ${rotateDegrees} degrees`);
      image.rotate(rotateDegrees);
    }

    // Apply crop after transforms (convert percentage to pixels based on transformed image size)
    if (enableCrop && cropW > 0 && cropH > 0) {
      const imgW = image.width;
      const imgH = image.height;
      const cx = Math.round((cropX / 100) * imgW);
      const cy = Math.round((cropY / 100) * imgH);
      const cw = Math.round((cropW / 100) * imgW);
      const ch = Math.round((cropH / 100) * imgH);

      console.log(`Cropping: x=${cx}, y=${cy}, w=${cw}, h=${ch}`);
      image.crop(cw, ch, cx, cy);
    }

    // Apply resize
    if (resizeMode === "size" && resizeWidth > 0 && resizeHeight > 0) {
      console.log(`Resizing to: ${resizeWidth}x${resizeHeight}`);
      image.resize(resizeWidth, resizeHeight);
    } else if (resizeMode === "percent" && (resizeWidth !== 100 || resizeHeight !== 100)) {
      const newW = Math.round(image.width * (resizeWidth / 100));
      const newH = Math.round(image.height * (resizeHeight / 100));
      console.log(`Scaling to: ${resizeWidth}%x${resizeHeight}% = ${newW}x${newH}`);
      image.resize(newW, newH);
    }

    // Apply format-specific settings
    if (magickFormat === Magick.MagickFormat.Jpeg && formatOptions.quality) {
      image.quality = formatOptions.quality;
    } else if (magickFormat === Magick.MagickFormat.WebP) {
      if (formatOptions.lossless) {
        image.settings.setDefine("webp:lossless", "true");
      } else if (formatOptions.quality) {
        image.quality = formatOptions.quality;
      }
    } else if (magickFormat === Magick.MagickFormat.Png && formatOptions.compression !== undefined) {
      image.settings.setDefine("png:compression-level", String(formatOptions.compression));
    } else if (magickFormat === Magick.MagickFormat.Tiff && formatOptions.compression) {
      if (formatOptions.compression === "lzw") {
        image.settings.setDefine("tiff:compress", "lzw");
      } else if (formatOptions.compression === "zip") {
        image.settings.setDefine("tiff:compress", "zip");
      }
    }

    // Write output using MagickFormat enum
    image.write(magickFormat, (data) => {
      const mimeType = getMimeType(outputFormat);
      resultBlob = new Blob([data], { type: mimeType });

      // Update output filename
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const ext = outputFormat === "jpeg" ? "jpg" : outputFormat;
      outputName = `${baseName}.${ext}`;
    });
  });

  // Convert blob to data URL for persistence
  const dataUrl = await blobToDataUrl(resultBlob);

  return {
    name   : outputName,
    blob   : resultBlob,
    dataUrl: dataUrl,
  };
}

/**
 * Convert Blob to DataURL
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to convert blob"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "png";
  return ext === "jpeg" ? "jpg" : ext;
}

/**
 * Get MagickFormat enum value for a format string
 */
function getMagickFormat(format) {
  // Note: This function returns a placeholder - actual format is passed to write()
  // The Magick.MagickFormat enum is used directly in processImage
  const formatMap = {
    jpeg: "Jpeg",
    jpg : "Jpeg",
    png : "Png",
    webp: "WebP",
    gif : "Gif",
    bmp : "Bmp",
    tiff: "Tiff",
  };
  return formatMap[format] || "Png";
}

/**
 * Get MIME type for format
 */
function getMimeType(format) {
  const mimeTypes = {
    jpeg: "image/jpeg",
    jpg : "image/jpeg",
    png : "image/png",
    webp: "image/webp",
    gif : "image/gif",
    bmp : "image/bmp",
    tiff: "image/tiff",
  };
  return mimeTypes[format] || "image/png";
}
