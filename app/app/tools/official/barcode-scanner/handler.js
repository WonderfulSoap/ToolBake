/**
 * Decode a supported 1D barcode without uploading its image.
 * @param {InputUIWidgets} inputWidgets Current widget values.
 * @param {ChangedUIWidget} changedWidgetIds Widget that triggered execution.
 * @param {HandlerCallback} callback Clear previous results before reading a new image.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  const empty = { barcode_status: "", barcode_text: "", barcode_details: "" };
  const file = inputWidgets.barcode_image;
  if (!file) return { ...empty, barcode_preview: '<div class="text-sm text-muted-foreground">No image selected.</div>', barcode_status: '<div class="text-sm text-muted-foreground">Upload or paste an image to scan a barcode.</div>' };
  callback({ ...empty, barcode_preview: "" });
  if (file.type && !file.type.startsWith("image/")) throw new Error("Please upload or paste an image containing a barcode.");
  const format = inputWidgets.barcode_format || "auto";
  const formats = { CODE_128: "Code128", CODE_39: "Code39Std", CODE_93: "Code93", EAN_13: "EAN13", EAN_8: "EAN8", UPC_A: "UPCA", UPC_E: "UPCE", ITF: "ITF", CODABAR: "Codabar" };
  if (format !== "auto" && !Object.hasOwn(formats, format)) throw new Error("Unsupported barcode format.");
  console.log("[Barcode Scanner] Reading image", { name: file.name, size: file.size, format });
  const zxing = await requirePackage("zxing-wasm/reader");
  const options = { formats: format === "auto" ? Object.values(formats) : [formats[format]], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 1, textMode: "Plain" };
  const scan = await scanBarcodeImage(file, zxing, options, previewUrl => callback({ barcode_preview: `<div class="flex justify-center"><img src="${previewUrl}" alt="Uploaded barcode image" class="max-h-72 max-w-full object-contain rounded-md border border-border" /></div>` }));
  if (!scan.result) {
    console.log("[Barcode Scanner] No readable supported barcode found");
    return { ...empty, barcode_status: '<div class="text-sm text-muted-foreground">No readable supported barcode found. Try Auto format, a sharper image, or crop around one barcode while keeping the blank space on both sides.</div>' };
  }
  const result = scan.result;
  const metadata = result.extra ? JSON.parse(result.extra) : {};
  // ZXing normalizes UPC-E content to UPC-A; retain its original compact value when available.
  let text = result.format === "UPCE" && metadata.UPCE ? metadata.UPCE : result.text;
  let detectedFormat = result.format;
  // UPC-A is identical to EAN-13 with a leading zero; normalize Auto and explicit UPC-A results to 12 digits.
  if ((format === "auto" || format === "UPC_A") && (detectedFormat === "EAN13" || detectedFormat === "UPCA") && text.length === 13 && text.startsWith("0")) {
    detectedFormat = "UPCA";
    text = text.slice(1);
  }
  console.log("[Barcode Scanner] Decoded barcode", { format: detectedFormat, characterCount: text.length });
  return {
    barcode_status: `<div class="space-y-1 text-sm"><div class="font-medium">Barcode found · ${zxing.formatToLabel(detectedFormat)} · ${text.length} characters</div><div class="text-xs text-muted-foreground">Auto treats EAN-13 with a leading zero as UPC-A. Select EAN-13 explicitly to keep all 13 digits. Details contains the exact text, including any control characters.</div></div>`,
    barcode_text: text.replace(/[\x00-\x1F\x7F-\x9F]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`),
    barcode_details: JSON.stringify({ format: detectedFormat, decoderFormat: result.format, text, characterCount: text.length, normalizedText: result.text, metadata, image: scan.image, position: result.position, rotation: result.rotation, inverted: scan.image.inverted }, null, 2),
  };
}

/** Preview the loaded image before decoding, then retry at higher resolution while bounding canvas memory. */
async function scanBarcodeImage(file, zxing, options, onPreview) {
  const url = URL.createObjectURL(file);
  let canvas;
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The image could not be read. Try a PNG, JPEG, or WebP image."));
      image.src = url;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error("The image has no readable pixels.");
    canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is not available in this browser.");
    const maxScale = Math.min(1, Math.sqrt(16000000 / (width * height)));
    const firstScale = Math.min(maxScale, 1600 / Math.max(width, height));
    for (const scale of [...new Set([firstScale, maxScale])]) {
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Keep a bounded PNG preview after the temporary object URL and scan canvas are released.
      if (scale === firstScale) onPreview(canvas.toDataURL("image/png"));
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      console.log("[Barcode Scanner] Scanning pixels", { width: canvas.width, height: canvas.height });
      for (const inverted of [false, true]) {
        // Some 1D readers require explicit pixel inversion despite the tryInvert option.
        const scanPixels = inverted ? { width: pixels.width, height: pixels.height, data: pixels.data.map((value, index) => index % 4 === 3 ? value : 255 - value) } : pixels;
        const results = await zxing.readBarcodes(scanPixels, options);
        const result = results.find(candidate => candidate.isValid);
        if (result) return { result, image: { width, height, scannedWidth: canvas.width, scannedHeight: canvas.height, inverted: inverted || result.isInverted } };
      }
    }
    return { result: null };
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
    URL.revokeObjectURL(url);
  }
}
