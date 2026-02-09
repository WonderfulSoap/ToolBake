const DETECT_SAMPLE_SIZE = 64 * 1024;

/**
 * Text file encoding converter/fixer handler
 * Only processes uploaded files, not direct text input
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const fileInput = pickFile(inputWidgets.fileInput);
  if (!fileInput) {
    return { outputText: "", downloadInfo: buildEmptyState() };
  }

  const chardet = await requirePackage("chardet");
  const iconv = await requirePackage("iconv-lite");
  const payload = await resolveInputPayload(fileInput);
  const sample = payload.bytes.length > DETECT_SAMPLE_SIZE ? payload.bytes.slice(0, DETECT_SAMPLE_SIZE) : payload.bytes;
  const detectedRaw = chardet.detect(sample) || "utf-8";
  const detectedEncoding = normalizeEncodingName(detectedRaw);
  const sourceSelection = normalizeEncodingName(inputWidgets.sourceEncoding || "auto");
  const sourceEncoding = sourceSelection !== "auto" ? sourceSelection : detectedEncoding;
  const safeSourceEncoding = iconv.encodingExists(sourceEncoding) ? sourceEncoding : iconv.encodingExists(detectedEncoding) ? detectedEncoding : "utf-8";
  const targetSelection = normalizeEncodingName(inputWidgets.targetEncoding || "utf-8");
  const targetEncoding = iconv.encodingExists(targetSelection) ? targetSelection : "utf-8";

  const decodedText = iconv.decode(payload.bytes, safeSourceEncoding);
  const outputBuffer = iconv.encode(decodedText, targetEncoding);
  const suggestedName = deriveSuggestedName(payload.name);
  const outputFileName = shouldAutofillName(inputWidgets.outputFileName, changedWidgetIds) ? suggestedName.baseName : inputWidgets.outputFileName;
  const outputFileExtension = shouldAutofillExt(inputWidgets.outputFileExtension, changedWidgetIds) ? suggestedName.ext : inputWidgets.outputFileExtension;
  const downloadName = buildDownloadName(outputFileName, outputFileExtension);
  const downloadUrl = URL.createObjectURL(new Blob([outputBuffer], { type: `text/plain;charset=${targetEncoding}` }));
  return {
    outputText  : decodedText,
    outputFileName,
    outputFileExtension,
    downloadInfo: buildDownloadHtml(downloadUrl, downloadName, detectedRaw, safeSourceEncoding, targetEncoding),
    __cleanup   : function cleanup() { URL.revokeObjectURL(downloadUrl); },
  };
}

function pickFile(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function resolveInputPayload(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name || "uploaded.txt";
  return { bytes, name };
}

function normalizeEncodingName(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  if (!normalized) return "";
  if (normalized === "utf8") return "utf-8";
  if (normalized === "utf16le") return "utf-16le";
  if (normalized === "utf16be") return "utf-16be";
  return normalized;
}

function deriveSuggestedName(name) {
  const safeName = name || "converted.txt";
  const { baseName, ext } = splitFileName(safeName);
  return { baseName: baseName || "converted", ext: ext || "txt" };
}

function shouldAutofillName(currentValue, changedWidgetIds) {
  if (!currentValue || !String(currentValue).trim()) return true;
  return changedWidgetIds === "fileInput";
}

function shouldAutofillExt(currentValue, changedWidgetIds) {
  if (!currentValue || !String(currentValue).trim()) return true;
  return changedWidgetIds === "fileInput";
}

function buildDownloadName(fileName, fileExt) {
  const cleanedName = sanitizeFileSegment(fileName) || "converted";
  const cleanedExt = normalizeExtension(fileExt);
  return cleanedExt ? `${cleanedName}.${cleanedExt}` : cleanedName;
}

function splitFileName(name) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return { baseName: name, ext: "" };
  return { baseName: name.slice(0, dotIndex), ext: name.slice(dotIndex + 1) };
}

function normalizeExtension(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
}

function sanitizeFileSegment(value) {
  if (!value) return "";
  return String(value).trim().replace(/[\\\\/]+/g, "-");
}

function buildEmptyState() {
  return "<div class='text-xs text-muted-foreground italic'>Awaiting input...</div>";
}

function buildDownloadHtml(url, fileName, detected, source, target) {
  const safeFileName = escapeHtml(fileName);
  const safeFileAttr = escapeHtmlAttribute(fileName);
  const detectedLabel = detected ? escapeHtml(String(detected)) : "unknown";
  const sourceLabel = escapeHtml(String(source || "utf-8"));
  const targetLabel = escapeHtml(String(target || "utf-8"));
  return `
    <div class='flex flex-col gap-1'>
      <div class='text-xs text-muted-foreground'>Detected: <span class='font-medium text-foreground'>${detectedLabel}</span> · Using: <span class='font-medium text-foreground'>${sourceLabel}</span></div>
      <div class='text-xs text-muted-foreground'>Output encoding: <span class='font-medium text-foreground'>${targetLabel}</span></div>
      <a class='font-medium text-primary underline underline-offset-2' href='${url}' download='${safeFileAttr}'>Download converted file</a>
      <div class='text-[11px] text-muted-foreground'>Filename: ${safeFileName}</div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
