/**
 * Image Format Converter Handler
 * Batch converts images between various formats using ImageMagick WASM.
 * Dynamically renders format-specific options via LabelInput.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @param {HandlerCallback} callback
 * @returns {Promise<HandlerReturnWidgets>}
 */

// Global state for batch conversion results persistence
let lastConversionResults = [];
let magickModule = null;

async function handler(inputWidgets, changedWidgetIds, callback) {
  const files = inputWidgets.imageFiles;
  const targetFormat = inputWidgets.targetFormat || "png";
  const showPreview = inputWidgets.showPreview !== false;

  // Read format-specific params from the dynamic label
  const formatData = getFormatOptionsData(inputWidgets.formatOptions);

  const result = {};

  // Always update format options UI based on selected format
  result.formatOptions = buildFormatOptionsUI(targetFormat, formatData);

  // Handle no files state
  if (!files || files.length === 0) {
    result.downloadOutput = buildEmptyDownloadUI();
    return result;
  }

  // Detect SVG files and warn the user (inline check for sandbox compatibility)
  const checkSvg = (f) => f.type === "image/svg+xml" || /\.svg$/i.test(f.name || "");
  const svgFiles = files.filter(checkSvg);
  const nonSvgFiles = files.filter((f) => !checkSvg(f));

  if (svgFiles.length > 0 && nonSvgFiles.length === 0) {
    // All files are SVGs, show warning and skip conversion
    result.downloadOutput = buildSvgWarningUI(svgFiles.length);
    return result;
  }

  // Handle convert button click
  if (changedWidgetIds === "convertBtn") {
    console.log("Starting batch conversion for", files.length, "images to", targetFormat);

    // Initialize ImageMagick if not already done
    if (!magickModule) {
      magickModule = await requirePackage("@imagemagick/magick-wasm");
      await magickModule.initializeImageMagick();
      console.log("ImageMagick initialized");
    }

    // Parse format-specific options
    const formatOptions = parseFormatOptions(targetFormat, formatData);

    lastConversionResults = [];
    // Skip SVG files during conversion
    const convertibleFiles = nonSvgFiles;
    const totalFiles = convertibleFiles.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = convertibleFiles[i];
      console.log(`Converting image ${i + 1}/${totalFiles}: ${file.name}`);

      // Show progress via callback
      callback({
        downloadOutput: buildProgressUI(i + 1, totalFiles, file.name),
      });

      try {
        const convertedResult = await convertImage(magickModule, file, targetFormat, formatOptions);
        lastConversionResults.push(convertedResult);
      } catch (err) {
        console.error(`Failed to convert ${file.name}:`, err);
        lastConversionResults.push({
          name : file.name,
          error: err.message || "Conversion failed",
        });
      }
    }

    console.log("Batch conversion complete");
  }

  // Build download UI with results, append SVG warning if some SVGs were skipped
  result.downloadOutput = buildDownloadUI(lastConversionResults, showPreview, svgFiles.length);

  return result;
}

/**
 * Build format-specific options UI based on selected format.
 * Uses LabelInput dynamic capabilities with afterHook to capture interactions.
 */
