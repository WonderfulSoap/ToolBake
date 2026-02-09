/**
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const triggers = ["fileInput", "fileNameInput", "fileExtInput"];
  if (!triggers.includes(changedWidgetIds)) {
    return { clipboardNote: buildLimitNoteHtml() };
  }

  let file = inputWidgets.fileInput;
  if (Array.isArray(file)) file = file[0];
  if (!file) {
    return {
      clipboardNote: buildLimitNoteHtml(),
      previewOutput: "<div class='text-xs text-muted-foreground italic'>Awaiting file...</div>",
    };
  }

  const mimeType = file.type || "application/octet-stream";
  const { baseName, extension } = splitFileName(file.name || "", mimeType);
  const defaultName = baseName || "clipboard";
  const defaultExt = extension || "bin";
  const fileNameInput = normalizeBaseName(inputWidgets.fileNameInput, defaultName);
  const fileExtInput = normalizeExtension(inputWidgets.fileExtInput, defaultExt);
  const downloadName = buildDownloadName(fileNameInput, fileExtInput);

  const objectUrl = URL.createObjectURL(file);
  let textPreview;
  let textTruncated;
  if (isTextMimeType(mimeType)) {
    const preview = await readTextPreviewFromFile(file);
    textPreview = preview.preview;
    textTruncated = preview.truncated;
  }

  const result = {
    clipboardNote: buildLimitNoteHtml(),
    previewOutput: generatePreviewHtml({
      dataUrl : objectUrl,
      mimeType,
      fileName: downloadName,
      textPreview,
      textTruncated,
    }),
  };

  if (changedWidgetIds === "fileInput") {
    result.fileNameInput = defaultName;
    result.fileExtInput = defaultExt;
  }

  return result;
}

function normalizeBaseName(value, fallback) {
  const name = String(value ?? "").trim();
  if (!name) return fallback;
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

function normalizeExtension(value, fallback) {
  const ext = String(value ?? "").trim().replace(/^\./, "");
  return ext || fallback;
}

function splitFileName(fileName, mimeType) {
  const safeName = fileName || "";
  const dotIndex = safeName.lastIndexOf(".");
  if (dotIndex > 0 && dotIndex < safeName.length - 1) {
    return { baseName: safeName.slice(0, dotIndex), extension: safeName.slice(dotIndex + 1) };
  }
  return { baseName: safeName, extension: extensionFromMimeType(mimeType) };
}

function buildDownloadName(baseName, extension) {
  if (!extension) return baseName;
  return `${baseName}.${extension}`;
}

async function readTextPreviewFromFile(file) {
  const text = await file.text();
  return { preview: text, truncated: false };
}

function extensionFromMimeType(mimeType) {
  if (mimeType.startsWith("image/")) return mimeType.split("/")[1] || "png";
  if (mimeType.startsWith("video/")) return mimeType.split("/")[1] || "mp4";
  if (mimeType.startsWith("audio/")) return mimeType.split("/")[1] || "mp3";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/html") return "html";
  if (mimeType === "application/json") return "json";
  if (mimeType === "application/xml" || mimeType === "text/xml") return "xml";
  if (mimeType === "application/x-yaml" || mimeType === "application/yaml") return "yaml";
  if (mimeType === "application/toml") return "toml";
  if (mimeType === "text/csv" || mimeType === "application/csv") return "csv";
  if (mimeType === "application/javascript") return "js";
  if (mimeType === "application/typescript") return "ts";
  if (mimeType.startsWith("text/")) return "txt";
  return "bin";
}

function isTextMimeType(mimeType) {
  if (mimeType.startsWith("text/")) return true;
  if (mimeType === "application/pdf" || mimeType === "application/octet-stream") return false;
  if (mimeType.startsWith("application/")) return true;
  return false;
}

function buildLimitNoteHtml() {
  return `
    <div class="flex items-center gap-2 p-2 rounded-sm bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-600 dark:text-yellow-500 leading-relaxed">
      <div>No file size limit is enforced in the browser. Very large files may cause slowdowns or crashes.</div>
    </div>`;
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generatePreviewHtml(payload) {
  const {
    dataUrl,
    mimeType = "application/octet-stream",
    fileName,
    textPreview,
    textTruncated,
  } = payload ?? {};

  let previewMedia = "";
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
    previewMedia = `
      <div class="w-full py-10 bg-muted/30 rounded-sm flex flex-col items-center justify-center gap-3 mb-2 px-4">
        <div class="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">Audio Preview</div>
        <audio controls src="${dataUrl}" class="w-full max-w-md h-10"></audio>
      </div>`;
  } else if (mimeType === "application/pdf") {
    previewMedia = `<embed src="${dataUrl}" type="application/pdf" width="100%" height="320px" class="rounded-sm mb-2" />`;
  } else if (isTextMimeType(mimeType)) {
    const safeText = escapeHtml(textPreview ?? "");
    previewMedia = `
      <div class="w-full rounded-sm bg-muted/30 border border-border/60 mb-2">
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
          <span class="text-[11px] uppercase tracking-wide text-muted-foreground">Text Preview</span>
          ${textTruncated ? "<span class='text-[11px] text-muted-foreground'>Truncated</span>" : ""}
        </div>
        <pre class="p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words max-h-64 overflow-auto">${safeText}</pre>
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
          <div class="text-sm font-semibold text-foreground truncate" title="${fileName}">${fileName}</div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">${mimeType}</span>
          </div>
        </div>
        <a
          href="${dataUrl}"
          download="${fileName}"
          class="text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all whitespace-nowrap"
        >
          Download File
        </a>
      </div>
      ${previewMedia}
    </div>
  `;
}
