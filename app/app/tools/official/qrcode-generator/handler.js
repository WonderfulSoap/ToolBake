/**
 * Generate QR code images with configurable colors and error correction.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  void changedWidgetIds;
  const text = String(inputWidgets.qr_text ?? "").trim();
  const foreground = normalizeColor(inputWidgets.foreground_color, "#111827");
  const background = normalizeColor(inputWidgets.background_color, "#ffffff");
  const errorLevel = normalizeErrorLevel(inputWidgets.error_level);
  if (!text) return { qr_preview: buildEmptyPreviewHtml(), qr_download: "" };
  const QRCode = await requirePackage("qrcode");
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: errorLevel,
      margin              : 1,
      width               : 320,
      color               : { dark: foreground, light: background },
    });
    return {
      qr_preview : buildPreviewHtml(dataUrl),
      qr_download: buildDownloadHtml(dataUrl, "qrcode.png"),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate QR code.";
    return { qr_preview: buildErrorHtml(message), qr_download: "" };
  }
}

function normalizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed) || /^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return fallback;
}

function normalizeErrorLevel(value) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (text === "L" || text === "M" || text === "Q" || text === "H") return text;
  return "M";
}

function buildPreviewHtml(dataUrl) {
  return `
    <div class="flex flex-col items-center gap-3">
      <img src="${dataUrl}" alt="QR code preview" class="w-56 h-56 rounded-md border border-border bg-white" />
      <div class="text-xs text-muted-foreground">PNG preview, sized for quick scanning.</div>
    </div>
  `.trim();
}

function buildDownloadHtml(dataUrl, filename) {
  return `
    <div class="text-sm leading-relaxed">
      <a href="${dataUrl}" download="${filename}" class="font-medium text-primary underline underline-offset-2">Download PNG</a>
    </div>
  `.trim();
}

function buildEmptyPreviewHtml() {
  return "<div class=\"text-sm text-muted-foreground\">Enter text to generate a QR code preview.</div>";
}

function buildErrorHtml(message) {
  return `<div class="text-sm text-destructive">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