function buildFormatOptionsUI(format, currentData) {
  const quality = getDataAttr(currentData, "quality", "85");
  const compression = getDataAttr(currentData, "compression", "6");
  const lossless = getDataAttr(currentData, "lossless", "false") === "true";
  const tiffCompression = getDataAttr(currentData, "tiff-compression", "lzw");
  const icoSize = getDataAttr(currentData, "ico-size", "48");
  const pnmFormat = getDataAttr(currentData, "pnm-format", "ppm");
  const gifDither = getDataAttr(currentData, "gif-dither", "false") === "true";
  const gifColors = getDataAttr(currentData, "gif-colors", "256");

  let innerHtml = "";
  const afterHook = buildFormatOptionsAfterHook(format);

  switch (format) {
    case "jpg":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-quality="${quality}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Quality</label>
            <input type="range" min="1" max="100" value="${quality}" class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" id="quality-slider" />
            <span class="text-sm font-medium w-10 text-right" id="quality-value">${quality}%</span>
          </div>
          <div class="text-xs text-muted-foreground">Higher quality = larger file size. 85% is recommended for most uses.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">JPEG Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Lossy compression, best for photographs</li>
              <li>Does not support transparency</li>
              <li>Widely compatible with all devices</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "png":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-compression="${compression}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Compression</label>
            <input type="range" min="0" max="9" value="${compression}" class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" id="compression-slider" />
            <span class="text-sm font-medium w-10 text-right" id="compression-value">${compression}</span>
          </div>
          <div class="text-xs text-muted-foreground">0 = fastest (no compression), 9 = smallest file (slowest). PNG is always lossless.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PNG Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Lossless compression, no quality loss</li>
              <li>Supports full alpha transparency</li>
              <li>Best for graphics, icons, screenshots</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "webp":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-quality="${quality}" data-lossless="${lossless}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Quality</label>
            <input type="range" min="1" max="100" value="${quality}" class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" id="quality-slider" ${lossless ? "disabled" : ""} />
            <span class="text-sm font-medium w-10 text-right" id="quality-value">${quality}%</span>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Lossless</label>
            <input type="checkbox" id="lossless-check" class="w-4 h-4 rounded border-muted accent-primary" ${lossless ? "checked" : ""} />
            <span class="text-xs text-muted-foreground">Enable lossless compression (ignores quality)</span>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WebP Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Modern format with excellent compression</li>
              <li>Supports both lossy and lossless modes</li>
              <li>Supports alpha transparency</li>
              <li>~25-35% smaller than JPEG at same quality</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "gif":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-gif-colors="${gifColors}" data-gif-dither="${gifDither}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Colors</label>
            <select id="gif-colors" class="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="256" ${gifColors === "256" ? "selected" : ""}>256 (max quality)</option>
              <option value="128" ${gifColors === "128" ? "selected" : ""}>128</option>
              <option value="64" ${gifColors === "64" ? "selected" : ""}>64</option>
              <option value="32" ${gifColors === "32" ? "selected" : ""}>32</option>
              <option value="16" ${gifColors === "16" ? "selected" : ""}>16 (smallest)</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Dithering</label>
            <input type="checkbox" id="gif-dither" class="w-4 h-4 rounded border-muted accent-primary" ${gifDither ? "checked" : ""} />
            <span class="text-xs text-muted-foreground">Enable dithering for smoother gradients</span>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GIF Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Limited to 256 colors per frame</li>
              <li>Supports 1-bit transparency (no alpha)</li>
              <li>Supports animation (single frame here)</li>
              <li>Best for simple graphics and logos</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "bmp":
      innerHtml = `
        <div class="space-y-2">
          <div class="text-xs text-muted-foreground">BMP is an uncompressed format. No additional options available.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">BMP Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Uncompressed bitmap format</li>
              <li>Large file sizes</li>
              <li>Good for Windows applications</li>
              <li>Limited transparency support</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "tiff":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-tiff-compression="${tiffCompression}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Compression</label>
            <select id="tiff-compression" class="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="none" ${tiffCompression === "none" ? "selected" : ""}>None (uncompressed)</option>
              <option value="lzw" ${tiffCompression === "lzw" ? "selected" : ""}>LZW (lossless)</option>
              <option value="zip" ${tiffCompression === "zip" ? "selected" : ""}>ZIP/Deflate (lossless)</option>
              <option value="jpeg" ${tiffCompression === "jpeg" ? "selected" : ""}>JPEG (lossy)</option>
            </select>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TIFF Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Professional/archival format</li>
              <li>Supports multiple compression methods</li>
              <li>Supports layers, CMYK, 16-bit color</li>
              <li>Best for print and professional workflows</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "avif":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-quality="${quality}" data-lossless="${lossless}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Quality</label>
            <input type="range" min="1" max="100" value="${quality}" class="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer" id="quality-slider" ${lossless ? "disabled" : ""} />
            <span class="text-sm font-medium w-10 text-right" id="quality-value">${quality}%</span>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Lossless</label>
            <input type="checkbox" id="lossless-check" class="w-4 h-4 rounded border-muted accent-primary" ${lossless ? "checked" : ""} />
            <span class="text-xs text-muted-foreground">Enable lossless compression</span>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AVIF Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Next-gen format based on AV1 codec</li>
              <li>Excellent compression, better than WebP</li>
              <li>Supports HDR and wide color gamut</li>
              <li>Growing browser support</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "ico":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-ico-size="${icoSize}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Icon Size</label>
            <select id="ico-size" class="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="16" ${icoSize === "16" ? "selected" : ""}>16x16 (small)</option>
              <option value="32" ${icoSize === "32" ? "selected" : ""}>32x32 (standard)</option>
              <option value="48" ${icoSize === "48" ? "selected" : ""}>48x48 (medium)</option>
              <option value="64" ${icoSize === "64" ? "selected" : ""}>64x64</option>
              <option value="128" ${icoSize === "128" ? "selected" : ""}>128x128 (large)</option>
              <option value="256" ${icoSize === "256" ? "selected" : ""}>256x256 (high-res)</option>
            </select>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ICO Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Windows icon format</li>
              <li>Image will be resized to selected size</li>
              <li>Supports transparency</li>
              <li>Best for favicons and app icons</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "psd":
      innerHtml = `
        <div class="space-y-2">
          <div class="text-xs text-muted-foreground">Exports as flattened PSD. No additional options available.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PSD Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Adobe Photoshop native format</li>
              <li>Exported as flattened single layer</li>
              <li>Preserves color information</li>
              <li>Can be opened in Photoshop for editing</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "tga":
      innerHtml = `
        <div class="space-y-2">
          <div class="text-xs text-muted-foreground">TGA format with RLE compression. No additional options available.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TGA Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Truevision TGA (Targa) format</li>
              <li>Common in game development</li>
              <li>Supports alpha channel</li>
              <li>Simple RLE compression</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "pcx":
      innerHtml = `
        <div class="space-y-2">
          <div class="text-xs text-muted-foreground">PCX format. No additional options available.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PCX Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Legacy PC Paintbrush format</li>
              <li>RLE compression</li>
              <li>Mainly for legacy compatibility</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "pnm":
      innerHtml = `
        <div id="format-options-root" class="space-y-3" data-pnm-format="${pnmFormat}">
          <div class="flex items-center gap-3">
            <label class="text-sm text-muted-foreground w-24">Subformat</label>
            <select id="pnm-format" class="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="ppm" ${pnmFormat === "ppm" ? "selected" : ""}>PPM (color)</option>
              <option value="pgm" ${pnmFormat === "pgm" ? "selected" : ""}>PGM (grayscale)</option>
              <option value="pbm" ${pnmFormat === "pbm" ? "selected" : ""}>PBM (black & white)</option>
            </select>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PNM Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Portable Anymap format family</li>
              <li>PPM = full color, PGM = grayscale, PBM = bitmap</li>
              <li>Simple, uncompressed format</li>
              <li>Good for image processing pipelines</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "exr":
      innerHtml = `
        <div class="space-y-2">
          <div class="text-xs text-muted-foreground">OpenEXR high dynamic range format. No additional options available.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">EXR Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>High dynamic range (HDR) format</li>
              <li>Industry standard for VFX</li>
              <li>Supports 16/32-bit floating point</li>
              <li>Multiple compression options built-in</li>
            </ul>
          </div>
        </div>
      `;
      break;

    case "hdr":
      innerHtml = `
        <div class="space-y-2">
          <div class="text-xs text-muted-foreground">Radiance HDR format. No additional options available.</div>
          <div class="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">HDR Info</div>
            <ul class="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Radiance RGBE format</li>
              <li>High dynamic range imaging</li>
              <li>Common for environment maps</li>
              <li>Run-length encoded</li>
            </ul>
          </div>
        </div>
      `;
      break;

    default:
      innerHtml = "<div class='text-xs text-muted-foreground'>Select a format to see available options.</div>";
      break;
  }

  return { innerHtml, afterHook };
}

/**
 * Parse format options from data attributes collected from the label.
 */
function parseFormatOptions(format, data) {
  const options = {};

  switch (format) {
    case "jpg":
      options.quality = parseInt(getDataAttr(data, "quality", "85"), 10) || 85;
      break;
    case "png":
      options.compression = parseInt(getDataAttr(data, "compression", "6"), 10) || 6;
      break;
    case "webp":
      options.quality = parseInt(getDataAttr(data, "quality", "80"), 10) || 80;
      options.lossless = getDataAttr(data, "lossless", "false") === "true";
      break;
    case "gif":
      options.colors = parseInt(getDataAttr(data, "gif-colors", "256"), 10) || 256;
      options.dither = getDataAttr(data, "gif-dither", "false") === "true";
      break;
    case "tiff":
      options.compression = getDataAttr(data, "tiff-compression", "lzw");
      break;
    case "avif":
      options.quality = parseInt(getDataAttr(data, "quality", "80"), 10) || 80;
      options.lossless = getDataAttr(data, "lossless", "false") === "true";
      break;
    case "ico":
      options.size = parseInt(getDataAttr(data, "ico-size", "48"), 10) || 48;
      break;
    case "pnm":
      options.subformat = getDataAttr(data, "pnm-format", "ppm");
      break;
  }

  return options;
}

/**
 * Read LabelInput collected data for the format options root element.
 */
function getFormatOptionsData(labelValue) {
  const rawData = labelValue && labelValue.data ? labelValue.data : {};
  return rawData["format-options-root"] || {};
}

/**
 * Read a data-* attribute value from collected label data with fallback.
 */
function getDataAttr(data, key, fallback) {
  const value = data ? data[`data-${key}`] : undefined;
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

/**
 * Build afterHook for interactive format option controls.
 */
function buildFormatOptionsAfterHook(format) {
  switch (format) {
    case "jpg":
      return function afterHook(container) {
        const root = container.querySelector("#format-options-root");
        const slider = container.querySelector("#quality-slider");
        const valueEl = container.querySelector("#quality-value");
        if (!root || !slider || !valueEl) return;
        slider.addEventListener("input", (e) => {
          const val = e.target.value;
          valueEl.textContent = `${val}%`;
          root.dataset.quality = val;
        });
      };
    case "png":
      return function afterHook(container) {
        const root = container.querySelector("#format-options-root");
        const slider = container.querySelector("#compression-slider");
        const valueEl = container.querySelector("#compression-value");
        if (!root || !slider || !valueEl) return;
        slider.addEventListener("input", (e) => {
          const val = e.target.value;
          valueEl.textContent = val;
          root.dataset.compression = val;
        });
      };
    case "webp":
    case "avif":
      return function afterHook(container) {
        const root = container.querySelector("#format-options-root");
        const slider = container.querySelector("#quality-slider");
        const valueEl = container.querySelector("#quality-value");
        const checkbox = container.querySelector("#lossless-check");
        if (!root || !slider || !valueEl || !checkbox) return;
        slider.addEventListener("input", (e) => {
          const val = e.target.value;
          valueEl.textContent = `${val}%`;
          root.dataset.quality = val;
        });
        checkbox.addEventListener("change", (e) => {
          const isLossless = e.target.checked;
          root.dataset.lossless = String(isLossless);
          slider.disabled = isLossless;
          slider.classList.toggle("opacity-50", isLossless);
        });
      };
    case "gif":
      return function afterHook(container) {
        const root = container.querySelector("#format-options-root");
        const colorsSelect = container.querySelector("#gif-colors");
        const ditherCheck = container.querySelector("#gif-dither");
        if (!root) return;
        if (colorsSelect) {
          colorsSelect.addEventListener("change", (e) => {
            root.dataset.gifColors = e.target.value;
          });
        }
        if (ditherCheck) {
          ditherCheck.addEventListener("change", (e) => {
            root.dataset.gifDither = String(e.target.checked);
          });
        }
      };
    case "tiff":
      return function afterHook(container) {
        const root = container.querySelector("#format-options-root");
        const select = container.querySelector("#tiff-compression");
        if (!root || !select) return;
        select.addEventListener("change", (e) => {
          root.dataset.tiffCompression = e.target.value;
        });
      };
    case "ico":
      return function afterHook(container) {
        const root = container.querySelector("#format-options-root");
        const select = container.querySelector("#ico-size");
        if (!root || !select) return;
        select.addEventListener("change", (e) => {
          root.dataset.icoSize = e.target.value;
        });
      };
    case "pnm":
      return function afterHook(container) {
        const root = container.querySelector("#format-options-root");
        const select = container.querySelector("#pnm-format");
        if (!root || !select) return;
        select.addEventListener("change", (e) => {
          root.dataset.pnmFormat = e.target.value;
        });
      };
    default:
      return undefined;
  }
}

/**
 * Build empty download UI placeholder.
 */
function buildEmptyDownloadUI() {
  return {
    innerHtml: "<div class='text-xs text-muted-foreground py-2'>Upload images and click Convert to generate downloads.</div>",
  };
}

/**
 * Build progress UI during conversion.
 */
function buildProgressUI(current, total, filename) {
  const percent = Math.round((current / total) * 100);
  return {
    innerHtml: `
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Converting...</span>
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
 * Build download UI with conversion results and download links.
 * @param {Array} results - Conversion results
 * @param {boolean} showPreview - Whether to show preview thumbnails
 * @param {number} skippedSvgCount - Number of SVG files that were skipped
 */
function buildDownloadUI(results, showPreview, skippedSvgCount) {
  if (!results || results.length === 0) {
    return buildEmptyDownloadUI();
  }

  const successResults = results.filter((r) => !r.error);
  const errorResults = results.filter((r) => r.error);
  const successCount = successResults.length;
  const errorCount = errorResults.length;

  // Status summary
  let statusHtml = `<div class="text-sm font-medium text-foreground">Converted ${successCount} image${successCount !== 1 ? "s" : ""}`;
  if (errorCount > 0) {
    statusHtml += ` <span class="text-destructive">(${errorCount} failed)</span>`;
  }
  statusHtml += "</div>";

  // Download all header (only if more than 1 successful conversion)
  let downloadAllHeaderHtml = "";
  if (successCount > 1) {
    downloadAllHeaderHtml = `
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-muted-foreground">Generated files</span>
        <a
          class="text-sm font-semibold text-primary underline underline-offset-2 cursor-pointer hover:text-primary/80 transition-colors"
          href="#"
          onclick="(function(el){var root=el.closest('[data-download-container]');if(!root)return false;var links=root.querySelectorAll('a[data-download-file]');links.forEach(function(link,index){setTimeout(function(){link.click();},index*150);});return false;})(this)"
        >
          Download All
        </a>
      </div>
    `;
  }

  // Individual download links
  let downloadsHtml = "<div class='flex flex-wrap gap-2'>";

  successResults.forEach((r) => {
    const sizeKb = r.sizeBytes ? Math.round(r.sizeBytes / 1024) : 0;
    const sizeLabel = sizeKb > 0 ? ` (${sizeKb}KB)` : "";
    downloadsHtml += `<a href="${r.dataUrl}" download="${r.name}" data-download-file class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      ${escapeHtml(r.name)}${sizeLabel}
    </a>`;
  });

  // Error items
  errorResults.forEach((r) => {
    downloadsHtml += `<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-destructive/10 text-destructive">${escapeHtml(r.name)}: ${escapeHtml(r.error)}</span>`;
  });

  downloadsHtml += "</div>";

  // Preview grid (only if showPreview is enabled)
  let previewGridHtml = "";
  if (showPreview && successCount > 0) {
    previewGridHtml = `
      <div class="mt-4 pt-3 border-t border-border">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Preview</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
    `;
    successResults.forEach((r) => {
      if (r.dataUrl) {
        previewGridHtml += `
          <a href="${r.dataUrl}" download="${r.name}" class="group relative aspect-square rounded-md overflow-hidden bg-muted border border-border hover:border-primary/50 transition-colors">
            <img src="${r.dataUrl}" alt="${escapeHtml(r.name)}" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
              <svg class="w-6 h-6 text-white mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span class="text-xs text-white font-medium text-center truncate w-full">${escapeHtml(r.name)}</span>
            </div>
          </a>
        `;
      }
    });
    previewGridHtml += "</div></div>";
  }

  // SVG warning banner for skipped files in mixed uploads
  let svgWarningHtml = "";
  if (skippedSvgCount > 0) {
    svgWarningHtml = buildSvgWarningBanner(skippedSvgCount);
  }

  const innerHtml = `
    <div class="space-y-3" data-download-container="true">
      ${svgWarningHtml}
      ${statusHtml}
      ${downloadAllHeaderHtml}
      ${downloadsHtml}
      ${previewGridHtml}
    </div>
  `;

  return { innerHtml };
}

/**
 * Convert a single image using ImageMagick WASM.
 */
async function convertImage(Magick, file, targetFormat, options) {
  const arrayBuffer = await file.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  // Get the appropriate MagickFormat
  const magickFormat = getMagickFormat(Magick, targetFormat, options);

  let resultBlob = null;
  let outputName = "";

  Magick.ImageMagick.read(inputBytes, (image) => {
    console.log(`Converting: ${file.name} (${image.width}x${image.height}) to ${targetFormat}`);

    // Apply format-specific settings
    applyFormatSettings(image, targetFormat, options);

    // Handle ICO resize
    if (targetFormat === "ico" && options.size) {
      const size = options.size;
      image.resize(size, size);
      console.log(`Resized to ${size}x${size} for ICO`);
    }

    // Handle PNM subformat conversion
    if (targetFormat === "pnm") {
      if (options.subformat === "pgm") {
        image.grayscale();
      } else if (options.subformat === "pbm") {
        image.threshold(50);
      }
    }

    // Handle GIF color reduction
    if (targetFormat === "gif") {
      if (options.colors && options.colors < 256) {
        image.quantize(options.colors);
      }
      if (options.dither) {
        image.settings.setDefine("dither", "true");
      }
    }

    // Write output
    image.write(magickFormat, (data) => {
      const mimeType = getMimeType(targetFormat);
      resultBlob = new Blob([data], { type: mimeType });

      // Build output filename
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const ext = getFileExtension(targetFormat, options);
      outputName = `${baseName}.${ext}`;
    });
  });

  // Convert blob to data URL for download
  const dataUrl = await blobToDataUrl(resultBlob);

  return {
    name     : outputName,
    dataUrl  : dataUrl,
    sizeBytes: resultBlob.size,
  };
}

/**
 * Apply format-specific settings to the image before writing.
 */
function applyFormatSettings(image, format, options) {
  switch (format) {
    case "jpg":
      if (options.quality) {
        image.quality = options.quality;
      }
      break;

    case "png":
      if (options.compression !== undefined) {
        image.settings.setDefine("png:compression-level", String(options.compression));
      }
      break;

    case "webp":
      if (options.lossless) {
        image.settings.setDefine("webp:lossless", "true");
      } else if (options.quality) {
        image.quality = options.quality;
      }
      break;

    case "avif":
      if (options.lossless) {
        image.settings.setDefine("heic:lossless", "true");
      } else if (options.quality) {
        image.quality = options.quality;
      }
      break;

    case "tiff":
      if (options.compression) {
        const compressionMap = {
          none: "none",
          lzw : "lzw",
          zip : "zip",
          jpeg: "jpeg",
        };
        const comp = compressionMap[options.compression] || "lzw";
        image.settings.setDefine("tiff:compress", comp);
      }
      break;
  }
}

/**
 * Get MagickFormat enum value for the target format.
 */
function getMagickFormat(Magick, format, options) {
  const formatMap = {
    jpg : Magick.MagickFormat.Jpeg,
    png : Magick.MagickFormat.Png,
    webp: Magick.MagickFormat.WebP,
    gif : Magick.MagickFormat.Gif,
    bmp : Magick.MagickFormat.Bmp,
    tiff: Magick.MagickFormat.Tiff,
    avif: Magick.MagickFormat.Avif,
    ico : Magick.MagickFormat.Ico,
    psd : Magick.MagickFormat.Psd,
    tga : Magick.MagickFormat.Tga,
    pcx : Magick.MagickFormat.Pcx,
    pnm : getPnmFormat(Magick, options),
    exr : Magick.MagickFormat.Exr,
    hdr : Magick.MagickFormat.Hdr,
  };

  return formatMap[format] || Magick.MagickFormat.Png;
}

/**
 * Get PNM subformat based on options.
 */
function getPnmFormat(Magick, options) {
  const subformat = options?.subformat || "ppm";
  switch (subformat) {
    case "pgm":
      return Magick.MagickFormat.Pgm;
    case "pbm":
      return Magick.MagickFormat.Pbm;
    default:
      return Magick.MagickFormat.Ppm;
  }
}

/**
 * Get file extension for the target format.
 */
function getFileExtension(format, options) {
  if (format === "pnm") {
    return options?.subformat || "ppm";
  }
  const extMap = {
    jpg : "jpg",
    png : "png",
    webp: "webp",
    gif : "gif",
    bmp : "bmp",
    tiff: "tiff",
    avif: "avif",
    ico : "ico",
    psd : "psd",
    tga : "tga",
    pcx : "pcx",
    exr : "exr",
    hdr : "hdr",
  };
  return extMap[format] || "png";
}

/**
 * Get MIME type for the format.
 */
function getMimeType(format) {
  const mimeTypes = {
    jpg : "image/jpeg",
    png : "image/png",
    webp: "image/webp",
    gif : "image/gif",
    bmp : "image/bmp",
    tiff: "image/tiff",
    avif: "image/avif",
    ico : "image/x-icon",
    psd : "image/vnd.adobe.photoshop",
    tga : "image/x-tga",
    pcx : "image/x-pcx",
    pnm : "image/x-portable-anymap",
    exr : "image/x-exr",
    hdr : "image/vnd.radiance",
  };
  return mimeTypes[format] || "application/octet-stream";
}

/**
 * Convert Blob to DataURL.
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
 * Build a full-page SVG warning UI when all uploaded files are SVGs.
 */
function buildSvgWarningUI(count) {
  const plural = count > 1 ? "s" : "";
  return {
    innerHtml: `
      <div class="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-2">
        <div class="flex items-center gap-2 text-sm font-medium text-yellow-600">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          SVG format is not supported
        </div>
        <div class="text-sm text-muted-foreground">
          ${count} SVG file${plural} detected. ImageMagick WASM does not support SVG input.
          To convert SVG to other image formats, please use
          <a href="/t/official-svg-converter" class="font-medium text-primary underline underline-offset-2">SVG to Other Format Converter</a>.
        </div>
      </div>
    `,
  };
}

/**
 * Build an inline SVG warning banner for mixed uploads (some SVGs skipped).
 */
function buildSvgWarningBanner(count) {
  const plural = count > 1 ? "s" : "";
  return `
    <div class="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-muted-foreground">
      <span class="font-medium text-yellow-600">${count} SVG file${plural} skipped</span> —
      SVG format is not supported. Use
      <a href="/t/official-svg-converter" class="font-medium text-primary underline underline-offset-2">SVG to Other Format Converter</a>
      instead.
    </div>
  `;
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
