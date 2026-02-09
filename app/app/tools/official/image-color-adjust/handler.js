/**
 * Image Color Adjustment Tool Handler
 * 
 * This handler applies color adjustments and filters to uploaded images using ImageMagick WASM.
 * It provides live preview using the first uploaded image and batch processes all images on convert.
 * 
 * Supported adjustments:
 * - Brightness: Adjusts overall lightness (0-200%)
 * - Contrast: Adjusts difference between light and dark (0-200%)
 * - Saturation: Adjusts color intensity (0-200%)
 * - Hue: Rotates colors in the color wheel (0-200%)
 * - Gamma: Adjusts midtone brightness (0.1-3.0)
 * - Sharpen: Enhances edge definition (0-10)
 * - Blur: Softens the image (0-10px)
 * - Vignette: Adds dark corner effect (0-100%)
 * 
 * Filter presets:
 * - None: No filter applied
 * - Grayscale: Converts to black and white
 * - Sepia: Vintage brownish tone
 * - Negative: Inverts all colors (negative film)
 * - Normalize: Auto-adjusts contrast and brightness
 * - Auto Level: Automatically levels color channels
 * - Auto Gamma: Automatically adjusts gamma
 * - Charcoal: Sketch/drawing effect
 * - Oil Paint: Artistic painting effect
 * - Solarize: Inverts bright areas (solarization)
 * - Wave: Wave distortion effect
 * - Add Noise: Adds film grain effect
 * 
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  console.log("=== Image Color Adjust Handler Started ===");
  console.log("Changed widget:", changedWidgetIds);
  console.log("Input widgets:", {
    imagesCount        : inputWidgets["input-images"]?.length || 0,
    filterPreset       : inputWidgets["filter-preset"],
    brightness         : inputWidgets.brightness,
    contrast           : inputWidgets.contrast,
    saturation         : inputWidgets.saturation,
    hue                : inputWidgets.hue,
    gamma              : inputWidgets.gamma,
    sharpen            : inputWidgets.sharpen,
    blur               : inputWidgets.blur,
    vignette           : inputWidgets.vignette,
    previewImagesToggle: inputWidgets["preview-images-toggle"],
  });

  const inputFiles = inputWidgets["input-images"];
  const filterPreset = inputWidgets["filter-preset"] || "none";
  const brightness = inputWidgets.brightness ?? 100;
  const contrast = inputWidgets.contrast ?? 100;
  const saturation = inputWidgets.saturation ?? 100;
  const hue = inputWidgets.hue ?? 100;
  const gamma = inputWidgets.gamma ?? 1.0;
  const sharpen = inputWidgets.sharpen ?? 0;
  const blur = inputWidgets.blur ?? 0;
  const vignette = inputWidgets.vignette ?? 0;
  const showPreview = inputWidgets["preview-images-toggle"] ?? false;

  // If no images uploaded, show instruction
  if (!inputFiles || inputFiles.length === 0) {
    console.log("No images uploaded, showing instruction");
    return {
      "preview-label" : "<div class='text-sm text-muted-foreground leading-relaxed'>Upload one or more images to start. The first image will be used for live preview as you adjust the parameters.</div>",
      "output-command": "<div class='text-sm text-muted-foreground'>Commands will appear here after processing</div>",
      "output-results": "<div class='text-sm text-muted-foreground'>Processed images will appear here for download</div>",
    };
  }

  // Load ImageMagick
  console.log("Loading ImageMagick WASM...");
  const Magick = await requirePackage("@imagemagick/magick-wasm");
  await Magick.initializeImageMagick();
  console.log("ImageMagick loaded successfully");

  // Get first image for preview
  const firstImage = inputFiles[0];
  console.log("Processing first image for preview:", firstImage.name);

  // If convert button clicked, process all images
  if (changedWidgetIds === "convert-btn") {
    console.log("Convert button clicked, processing all", inputFiles.length, "images");
    return await processAllImages(Magick, inputFiles, filterPreset, brightness, contrast, saturation, hue, gamma, sharpen, blur, vignette, showPreview, callback);
  }

  // Otherwise, show live preview with first image
  console.log("Generating live preview for first image");
  const previewResult = await generatePreview(Magick, firstImage, inputFiles.length, filterPreset, brightness, contrast, saturation, hue, gamma, sharpen, blur, vignette);

  return {
    "preview-label" : previewResult.previewHtml,
    "output-command": previewResult.commandHtml,
  };
}

/**
 * Generate live preview for the first image with current adjustments
 */
