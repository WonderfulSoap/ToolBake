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
  const videoFiles = normalizeInputFiles(inputWidgets.sourceVideos);
  const targetFormat = normalizeTargetFormat(inputWidgets.targetFormat);
  const remuxOnly = Boolean(inputWidgets.remuxOnly);

  if (changedWidgetIds && changedWidgetIds !== "convertTrigger") {
    revokeObjectUrls();
    return buildIdleResponse(videoFiles.length, targetFormat, remuxOnly);
  }

  if (!videoFiles.length) {
    revokeObjectUrls();
    return buildEmptyResponse();
  }

  if (!targetFormat) {
    revokeObjectUrls();
    return buildFormatMissingResponse();
  }

  if (changedWidgetIds !== "convertTrigger") return buildIdleResponse(videoFiles.length, targetFormat, remuxOnly);

  if (!FFmpegModule) FFmpegModule = await requirePackage("ffmpeg");
  if (!ffmpeg) {
    ffmpeg = new FFmpegModule.FFmpeg();
    await ffmpeg.load_ffmpeg();
  }

  revokeObjectUrls();
  callback({ convertProgress: buildProgressValue(0, "Starting", remuxOnly ? "Preparing remuxing" : "Preparing conversions") });

  let logHandler;
  try {
    const logBuffer = createLogBuffer(60);
    logHandler = buildLogHandler(logBuffer, callback);
    if (typeof ffmpeg.on === "function") ffmpeg.on("log", logHandler);
    const outputs = [];
    for (let index = 0; index < videoFiles.length; index += 1) {
      const file = videoFiles[index];
      const inputName = ensureInputName(file.name, index);
      const outputName = resolveOutputName(inputName, file.name, targetFormat, index);
      const stageLabel = remuxOnly ? `Remuxing ${index + 1}/${videoFiles.length}` : `Converting ${index + 1}/${videoFiles.length}`;
      const stageHint = remuxOnly ? `Copying streams to .${targetFormat}` : `Target .${targetFormat}`;

      await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
      const args = ["-y", "-i", inputName];
      if (remuxOnly) args.push("-c", "copy");
      args.push(outputName);
      await runCommandWithProgress(ffmpeg, args, index, videoFiles.length, stageLabel, stageHint, callback);
      const outputBuffer = await ffmpeg.readFile(outputName);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      outputs.push(buildDownloadEntry(outputName, outputBuffer, targetFormat));
    }

    if (logHandler && typeof ffmpeg.off === "function") ffmpeg.off("log", logHandler);
    return {
      convertOutput  : buildOutputHtml(outputs),
      convertError   : buildStatusHtml(remuxOnly ? "Remux complete." : "Conversion complete."),
      convertProgress: buildProgressValue(100, "Done", "Conversion completed"),
    };
  } catch (error) {
    if (logHandler && typeof ffmpeg.off === "function") ffmpeg.off("log", logHandler);
    revokeObjectUrls();
    return {
      convertOutput  : buildPlaceholderHtml("No converted videos available."),
      convertError   : buildErrorHtml(error),
      convertProgress: buildProgressValue(0, "Failed", "Conversion error"),
    };
  }
}

// Cache the ffmpeg module and instance to avoid repeated wasm initialization.
let FFmpegModule;
let ffmpeg;

// Track object URLs for cleanup between runs.
let outputUrls = [];

// Normalize FilesUploadInput payloads to a stable array.
function normalizeInputFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item instanceof Blob);
  if (value instanceof Blob) return [value];
  return [];
}

// Normalize simple text input values.
function normalizeTargetFormat(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/^\./, "");
  if (!trimmed) return "";
  return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Ensure ffmpeg input names are safe and have extensions.
function ensureInputName(name, index) {
  const safeName = sanitizeFileName(name, `video-${index + 1}.mp4`);
  return safeName.includes(".") ? safeName : `${safeName}.mp4`;
}

