/**
 * Hard limit: 20MB in bytes
 * Browsers often struggle with strings over 25-50MB; 
 * Base64 is ~33% larger than raw binary.
 */
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const TEXT_PREVIEW_LIMIT = 80 * 1024;

/**
 * @param {InputUIWidgets} inputWidgets 
 * @param {ChangedUIWidget} changedWidgetIds 
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  // 1. Handle File to Base64 conversion
  if (changedWidgetIds === "fileInput") {
    let file = inputWidgets.fileInput;
    if (Array.isArray(file)) file = file[0];
    if (!file) return {};

    // --- NEW: Size Detection ---
    if (file.size > MAX_FILE_SIZE) {
      return {
        base64Input  : "",
        previewOutput: `
          <div class="p-3 rounded-sm bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
            <strong>File too large:</strong> Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB. 
            The browser's Base64 processing limit is set to 20MB to prevent crashing.
          </div>`
      };
    }

    try {
      const dataUrl = await fileToDataURL(file);
      return {
        base64Input  : dataUrl,
        previewOutput: generatePreviewHtml(dataUrl, file.name)
      };
    } catch (err) {
      return { 
        previewOutput: `<div class='text-xs text-destructive font-medium'>Error: ${err.message}</div>` 
      };
    }
  }

  // 2. Handle Base64 to File conversion
  if (changedWidgetIds === "base64Input") {
    const dataUrl = inputWidgets.base64Input?.trim();
    if (!dataUrl) {
      return { 
        previewOutput: "<div class='text-xs text-muted-foreground italic'>Awaiting input...</div>" 
      };
    }

    try {
      if (!dataUrl.startsWith("data:")) {
        throw new Error("Invalid DataURL format. Must start with 'data:'");
      }
      return {
        previewOutput: generatePreviewHtml(dataUrl, "decoded_file")
      };
    } catch (err) {
      return { 
        previewOutput: `<div class='text-xs text-destructive font-medium'>Error: ${err.message}</div>` 
      };
    }
  }

  return {};
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error("Invalid file object"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generates HTML following the UI Style Guide
 */
function generatePreviewHtml(dataUrl, fileName) {
  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  
  let downloadName = fileName;
  if (fileName === "decoded_file") {
    const ext = mimeType.split("/")[1] || "bin";
    downloadName = `file_${Date.now()}.${ext}`;
  }

  let previewMedia = "";
  
  // Logic: Choose preview based on MIME type
  if (mimeType.startsWith("image/")) {
    previewMedia = `
      <div class="w-full h-80 bg-muted/30 rounded-sm flex items-center justify-center overflow-hidden mb-2">
        <img src="${dataUrl}" class="max-w-full max-h-full object-contain" />
      </div>`;
  } else if (mimeType.startsWith("video/")) {
    previewMedia = `
      <div class="w-full h-80 bg-muted/80 rounded-sm flex items-center justify-center overflow-hidden mb-2">
        <video controls src="${dataUrl}" class="max-w-full max-h-full"></video>
      </div>`;
  } else if (mimeType.startsWith("audio/")) {
    // --- NEW: Audio Preview Support ---
    previewMedia = `
      <div class="w-full py-10 bg-muted/30 rounded-sm flex flex-col items-center justify-center gap-3 mb-2 px-4">
        <div class="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">Audio Preview</div>
        <audio controls src="${dataUrl}" class="w-full max-w-md h-10"></audio>
      </div>`;
  } else if (mimeType === "application/pdf") {
    previewMedia = `<embed src="${dataUrl}" type="application/pdf" width="100%" height="320px" class="rounded-sm mb-2" />`;
  } else if (isTextMimeType(mimeType)) {
    const textPreview = decodeTextPreview(dataUrl, TEXT_PREVIEW_LIMIT);
    previewMedia = `
      <div class="w-full rounded-sm bg-muted/30 border border-border/60 mb-2">
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
          <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Text Preview</span>
          ${textPreview.truncated ? "<span class='text-[11px] text-muted-foreground'>Truncated</span>" : ""}
        </div>
        <pre class="p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words max-h-64 overflow-auto">${textPreview.text}</pre>
      </div>`;
  } else {
    previewMedia = `
      <div class="py-10 bg-muted/20 rounded-sm text-center mb-2">
        <span class="text-[11px] uppercase tracking-wide text-muted-foreground italic leading-relaxed">No visual preview for ${mimeType}</span>
      </div>`;
  }

  return `
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between gap-4 py-1">
        <div class="flex flex-col min-w-0">
          <div class="text-sm font-semibold text-foreground truncate" title="${downloadName}">${downloadName}</div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">${mimeType}</span>
          </div>
        </div>
        <a
          href="${dataUrl}"
          download="${downloadName}"
          class="text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all whitespace-nowrap"
        >
          Download File
        </a>
      </div>
      ${previewMedia}
    </div>
  `;
}

function isTextMimeType(mimeType) {
  if (mimeType.startsWith("text/")) return true;
  return [
    "application/json",
    "application/xml",
    "application/xhtml+xml",
    "application/x-yaml",
    "application/yaml",
    "application/toml",
    "application/javascript",
    "application/typescript",
    "application/csv",
  ].includes(mimeType);
}

function decodeTextPreview(dataUrl, limit) {
  const base64Match = dataUrl.match(/^data:[^;]+;base64,(.*)$/);
  if (!base64Match) return { text: "Unable to decode preview.", truncated: false };
  const bytes = base64ToUint8Array(base64Match[1], limit + 1);
  const truncated = bytes.length > limit;
  const slice = truncated ? bytes.slice(0, limit) : bytes;
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch (err) {
    text = "Unable to decode text preview.";
  }
  return { text, truncated };
}

function base64ToUint8Array(base64, maxBytes) {
  const binary = atob(base64);
  const len = Math.min(binary.length, maxBytes);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