async function generatePreview(Magick, imageFile, totalFilesCount, filterPreset, brightness, contrast, saturation, hue, gamma, sharpen, blur, vignette) {
  console.log("Generating preview with adjustments...");

  try {
    const imageData = new Uint8Array(await imageFile.arrayBuffer());
    let outputDataUrl = null;
    let commandSummary = "";

    // Build ImageMagick command parts
    const cmdParts = [`convert input.${getFileExtension(imageFile.name)}`];

    Magick.ImageMagick.read(imageData, (image) => {
      console.log("Image loaded:", image.width, "x", image.height);

      // Build command summary for display
      const adjustments = [];

      // Apply filter preset first
      if (filterPreset && filterPreset !== "none") {
        adjustments.push(`Filter: ${filterPreset}`);
        applyFilterPreset(Magick, image, filterPreset);
        cmdParts.push(getFilterCommand(filterPreset));
      }

      // Apply color adjustments
      if (brightness !== 100 || contrast !== 100) {
        if (brightness !== 100) {
          adjustments.push(`Brightness: ${brightness}%`);
        }
        if (contrast !== 100) {
          adjustments.push(`Contrast: ${contrast}%`);
        }
        const brightnessValue = new Magick.Percentage(brightness - 100);
        const contrastValue = new Magick.Percentage(contrast - 100);
        image.brightnessContrast(brightnessValue, contrastValue);
        cmdParts.push(`-brightness-contrast ${brightness - 100}x${contrast - 100}`);
      }

      if (saturation !== 100 || hue !== 100) {
        if (saturation !== 100) {
          adjustments.push(`Saturation: ${saturation}%`);
        }
        if (hue !== 100) {
          adjustments.push(`Hue: ${hue}%`);
        }
        image.modulate(new Magick.Percentage(100), new Magick.Percentage(saturation), new Magick.Percentage(hue));
        cmdParts.push(`-modulate 100,${saturation},${hue}`);
      }

      if (gamma !== 1.0) {
        adjustments.push(`Gamma: ${gamma}`);
        image.gammaCorrect(gamma);
        cmdParts.push(`-gamma ${gamma}`);
      }

      if (sharpen > 0) {
        adjustments.push(`Sharpen: ${sharpen}`);
        image.sharpen(0, sharpen);
        cmdParts.push(`-sharpen 0x${sharpen}`);
      }

      if (blur > 0) {
        adjustments.push(`Blur: ${blur}px`);
        image.blur(blur, 1);
        cmdParts.push(`-blur ${blur}x1`);
      }

      if (vignette > 0) {
        adjustments.push(`Vignette: ${vignette}%`);
        image.vignette();
        cmdParts.push("-vignette");
      }

      commandSummary = adjustments.length > 0 ? adjustments.join(", ") : "No adjustments";

      // Set output format to PNG for preview
      image.format = Magick.MagickFormat.Png;

      // Write to get image bytes
      image.write((data) => {
        const blob = new Blob([data], { type: "image/png" });
        outputDataUrl = URL.createObjectURL(blob);
      });
    });

    if (!outputDataUrl) {
      throw new Error("Failed to generate preview image");
    }

    console.log("Preview generated successfully");
    console.log("Applied adjustments:", commandSummary);

    // Build complete command
    cmdParts.push("output.png");
    const fullCommand = cmdParts.join(" ");

    // Build preview HTML
    const previewHtml = `
      <div class="space-y-3">
        <div class="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Live Preview - ${imageFile.name}
        </div>
        <div class="rounded-lg border border-border bg-muted/20 p-3">
          <img src="${outputDataUrl}" alt="Preview" class="max-w-full h-auto rounded" style="max-height: 500px; margin: 0 auto; display: block;" />
        </div>
        <div class="text-xs text-muted-foreground">
          <div class="font-semibold text-foreground mb-1">Current Adjustments:</div>
          <div class="pl-3">${commandSummary}</div>
        </div>
        <div class="text-xs text-muted-foreground italic">
          Click "Process All Images" to apply these settings to all ${totalFilesCount} uploaded image(s)
        </div>
      </div>
    `;

    // Build command HTML
    const commandHtml = `
      <div class="space-y-2">
        <div class="text-xs text-muted-foreground">
          ImageMagick command for current settings:
        </div>
        <div class="rounded bg-muted/60 px-3 py-2">
          <code class="text-[11px] font-mono text-foreground break-all">${escapeHtml(fullCommand)}</code>
        </div>
        <div class="text-xs text-muted-foreground italic">
          This command will be applied to all uploaded images when you click "Process All Images"
        </div>
      </div>
    `;

    return {
      previewHtml,
      commandHtml,
    };
  } catch (error) {
    console.error("Error generating preview:", error);
    const errorHtml = `<div class="text-sm text-destructive">Error generating preview: ${error.message}</div>`;
    return {
      previewHtml: errorHtml,
      commandHtml: "<div class='text-sm text-muted-foreground'>Commands will appear here after successful preview</div>",
    };
  }
}

