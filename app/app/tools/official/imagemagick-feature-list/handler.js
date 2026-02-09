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
  // Only scan when button is clicked
  void inputWidgets; // Not used in this tool
  if (changedWidgetIds !== "scan-btn") {
    return {};
  }

  console.log("Starting ImageMagick feature scan...");

  // Load ImageMagick
  callback({ "scan-progress": buildProgressValue(10, "Loading", "Initializing ImageMagick WASM") });
  const Magick = await requirePackage("@imagemagick/magick-wasm");
  await Magick.initializeImageMagick();
  console.log("ImageMagick loaded successfully");

  // Scan features
  callback({ "scan-progress": buildProgressValue(30, "Scanning", "Analyzing MagickImage API") });
  const imageFeatures = scanImageFeatures(Magick);
  console.log("Image features scanned:", imageFeatures);

  callback({ "scan-progress": buildProgressValue(50, "Scanning", "Analyzing formats and enums") });
  const formatFeatures = scanFormatFeatures(Magick);
  const enumFeatures = scanEnumFeatures(Magick);
  console.log("Format features scanned:", formatFeatures);
  console.log("Enum features scanned:", enumFeatures);

  callback({ "scan-progress": buildProgressValue(70, "Building", "Generating feature reports") });

  // Build output HTML
  const summaryHtml = buildSummaryHtml(imageFeatures, formatFeatures, enumFeatures);
  const methodsHtml = buildMethodsHtml(imageFeatures.methods);
  const propertiesHtml = buildPropertiesHtml(imageFeatures.properties);
  const formatsHtml = buildFormatsHtml(formatFeatures);
  const enumsHtml = buildEnumsHtml(enumFeatures);
  const rawHtml = buildRawOutputHtml({ imageFeatures, formatFeatures, enumFeatures });

  console.log("Feature scan completed successfully");

  return {
    "scan-progress"   : buildProgressValue(100, "Completed", "Feature scan ready"),
    "summary"         : summaryHtml,
    "image-methods"   : methodsHtml,
    "image-properties": propertiesHtml,
    "formats"         : formatsHtml,
    "enums"           : enumsHtml,
    "raw-output"      : rawHtml,
  };
}

// Cache the ImageMagick module to avoid repeated initialization
let MagickModule;

// Scan MagickImage methods and properties by creating a test image
function scanImageFeatures(Magick) {
  const methods = [];
  const properties = [];

  try {
    // Use ImageMagick's built-in "logo:" image to create a valid test image
    // This is a small built-in image that ImageMagick provides for testing
    Magick.ImageMagick.read("logo:", (image) => {
      console.log("Successfully created test image for API inspection");
      const proto = Object.getPrototypeOf(image);
      const allKeys = new Set();

      // Collect from prototype chain
      let current = proto;
      while (current && current !== Object.prototype) {
        Object.getOwnPropertyNames(current).forEach((key) => allKeys.add(key));
        current = Object.getPrototypeOf(current);
      }

      console.log(`Found ${allKeys.size} total keys in prototype chain`);

      // Categorize as methods or properties
      allKeys.forEach((key) => {
        if (key === "constructor" || key.startsWith("_")) return;
        try {
          const descriptor = Object.getOwnPropertyDescriptor(proto, key) || Object.getOwnPropertyDescriptor(image, key);
          if (descriptor) {
            if (typeof descriptor.value === "function") {
              methods.push(key);
            } else if (descriptor.get || descriptor.set) {
              properties.push(key);
            }
          }
        } catch (e) {
          console.warn(`Failed to inspect ${key}:`, e.message);
        }
      });

      console.log(`Categorized ${methods.length} methods and ${properties.length} properties`);
    });
  } catch (e) {
    console.error("Failed to scan image features:", e);
    console.error("Error details:", e.message, e.stack);
  }

  return {
    methods   : methods.sort(),
    properties: properties.sort(),
  };
}

// Scan available format enums
function scanFormatFeatures(Magick) {
  const formats = [];
  try {
    if (Magick.MagickFormat) {
      Object.keys(Magick.MagickFormat).forEach((key) => {
        if (!key.startsWith("_") && isNaN(Number(key))) {
          formats.push(key);
        }
      });
    }
  } catch (e) {
    console.error("Failed to scan formats:", e);
  }
  return formats.sort();
}

