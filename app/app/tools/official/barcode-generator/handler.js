/**
 * Validate and render a 1D barcode as PNG and SVG without trimming its value.
 * @param {InputUIWidgets} inputWidgets Current widget values.
 * @param {ChangedUIWidget} changedWidgetIds Widget that triggered execution.
 * @param {HandlerCallback} callback Clear stale downloads before rendering.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  const value = String(inputWidgets.barcode_value ?? "");
  const format = inputWidgets.barcode_format || "CODE128";
  const requirements = barcodeRequirements();
  if (!Object.hasOwn(requirements, format)) throw new Error("Unsupported barcode format.");
  const empty = { barcode_help: `<div class="text-sm text-muted-foreground">${requirements[format]}</div>`, barcode_preview: "", barcode_download: "" };
  if (!value) return { ...empty, barcode_preview: '<div class="text-sm text-muted-foreground">Enter a value to generate a barcode.</div>' };
  callback(empty);
  if (value.length > 256) return { ...empty, barcode_preview: '<div class="text-sm text-destructive">Use at most 256 characters per barcode.</div>' };
  // Some encoder APIs reserve non-ASCII characters as function codes; reject Unicode rather than silently reinterpret it.
  if (/[^\x00-\x7F]/.test(value)) return { ...empty, barcode_preview: '<div class="text-sm text-destructive">Invalid value for this format. Use the QR Code Generator for Unicode text.</div>' };
  const width = Number(inputWidgets.barcode_width ?? 2);
  const height = Number(inputWidgets.barcode_height ?? 100);
  if (!Number.isInteger(width) || width < 1 || width > 4 || !Number.isInteger(height) || height < 30 || height > 300) throw new Error("Bar width must be an integer from 1 to 4, and height from 30 to 300 pixels.");
  const JsBarcode = await requirePackage("jsbarcode");
  console.log("[Barcode Generator] Rendering barcode", { format, characterCount: value.length, width, height });
  let valid = true;
  // Scale quiet zones with the module width to keep wide bars scannable.
  const options = { format, width, height, displayValue: inputWidgets.barcode_display_value !== false, margin: width * 12, fontSize: 18, lineColor: "#000000", background: "#ffffff", valid: result => { valid = result; } };
  // SVG text nodes are escaped by the renderer; preview only the encoded data URL.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, options);
  if (!valid) {
    console.log("[Barcode Generator] Value does not meet format requirements", { format });
    return { ...empty, barcode_preview: '<div class="text-sm text-destructive">Invalid value or checksum for this format. Check the format requirements above.</div>' };
  }
  // XMLSerializer adds the namespace for this namespaced element; remove the renderer's plain attribute to avoid duplicate xmlns declarations.
  svg.removeAttribute("xmlns");
  const svgText = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const canvas = document.createElement("canvas");
  let pngUrl;
  try {
    JsBarcode(canvas, value, options);
    pngUrl = canvas.toDataURL("image/png");
  } finally {
    canvas.width = canvas.height = 0;
  }
  const linkClass = "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20";
  console.log("[Barcode Generator] Generated PNG and SVG", { format });
  return {
    barcode_help: empty.barcode_help,
    barcode_preview: `<div class="overflow-x-auto rounded-md border border-border bg-white p-2"><img src="${svgUrl}" alt="Generated barcode" class="max-w-none" /></div>`,
    barcode_download: `<div class="flex flex-wrap items-center gap-2"><a href="${pngUrl}" download="barcode-${format.toLowerCase()}.png" class="${linkClass}">Download PNG</a><a href="${svgUrl}" download="barcode-${format.toLowerCase()}.svg" class="${linkClass}">Download SVG</a></div>`,
  };
}

/** Describe accepted characters, lengths, and automatic check digits for each format. */
function barcodeRequirements() {
  return {
    CODE128: "Code 128 supports ASCII text and digits. Use the QR Code Generator for Unicode text.",
    CODE39: "Code 39 supports uppercase A-Z, digits, spaces, and - . $ / + %. Lowercase letters are converted to uppercase by this format.",
    CODE93: "Code 93 supports uppercase A-Z, digits, spaces, and - . $ / + %.",
    EAN13: "EAN-13 requires 12 digits (check digit added automatically) or 13 digits with a valid check digit.",
    EAN8: "EAN-8 requires 7 digits (check digit added automatically) or 8 digits with a valid check digit.",
    UPC: "UPC-A requires 11 digits (check digit added automatically) or 12 digits with a valid check digit.",
    UPCE: "UPC-E accepts 6 payload digits (number system 0 and check digit added automatically), or 8 digits with number system 0/1 and a valid check digit.",
    ITF: "ITF requires an even number of digits. No check digit is added automatically.",
    ITF14: "ITF-14 requires 13 digits (check digit added automatically) or 14 digits with a valid check digit.",
    codabar: "Codabar supports digits and - $ : / . +, with optional A/B/C/D start and stop characters. If omitted, A start/stop characters are added automatically.",
  };
}