/**
 * Apply filter preset to image
 */
function applyFilterPreset(Magick, image, preset) {
  console.log("Applying filter preset:", preset);

  switch (preset) {
    case "grayscale":
      image.grayscale(Magick.PixelIntensityMethod.Undefined);
      break;
    case "sepia":
      image.sepiaTone(new Magick.Percentage(80));
      break;
    case "negate":
      image.negate();
      break;
    case "normalize":
      image.normalize();
      break;
    case "autolevel":
      image.autoLevel();
      break;
    case "autogamma":
      image.autoGamma();
      break;
    case "charcoal":
      image.charcoal(0, 1);
      break;
    case "oilpaint":
      image.oilPaint(3, 1);
      break;
    case "solarize":
      image.solarize(new Magick.Percentage(50));
      break;
    case "wave":
      image.wave(25, 150);
      break;
    case "addnoise":
      // Add Gaussian noise, using NoiseType enum if available
      try {
        if (Magick.NoiseType && Magick.NoiseType.Gaussian) {
          image.addNoise(Magick.NoiseType.Gaussian);
        } else {
          // Fallback: try with number (Gaussian = 2 in some versions)
          image.addNoise(2);
        }
      } catch (e) {
        console.warn("addNoise not supported, skipping");
      }
      break;
    default:
      // No filter
      break;
  }
}

/**
 * Process all uploaded images with current adjustments
 */