// Scan available enums and constants
function scanEnumFeatures(Magick) {
  const enums = {};
  const enumNames = [
    "AlphaOption", "AutoThresholdMethod", "Channels", "ClassType", "ColorSpace",
    "ColorType", "CompositeOperator", "CompressionMethod", "DensityUnit",
    "Endian", "ErrorMetric", "EvaluateOperator", "FilterType", "Gravity",
    "Interlace", "MorphologyMethod", "OrientationType", "PixelChannel",
    "PixelIntensityMethod", "PixelInterpolateMethod", "RenderingIntent",
    "VirtualPixelMethod",
  ];

  enumNames.forEach((enumName) => {
    try {
      if (Magick[enumName]) {
        const values = [];
        Object.keys(Magick[enumName]).forEach((key) => {
          if (!key.startsWith("_") && isNaN(Number(key))) {
            values.push(key);
          }
        });
        if (values.length > 0) {
          enums[enumName] = values.sort();
        }
      }
    } catch (e) {
      console.warn(`Failed to scan enum ${enumName}:`, e.message);
    }
  });

  return enums;
}

// Build summary HTML
function buildSummaryHtml(imageFeatures, formatFeatures, enumFeatures) {
  const enumCount = Object.keys(enumFeatures).length;
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">ImageMagick WASM Feature Overview</p>
      <ul class="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
        <li>MagickImage methods: <span class="font-medium text-foreground">${escapeHtml(imageFeatures.methods.length)}</span></li>
        <li>MagickImage properties: <span class="font-medium text-foreground">${escapeHtml(imageFeatures.properties.length)}</span></li>
        <li>Supported formats: <span class="font-medium text-foreground">${escapeHtml(formatFeatures.length)}</span></li>
        <li>Available enums: <span class="font-medium text-foreground">${escapeHtml(enumCount)}</span></li>
      </ul>
      <div class="mt-2 text-xs text-muted-foreground">
        <p>This tool scans the ImageMagick WASM library to discover all available features, methods, and properties.</p>
        <p class="mt-1">Use this reference when you encounter missing features like gamma adjustment or filters.</p>
      </div>
    </div>
  `;
}

// Build methods HTML
function buildMethodsHtml(methods) {
  if (!methods.length) {
    return "<div class=\"text-sm text-muted-foreground\">No methods detected.</div>";
  }

  // Group methods by category based on common prefixes
  const categories = categorizeByPrefix(methods, [
    { prefix: "auto", label: "Auto Adjustments" },
    { prefix: "blur", label: "Blur Effects" },
    { prefix: "brightness", label: "Brightness/Contrast" },
    { prefix: "color", label: "Color Operations" },
    { prefix: "composite", label: "Composite Operations" },
    { prefix: "contrast", label: "Contrast Operations" },
    { prefix: "crop", label: "Crop/Trim" },
    { prefix: "draw", label: "Drawing" },
    { prefix: "enhance", label: "Enhancement" },
    { prefix: "evaluate", label: "Evaluate Operations" },
    { prefix: "flip", label: "Flip/Flop" },
    { prefix: "gamma", label: "Gamma Correction" },
    { prefix: "modulate", label: "Modulate" },
    { prefix: "morphology", label: "Morphology" },
    { prefix: "negate", label: "Negate" },
    { prefix: "normalize", label: "Normalize" },
    { prefix: "quantize", label: "Quantize" },
    { prefix: "resize", label: "Resize/Scale" },
    { prefix: "rotate", label: "Rotate/Shear" },
    { prefix: "sharpen", label: "Sharpen" },
    { prefix: "threshold", label: "Threshold" },
    { prefix: "write", label: "Write/Output" },
  ]);

  const categoryHtml = Object.entries(categories).map(([label, items]) => {
    if (!items.length) return "";
    const itemsHtml = items.map((m) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">${escapeHtml(m)}</code>`).join(" ");
    return `
      <div class="space-y-1">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">${escapeHtml(label)} (${items.length})</div>
        <div class="flex flex-wrap gap-1">${itemsHtml}</div>
      </div>
    `;
  }).filter(Boolean).join("");

  const uncategorized = methods.filter((m) => !Object.values(categories).flat().includes(m));
  const uncategorizedHtml = uncategorized.length ? `
    <div class="space-y-1">
      <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other Methods (${uncategorized.length})</div>
      <div class="flex flex-wrap gap-1">
        ${uncategorized.map((m) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">${escapeHtml(m)}</code>`).join(" ")}
      </div>
    </div>
  ` : "";

  return `
    <div class="space-y-3">
      <p class="text-sm font-semibold text-foreground">Total: ${methods.length} methods</p>
      ${categoryHtml}
      ${uncategorizedHtml}
    </div>
  `;
}

// Build properties HTML
function buildPropertiesHtml(properties) {
  if (!properties.length) {
    return "<div class=\"text-sm text-muted-foreground\">No properties detected.</div>";
  }

  const propertiesHtml = properties.map((p) =>
    `<code class="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">${escapeHtml(p)}</code>`
  ).join(" ");

  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">Total: ${properties.length} properties</p>
      <div class="flex flex-wrap gap-1">${propertiesHtml}</div>
    </div>
  `;
}