// Sanitize file names for ffmpeg virtual FS usage.
function sanitizeFileName(value, fallback) {
  const raw = String(value || "").split(/[\\/]/).pop() || "";
  const cleaned = raw.replace(/\s+/g, " ").replace(/["']/g, "").trim();
  return cleaned || fallback;
}

// Split a filename into base name and extension.
function splitFileName(name) {
  const match = String(name || "").match(/^(.*?)(?:\.([^.]+))?$/);
  if (!match) return { baseName: "output", ext: "" };
  const base = match[1] || "output";
  const ext = match[2] ? `.${match[2]}` : "";
  return { baseName: base, ext };
}

// Build an output file name using the target format.
function resolveOutputName(inputName, name, format, index) {
  const parts = splitFileName(sanitizeFileName(name, `video-${index + 1}`));
  const base = parts.baseName || `video-${index + 1}`;
  const candidate = `${base}.${format}`;
  return candidate === inputName ? `${base}-converted.${format}` : candidate;
}

// Build an idle response when inputs change but conversion is not requested yet.
function buildIdleResponse(fileCount, format, remuxOnly) {
  const suffix = format ? `.${format}` : "...";
  const verb = remuxOnly ? "remux" : "convert";
  const label = fileCount ? `Ready to ${verb} ${fileCount} video(s) to ${suffix}.` : "Upload videos to begin.";
  return {
    convertOutput  : buildPlaceholderHtml(label),
    convertError   : "",
    convertProgress: buildProgressValue(0, "Idle", "Waiting for conversion"),
  };
}

// Build an empty response for the initial load.
function buildEmptyResponse() {
  return {
    convertOutput  : buildPlaceholderHtml("Upload videos to generate previews and downloads."),
    convertError   : "",
    convertProgress: buildProgressValue(0, "Idle", "Waiting for videos"),
  };
}

// Build a response when the target format is missing.
function buildFormatMissingResponse() {
  return {
    convertOutput  : buildPlaceholderHtml("Enter a target format like mp4, mov, webm, or mkv."),
    convertError   : "",
    convertProgress: buildProgressValue(0, "Idle", "Waiting for target format"),
  };
}

// Build the progress bar payload with normalized values.
function buildProgressValue(percent, label, hint) {
  const safePercent = clampPercent(percent);
  return {
    current: safePercent,
    total  : 100,
    percent: safePercent,
    label  : label || "",
    hint   : hint || "",
  };
}

// Clamp a percent value between 0 and 100.
function clampPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

// Spread stages evenly across the progress bar.
function percentForStage(stageIndex, totalStages, localPercent) {
  const span = 100 / Math.max(1, totalStages);
  return Math.min(99.9, stageIndex * span + (span * clampPercent(localPercent)) / 100);
}

// Run a single ffmpeg command while emitting progress updates.
function runCommandWithProgress(ffmpegInstance, args, stageIndex, totalStages, label, hint, callback) {
  return new Promise((resolve, reject) => {
    const update = (localPercent) => {
      const overall = percentForStage(stageIndex, totalStages, localPercent);
      callback({ convertProgress: buildProgressValue(overall, label, hint) });
    };
    update(0);
    const handleProgress = ({ progress }) => {
      const percent = Math.round((progress || 0) * 100);
      update(percent);
    };
    if (typeof ffmpegInstance.on === "function") ffmpegInstance.on("progress", handleProgress);
    ffmpegInstance.exec(args).then(resolve, reject).finally(() => {
      if (typeof ffmpegInstance.off === "function") ffmpegInstance.off("progress", handleProgress);
    });
  });
}

// Build a download entry payload for a converted video.
function buildDownloadEntry(fileName, buffer, format) {
  const mime = inferVideoMime(format);
  return {
    fileName,
    buffer,
    mime,
  };
}

// Build HTML output for all converted entries.
function buildOutputHtml(entries) {
  if (!entries.length) return buildPlaceholderHtml("No converted videos yet.");
  const blocks = entries.map((entry) => buildDownloadBlock(entry)).join("");
  return `<div class="space-y-3">${blocks}</div>`;
}

// Build an HTML placeholder for empty states.
function buildPlaceholderHtml(text) {
  return `<div class="text-sm text-muted-foreground">${escapeHtml(text)}</div>`;
}

// Build a success status message.
function buildStatusHtml(text) {
  if (!text) return "";
  return `<div class="text-sm text-muted-foreground">${escapeHtml(text)}</div>`;
}

// Build an error message with contextual guidance.
function buildErrorHtml(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return `
    <div class="space-y-1 text-sm text-destructive">
      <div class="font-semibold text-destructive">Conversion failed</div>
      <div class="text-muted-foreground">Remuxing can fail when the target container does not support the source codecs.</div>
      <div class="text-muted-foreground break-words">${escapeHtml(message)}</div>
    </div>
  `;
}

// Build a single download block with preview and metadata.
function buildDownloadBlock(entry) {
  const url = buildObjectUrl(entry.buffer, entry.mime);
  const sizeLabel = formatBytes(entry.buffer.length || 0);
  return `
    <div class="flex flex-col gap-2 px-3 py-2 rounded-sm bg-muted/40 border border-border/60">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col min-w-0">
          <div class="text-sm font-semibold text-foreground truncate" title="${escapeHtml(entry.fileName)}">${escapeHtml(entry.fileName)}</div>
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-wide">${escapeHtml(entry.mime)}</span>
            <span>${escapeHtml(sizeLabel)}</span>
          </div>
        </div>
        <a class="text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors whitespace-nowrap" href="${url}" download="${escapeHtml(entry.fileName)}">
          Download
        </a>
      </div>
      <video controls src="${url}" class="w-full max-h-80 bg-black rounded-sm"></video>
    </div>
  `;
}

// Create an object URL and track it for cleanup.
function buildObjectUrl(fileContent, mime) {
  const blob = new Blob([fileContent], { type: mime });
  const url = URL.createObjectURL(blob);
  outputUrls.push(url);
  return url;
}

// Clear previously created object URLs to avoid leaks.
function revokeObjectUrls() {
  if (!outputUrls.length) return;
  outputUrls.forEach((url) => URL.revokeObjectURL(url));
  outputUrls = [];
}

// Infer a reasonable video mime type for previews.
function inferVideoMime(format) {
  const key = String(format || "").toLowerCase();
  if (key === "mp4") return "video/mp4";
  if (key === "webm") return "video/webm";
  if (key === "mov") return "video/quicktime";
  if (key === "mkv") return "video/x-matroska";
  if (key === "avi") return "video/x-msvideo";
  return "application/octet-stream";
}

// Format byte sizes into human-readable labels.
function formatBytes(value) {
  const units = ["B", "KB", "MB", "GB"];
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / Math.pow(1024, index);
  return `${scaled.toFixed(scaled >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

// Escape HTML to avoid injecting unsafe content.
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Create a bounded log buffer for ffmpeg log output.
function createLogBuffer(limit) {
  return {
    limit: Math.max(5, Number(limit) || 0),
    items: [],
  };
}

// Build a log handler that streams ffmpeg log output into the status UI.
function buildLogHandler(logBuffer, callback) {
  return function handleFfmpegLog(event) {
    if (!event) return;
    const type = event.type ? String(event.type) : "";
    const message = event.message ? String(event.message) : "";
    if (!message) return;
    logBuffer.items.push(type ? `[${type}] ${message}` : message);
    if (logBuffer.items.length > logBuffer.limit) logBuffer.items.splice(0, logBuffer.items.length - logBuffer.limit);
    callback({ convertError: buildLogStatusHtml(logBuffer.items) });
  };
}

// Build a streaming log status block for the UI.
function buildLogStatusHtml(lines) {
  if (!lines || !lines.length) return "";
  const content = lines.map((line) => `<div class="font-mono text-[12px]">${escapeHtml(line)}</div>`).join("");
  return `
    <div class="space-y-1 text-sm">
      <div class="font-semibold text-foreground">FFmpeg Log</div>
      <div class="rounded-sm border border-border/60 bg-muted/40 px-3 py-2">${content}</div>
    </div>
  `;
}