async function processAllImages(Magick, inputFiles, filterPreset, brightness, contrast, saturation, hue, gamma, sharpen, blur, vignette, showPreview, callback) {
  console.log("Processing all", inputFiles.length, "images...");

  const results = [];
  const commands = [];

  for (let i = 0; i < inputFiles.length; i++) {
    const file = inputFiles[i];
    console.log(`Processing image ${i + 1}/${inputFiles.length}:`, file.name);

    // Update progress
    callback({
      "output-results": `<div class="text-sm text-muted-foreground">Processing ${i + 1} / ${inputFiles.length}: ${file.name}...</div>`,
    });

    try {
      const imageData = new Uint8Array(await file.arrayBuffer());
      let outputBlob = null;
      let commandText = "";

      Magick.ImageMagick.read(imageData, (image) => {
        console.log(`Image ${i + 1} loaded:`, image.width, "x", image.height);

        // Build ImageMagick command equivalent
        const cmdParts = [`convert input.${getFileExtension(file.name)}`];

        // Apply filter preset
        if (filterPreset && filterPreset !== "none") {
          applyFilterPreset(Magick, image, filterPreset);
          cmdParts.push(getFilterCommand(filterPreset));
        }

        // Apply adjustments
        if (brightness !== 100 || contrast !== 100) {
          const brightnessValue = new Magick.Percentage(brightness - 100);
          const contrastValue = new Magick.Percentage(contrast - 100);
          image.brightnessContrast(brightnessValue, contrastValue);
          cmdParts.push(`-brightness-contrast ${brightness - 100}x${contrast - 100}`);
        }

        if (saturation !== 100 || hue !== 100) {
          image.modulate(new Magick.Percentage(100), new Magick.Percentage(saturation), new Magick.Percentage(hue));
          cmdParts.push(`-modulate 100,${saturation},${hue}`);
        }

        if (gamma !== 1.0) {
          image.gammaCorrect(gamma);
          cmdParts.push(`-gamma ${gamma}`);
        }

        if (sharpen > 0) {
          image.sharpen(0, sharpen);
          cmdParts.push(`-sharpen 0x${sharpen}`);
        }

        if (blur > 0) {
          image.blur(blur, 1);
          cmdParts.push(`-blur ${blur}x1`);
        }

        if (vignette > 0) {
          image.vignette();
          cmdParts.push("-vignette");
        }

        cmdParts.push(`output_${file.name}`);
        commandText = cmdParts.join(" ");

        // Set output format
        const originalExt = getFileExtension(file.name);
        image.format = getImageMagickFormat(Magick, originalExt);

        // Write output
        image.write((data) => {
          outputBlob = new Blob([data], { type: getMimeType(originalExt) });
        });
      });

      if (!outputBlob) {
        throw new Error(`Failed to process ${file.name}`);
      }

      const outputUrl = URL.createObjectURL(outputBlob);
      const outputFilename = `adjusted_${file.name}`;

      results.push({
        filename: outputFilename,
        url     : outputUrl,
        size    : outputBlob.size,
      });

      commands.push({
        filename: file.name,
        command : commandText,
      });

      console.log(`Image ${i + 1} processed successfully:`, outputFilename);
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      results.push({
        filename: file.name,
        error   : error.message,
      });
    }
  }

  console.log("All images processed");

  // Build command output HTML
  const commandHtml = buildCommandHtml(commands);

  // Build results output HTML with showPreview flag
  const resultsHtml = buildResultsHtml(results, showPreview);

  return {
    "output-command": commandHtml,
    "output-results": resultsHtml,
  };
}

/**
 * Build HTML for ImageMagick commands
 */
