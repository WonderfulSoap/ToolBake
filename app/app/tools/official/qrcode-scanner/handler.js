/**
 * Scan an image while retaining binary QR payloads and segment metadata.
 * @param {InputUIWidgets} inputWidgets Current widget values.
 * @param {ChangedUIWidget} changedWidgetIds Widget that triggered execution.
 * @param {HandlerCallback} callback Update outputs before decoding starts.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  const empty = { qr_status: "", qr_text: "", qr_hex: "", qr_base64: "", qr_details: "" };
  const file = inputWidgets.qr_image;
  if (!file) {
    return { ...empty, qr_preview: '<div class="text-sm text-muted-foreground">No image selected.</div>', qr_status: '<div class="text-sm text-muted-foreground">Upload or paste an image to scan a QR code.</div>' };
  }

  // Clear previous payloads even if image loading or package loading fails.
  callback({ ...empty, qr_preview: "" });
  if (file.type && !file.type.startsWith("image/")) throw new Error("Please upload or paste an image file containing a QR code.");
  const encoding = inputWidgets.qr_encoding || "auto";
  if (!["auto", "utf-8", "gb18030", "shift_jis", "big5", "iso-8859-1"].includes(encoding)) throw new Error("Unsupported byte segment encoding.");
  console.log("[QR Scanner] Reading image", { name: file.name, size: file.size, encoding });

  const jsQR = await requirePackage("jsqr");
  const scan = await scanQrImage(file, jsQR, previewUrl => callback({ qr_preview: `<div class="flex justify-center"><img src="${previewUrl}" alt="Uploaded QR code image" class="max-h-72 max-w-full object-contain rounded-md border border-border" /></div>` }));
  if (!scan.code) {
    console.log("[QR Scanner] No readable QR code found");
    return { ...empty, qr_status: '<div class="text-sm text-muted-foreground">No readable QR code found. Try a sharper image or crop around a single QR code, keeping its border visible.</div>' };
  }

  const code = scan.code;
  const bytes = Array.from(code.binaryData);
  const base64 = btoa(String.fromCharCode(...bytes));
  const decoded = decodeQrText(code.chunks, encoding);
  console.log("[QR Scanner] Decoded QR code", { version: code.version, byteCount: bytes.length, segments: code.chunks.length, warnings: decoded.warnings });
  const notes = decoded.warnings.map(note => `<div class="text-xs text-muted-foreground">${escapeQrHtml(note)}</div>`).join("");
  return {
    qr_status: `<div class="space-y-2 text-sm"><div class="font-medium">QR code found · Version ${code.version} · ${bytes.length} payload bytes</div>${notes}<a href="data:application/octet-stream;base64,${base64}" download="qrcode-payload.bin" class="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">Download Payload (.bin)</a><div class="text-xs text-muted-foreground">Payload bytes exclude QR headers, padding, and error correction. Segment boundaries and ECI information are retained in Details.</div></div>`,
    qr_text: decoded.text,
    qr_hex: bytes.map(byte => byte.toString(16).padStart(2, "0").toUpperCase()).join(" "),
    qr_base64: base64,
    qr_details: JSON.stringify({ version: code.version, byteCount: bytes.length, encoding, warnings: decoded.warnings, bytes, segments: code.chunks, image: scan.image, location: code.location }, null, 2),
  };
}

/** Preview the loaded image before decoding, then retry at higher resolution for small QR codes. */
async function scanQrImage(file, jsQR, onPreview) {
  const url = URL.createObjectURL(file);
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
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is not available in this browser.");
    // Bound scan memory while keeping a full-resolution retry for ordinary images.
    const maxScale = Math.min(1, Math.sqrt(16000000 / (width * height)));
    const firstScale = Math.min(maxScale, 1600 / Math.max(width, height));
    try {
      for (const scale of [...new Set([firstScale, maxScale])]) {
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // Snapshot the first canvas so the preview survives object URL and canvas cleanup, including no-match results.
        if (scale === firstScale) onPreview(canvas.toDataURL("image/png"));
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        console.log("[QR Scanner] Scanning pixels", { width: canvas.width, height: canvas.height });
        const code = jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
        if (code) return { code, image: { width, height, scannedWidth: canvas.width, scannedHeight: canvas.height } };
      }
      return { code: null };
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode each byte segment explicitly so invalid UTF-8 never silently disappears. */
function decodeQrText(chunks, selectedEncoding) {
  const warnings = new Set();
  let eciEncoding = "utf-8";
  const eciEncodings = { 3: "iso-8859-1", 20: "shift_jis", 25: "utf-16be", 26: "utf-8", 27: "us-ascii", 28: "big5", 29: "gb18030" };
  const text = chunks.map(chunk => {
    if (chunk.type === "eci") {
      eciEncoding = eciEncodings[chunk.assignmentNumber];
      if (!eciEncoding && selectedEncoding === "auto") warnings.add(`Unsupported ECI assignment ${chunk.assignmentNumber}. Its byte segments are escaped; choose an encoding to interpret them.`);
      return "";
    }
    let value = chunk.text || "";
    if (chunk.type === "byte") {
      const encoding = selectedEncoding === "auto" ? eciEncoding : selectedEncoding;
      if (!encoding) return escapeQrBytes(chunk.bytes);
      // TextDecoder aliases Latin-1 to Windows-1252; decode it directly to retain C1 bytes.
      if (encoding === "iso-8859-1") value = String.fromCharCode(...chunk.bytes);
      else {
        try {
          if (encoding === "us-ascii" && chunk.bytes.some(byte => byte > 127)) throw new Error("Non-ASCII byte");
          value = new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(new Uint8Array(chunk.bytes));
        } catch {
          // Invalid text is an expected binary payload, not a failed scan.
          warnings.add(`A byte segment is not valid ${encoding} text. It is shown as escaped bytes; Hex, Base64, and the download preserve all bytes.`);
          return escapeQrBytes(chunk.bytes);
        }
      }
    }
    // Preserve whitespace while making other control characters visible and copyable.
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, character => {
      warnings.add("Control characters are escaped in the text view. Use Hex, Base64, or the download for the exact payload.");
      return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
    });
  }).join("");
  return { text, warnings: Array.from(warnings) };
}

/** Make binary segments visible without replacing or deleting any bytes. */
function escapeQrBytes(bytes) {
  return bytes.map(byte => `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`).join("");
}

/** Escape generated status notes before rendering them as HTML. */
function escapeQrHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