// Build formats HTML
function buildFormatsHtml(formats) {
  if (!formats.length) {
    return "<div class=\"text-sm text-muted-foreground\">No formats detected.</div>";
  }

  // Group formats by category
  const imageFormats = formats.filter((f) => /^(png|jpg|jpeg|gif|bmp|tiff|webp|ico|svg)/i.test(f));
  const rawFormats = formats.filter((f) => /^(raw|cr2|nef|arw|dng)/i.test(f));
  const documentFormats = formats.filter((f) => /^(pdf|ps|eps)/i.test(f));
  const otherFormats = formats.filter((f) =>
    !imageFormats.includes(f) && !rawFormats.includes(f) && !documentFormats.includes(f)
  );

  const buildFormatGroup = (label, items) => {
    if (!items.length) return "";
    const itemsHtml = items.map((f) => `<code class="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">${escapeHtml(f)}</code>`).join(" ");
    return `
      <div class="space-y-1">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">${label} (${items.length})</div>
        <div class="flex flex-wrap gap-1">${itemsHtml}</div>
      </div>
    `;
  };

  return `
    <div class="space-y-3">
      <p class="text-sm font-semibold text-foreground">Total: ${formats.length} formats</p>
      ${buildFormatGroup("Image Formats", imageFormats)}
      ${buildFormatGroup("RAW Formats", rawFormats)}
      ${buildFormatGroup("Document Formats", documentFormats)}
      ${buildFormatGroup("Other Formats", otherFormats)}
    </div>
  `;
}