function buildCommandHtml(commands) {
  if (commands.length === 0) {
    return "<div class='text-sm text-muted-foreground'>No commands to display</div>";
  }

  const commandItems = commands
    .map((cmd) => {
      return `
        <div class="space-y-1">
          <div class="text-xs font-semibold text-foreground">${escapeHtml(cmd.filename)}</div>
          <div class="rounded bg-muted/60 px-2 py-1.5">
            <code class="text-[11px] font-mono text-foreground break-all">${escapeHtml(cmd.command)}</code>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="space-y-3">
      <div class="text-xs text-muted-foreground">
        ImageMagick command equivalents for processed images:
      </div>
      ${commandItems}
    </div>
  `;
}

/**
 * Build HTML for processed results
 */
function buildResultsHtml(results, showPreview = false) {
  if (results.length === 0) {
    return "<div class='text-sm text-muted-foreground'>No results to display</div>";
  }

  // Filter out errors for download all
  const successResults = results.filter((r) => !r.error);

  // Build download all link
  const downloadAllHtml =
    successResults.length > 0
      ? `
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs text-muted-foreground">${results.length} image(s) processed</span>
      <a 
        href="#" 
        class="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        onclick="(function(el){var root=el.closest('[data-download-container]');if(!root)return false;var links=root.querySelectorAll('a[data-download-file]');links.forEach(function(link,index){setTimeout(function(){link.click();},index*100);});return false;})(this)"
      >
        Download All (${successResults.length} ${successResults.length === 1 ? "image" : "images"})
      </a>
    </div>
  `
      : `<div class="text-xs text-muted-foreground mb-2">${results.length} image(s) processed</div>`;

  const resultItems = results
    .map((result, index) => {
      if (result.error) {
        return `
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <div class="text-sm font-semibold text-destructive mb-1">${escapeHtml(result.filename)}</div>
            <div class="text-xs text-destructive/80">Error: ${escapeHtml(result.error)}</div>
          </div>
        `;
      }

      const sizeKB = (result.size / 1024).toFixed(2);

      if (showPreview) {
        // Preview mode: show image thumbnail
        return `
          <div class="rounded-lg border border-border bg-card p-3 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-semibold text-foreground truncate">${escapeHtml(result.filename)}</div>
              <div class="text-xs text-muted-foreground whitespace-nowrap">${sizeKB} KB</div>
            </div>
            <div class="rounded border border-border bg-muted/20 p-2">
              <img src="${result.url}" alt="${escapeHtml(result.filename)}" class="max-w-full h-auto rounded" style="max-height: 200px; margin: 0 auto; display: block;" />
            </div>
            <div>
              <a 
                href="${result.url}" 
                download="${escapeHtml(result.filename)}"
                data-download-file="true"
                class="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Download
              </a>
            </div>
          </div>
        `;
      } else {
        // List mode: simple list with download link
        return `
          <div class="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="text-sm font-medium text-foreground truncate">${escapeHtml(result.filename)}</div>
              <div class="text-xs text-muted-foreground whitespace-nowrap">${sizeKB} KB</div>
            </div>
            <a 
              href="${result.url}" 
              download="${escapeHtml(result.filename)}"
              data-download-file="true"
              class="text-sm text-primary underline underline-offset-2 hover:text-primary/80 whitespace-nowrap"
            >
              Download
            </a>
          </div>
        `;
      }
    })
    .join("");

  return `
    <div data-download-container>
      ${downloadAllHtml}
      <div class="${showPreview ? "grid grid-cols-2 gap-3" : "space-y-2"}">
        ${resultItems}
      </div>
    </div>
  `;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "png";
}

/**
 * Get ImageMagick format enum from file extension
 */
function getImageMagickFormat(Magick, ext) {
  const formatMap = {
    jpg : Magick.MagickFormat.Jpg,
    jpeg: Magick.MagickFormat.Jpeg,
    png : Magick.MagickFormat.Png,
    gif : Magick.MagickFormat.Gif,
    bmp : Magick.MagickFormat.Bmp,
    webp: Magick.MagickFormat.Webp,
    tiff: Magick.MagickFormat.Tiff,
    tif : Magick.MagickFormat.Tiff,
  };

  return formatMap[ext] || Magick.MagickFormat.Png;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext) {
  const mimeMap = {
    jpg : "image/jpeg",
    jpeg: "image/jpeg",
    png : "image/png",
    gif : "image/gif",
    bmp : "image/bmp",
    webp: "image/webp",
    tiff: "image/tiff",
    tif : "image/tiff",
  };

  return mimeMap[ext] || "image/png";
}

/**
 * Get ImageMagick command for filter preset
 */
function getFilterCommand(preset) {
  const commandMap = {
    grayscale: "-grayscale Rec709Luma",
    sepia    : "-sepia-tone 80%",
    negate   : "-negate",
    normalize: "-normalize",
    autolevel: "-auto-level",
    autogamma: "-auto-gamma",
    charcoal : "-charcoal 1",
    oilpaint : "-paint 3",
    solarize : "-solarize 50%",
    wave     : "-wave 25x150",
    addnoise : "-noise Gaussian",
  };

  return commandMap[preset] || "";
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    "&" : "&amp;",
    "<" : "&lt;",
    ">" : "&gt;",
    "\"": "&quot;",
    "'" : "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