// Build enums HTML
function buildEnumsHtml(enums) {
  const enumNames = Object.keys(enums);
  if (!enumNames.length) {
    return "<div class=\"text-sm text-muted-foreground\">No enums detected.</div>";
  }

  const enumsHtml = enumNames.map((enumName) => {
    const values = enums[enumName];
    const valuesHtml = values.map((v) =>
      `<code class="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">${escapeHtml(v)}</code>`
    ).join(" ");
    return `
      <div class="space-y-1">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">${escapeHtml(enumName)} (${values.length})</div>
        <div class="flex flex-wrap gap-1">${valuesHtml}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="space-y-3">
      <p class="text-sm font-semibold text-foreground">Total: ${enumNames.length} enums</p>
      ${enumsHtml}
    </div>
  `;
}

// Build raw output HTML with tabs and copy buttons
function buildRawOutputHtml(data) {
  const jsonStr = JSON.stringify(data, null, 2);
  const markdownStr = buildMarkdownFormat(data);

  const innerHtml = `
    <div id="raw-output-container" class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold text-foreground">Raw Analysis Data</p>
      </div>

      <!-- Tab buttons -->
      <div class="flex gap-2 border-b border-border">
        <button id="tab-json" class="px-3 py-1.5 text-sm font-medium border-b-2 border-primary text-primary">
          JSON
        </button>
        <button id="tab-markdown" class="px-3 py-1.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground">
          Markdown (LLM-friendly)
        </button>
      </div>

      <!-- JSON content -->
      <div id="content-json" class="space-y-2">
        <div class="flex justify-end">
          <button id="copy-json" class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-foreground">
            <span>Copy JSON</span>
          </button>
        </div>
        <pre class="text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-3 rounded bg-muted/30">${escapeHtml(jsonStr)}</pre>
      </div>

      <!-- Markdown content -->
      <div id="content-markdown" class="space-y-2 hidden">
        <div class="flex justify-end">
          <button id="copy-markdown" class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-foreground">
            <span>Copy Markdown</span>
          </button>
        </div>
        <pre class="text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words max-h-96 overflow-y-auto p-3 rounded bg-muted/30">${escapeHtml(markdownStr)}</pre>
      </div>
    </div>
  `;

  const afterHook = (container) => {
    const tabJson = container.querySelector("#tab-json");
    const tabMarkdown = container.querySelector("#tab-markdown");
    const contentJson = container.querySelector("#content-json");
    const contentMarkdown = container.querySelector("#content-markdown");
    const copyJsonBtn = container.querySelector("#copy-json");
    const copyMarkdownBtn = container.querySelector("#copy-markdown");

    if (!tabJson || !tabMarkdown || !contentJson || !contentMarkdown || !copyJsonBtn || !copyMarkdownBtn) {
      console.warn("Raw output: missing tab elements");
      return;
    }

    // Tab switching logic
    const switchToTab = (tab) => {
      if (tab === "json") {
        tabJson.classList.add("border-primary", "text-primary");
        tabJson.classList.remove("border-transparent", "text-muted-foreground");
        tabMarkdown.classList.remove("border-primary", "text-primary");
        tabMarkdown.classList.add("border-transparent", "text-muted-foreground");
        contentJson.classList.remove("hidden");
        contentMarkdown.classList.add("hidden");
      } else {
        tabMarkdown.classList.add("border-primary", "text-primary");
        tabMarkdown.classList.remove("border-transparent", "text-muted-foreground");
        tabJson.classList.remove("border-primary", "text-primary");
        tabJson.classList.add("border-transparent", "text-muted-foreground");
        contentMarkdown.classList.remove("hidden");
        contentJson.classList.add("hidden");
      }
    };

    tabJson.addEventListener("click", () => switchToTab("json"));
    tabMarkdown.addEventListener("click", () => switchToTab("markdown"));

    // Copy button logic
    const copyToClipboard = async (text, button) => {
      try {
        await navigator.clipboard.writeText(text);
        const originalText = button.querySelector("span").textContent;
        button.querySelector("span").textContent = "Copied!";
        setTimeout(() => {
          button.querySelector("span").textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
        button.querySelector("span").textContent = "Failed to copy";
        setTimeout(() => {
          button.querySelector("span").textContent = "Copy";
        }, 2000);
      }
    };

    copyJsonBtn.addEventListener("click", () => copyToClipboard(jsonStr, copyJsonBtn));
    copyMarkdownBtn.addEventListener("click", () => copyToClipboard(markdownStr, copyMarkdownBtn));
  };

  return { innerHtml, afterHook };
}

// Build Markdown format for LLM analysis
function buildMarkdownFormat(data) {
  const { imageFeatures, formatFeatures, enumFeatures } = data;
  let md = "# ImageMagick WASM Feature Analysis\n\n";

  // Summary
  md += "## Summary\n\n";
  md += `- **MagickImage Methods**: ${imageFeatures.methods.length}\n`;
  md += `- **MagickImage Properties**: ${imageFeatures.properties.length}\n`;
  md += `- **Supported Formats**: ${formatFeatures.length}\n`;
  md += `- **Available Enums**: ${Object.keys(enumFeatures).length}\n\n`;

  // Methods
  md += "## MagickImage Methods\n\n";
  if (imageFeatures.methods.length > 0) {
    md += "Available methods on MagickImage instances:\n\n";
    md += imageFeatures.methods.join(" ") + "\n\n";
  } else {
    md += "No methods detected.\n\n";
  }

  // Properties
  md += "## MagickImage Properties\n\n";
  if (imageFeatures.properties.length > 0) {
    md += "Available properties (getters/setters) on MagickImage instances:\n\n";
    md += imageFeatures.properties.join(" ") + "\n\n";
  } else {
    md += "No properties detected.\n\n";
  }

  // Formats
  md += "## Supported Image Formats\n\n";
  if (formatFeatures.length > 0) {
    md += "Available format enums from MagickFormat:\n\n";
    md += formatFeatures.join(" ") + "\n\n";
  } else {
    md += "No formats detected.\n\n";
  }

  // Enums
  md += "## Available Enums and Constants\n\n";
  const enumNames = Object.keys(enumFeatures);
  if (enumNames.length > 0) {
    enumNames.forEach((enumName) => {
      md += `**${enumName}**: `;
      md += enumFeatures[enumName].join(" ") + "\n\n";
    });
  } else {
    md += "No enums detected.\n\n";
  }

  // Usage notes
  md += "## Usage Notes\n\n";
  md += "- This data was extracted from the ImageMagick WASM library at runtime\n";
  md += "- All methods and properties are available on MagickImage instances\n";
  md += "- Use `Magick.ImageMagick.read()` to create MagickImage instances\n";
  md += "- Enums are accessed via `Magick.EnumName.Value`\n";
  md += "- Example: `image.resize(100, 100)` or `image.format = Magick.MagickFormat.Png`\n";

  return md;
}

// Categorize items by prefix
function categorizeByPrefix(items, prefixConfigs) {
  const categories = {};
  prefixConfigs.forEach(({ prefix, label }) => {
    categories[label] = items.filter((item) => item.toLowerCase().startsWith(prefix.toLowerCase()));
  });
  return categories;
}

// Escape HTML entities
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Build progress value for ProgressBar widget
function buildProgressValue(percent, label, hint) {
  const safePercent = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return {
    current: safePercent,
    total  : 100,
    percent: safePercent,
    label,
    hint,
  };
}

