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
  console.log("inputWidgets:", JSON.stringify(inputWidgets));
  console.log("changedWidgetIds:", changedWidgetIds);

  const audioFiles = normalizeInputFiles(inputWidgets.sourceAudios);
  const shouldRun = changedWidgetIds === "applyFilters";
  const filterPlan = buildFilterPlan(inputWidgets);
  const outputFormat = resolveOutputFormat(inputWidgets.outputFormat);

  if (changedWidgetIds && !shouldRun) {
    revokeObjectUrls();
    return buildIdleResponse(audioFiles.length, filterPlan, outputFormat);
  }

  if (!audioFiles.length) {
    revokeObjectUrls();
    return buildEmptyResponse();
  }

  if (!shouldRun) return buildIdleResponse(audioFiles.length, filterPlan, outputFormat);

  if (!FFmpegModule) FFmpegModule = await requirePackage("ffmpeg");
  if (!ffmpeg) {
    ffmpeg = new FFmpegModule.FFmpeg();
    await ffmpeg.load_ffmpeg();
  }

  revokeObjectUrls();
  callback({ applyProgress: buildProgressValue(0, "Starting", "Preparing ffmpeg") });

  console.log("outputFormat:", outputFormat);
  console.log("filterChain:", filterPlan.filters.join(","));

  const logBuffer = createLogBuffer(120);
  const logHandler = buildLogHandler(logBuffer, callback);
  if (typeof ffmpeg.on === "function") ffmpeg.on("log", logHandler);

  const outputs = [];
  const usedNames = Object.create(null);
  const outputCodec = resolveOutputCodec(outputFormat);
  const outputMime = resolveOutputMime(outputFormat);

  for (let index = 0; index < audioFiles.length; index += 1) {
    const file = audioFiles[index];
    const inputName = buildInputName(file.name, index);
    const names = resolveOutputNames(file.name, index, usedNames, outputFormat);
    const stageLabel = `Filtering ${index + 1}/${audioFiles.length}`;

    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    await runCommandWithProgress(
      ffmpeg,
      buildFfmpegArgs(inputName, names.outputName, outputCodec, filterPlan.filters),
      index,
      audioFiles.length,
      stageLabel,
      `Output .${outputFormat}`,
      callback
    );

    const outputBuffer = await ffmpeg.readFile(names.outputName);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(names.outputName);

    outputs.push(buildDownloadEntry(names.downloadName, outputBuffer, outputMime));
  }

  if (typeof ffmpeg.off === "function") ffmpeg.off("log", logHandler);
  return {
    applyOutput  : buildOutputHtml(outputs),
    applyStatus  : buildStatusHtml("Filters applied.", filterPlan, outputFormat),
    applyProgress: buildProgressValue(100, "Done", "Filtering completed"),
    applyLog     : buildLogStatusHtml(logBuffer.items),
  };
}

// Cache ffmpeg module and instance to reduce repeated wasm initialization cost.
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

// Resolve and clamp numeric input values to avoid invalid filter params.
function coerceNumber(value, fallback, min, max) {
  const parsed = typeof value === "number" ? value : Number(value);
  const base = Number.isFinite(parsed) ? parsed : fallback;
  const clippedMin = typeof min === "number" ? Math.max(min, base) : base;
  const clippedMax = typeof max === "number" ? Math.min(max, clippedMin) : clippedMin;
  return clippedMax;
}

// Convert dB values to linear amplitude ratios for ffmpeg filters.
function dbToLinear(dbValue) {
  return Math.pow(10, dbValue / 20);
}

// Clamp numeric values to a safe range.
function clampNumber(value, min, max) {
  const base = Number.isFinite(value) ? value : min;
  const clippedMin = typeof min === "number" ? Math.max(min, base) : base;
  return typeof max === "number" ? Math.min(max, clippedMin) : clippedMin;
}

// Build the ffmpeg filter plan, including conflicts and ordering rules.
function buildFilterPlan(inputWidgets) {
  const warnings = [];
  const filters = [];
  const enabled = {
    compressor: Boolean(inputWidgets.compressorEnabled),
    bass      : Boolean(inputWidgets.bassEnabled),
    treble    : Boolean(inputWidgets.trebleEnabled),
    echo      : Boolean(inputWidgets.echoEnabled),
    loudnorm  : Boolean(inputWidgets.loudnormEnabled),
    dynaudnorm: Boolean(inputWidgets.dynaudnormEnabled),
    volume    : Boolean(inputWidgets.volumeEnabled),
  };

  if (enabled.loudnorm && enabled.dynaudnorm) {
    warnings.push("Loudnorm and Dynaudnorm are mutually exclusive. Dynaudnorm was skipped.");
    enabled.dynaudnorm = false;
  }

  if (enabled.compressor) {
    const thresholdDb = coerceNumber(inputWidgets.compressorThreshold, -18, -60, 0);
    const threshold = clampNumber(dbToLinear(thresholdDb), 0.000976563, 1);
    const ratio = coerceNumber(inputWidgets.compressorRatio, 4, 1, 20);
    const attack = coerceNumber(inputWidgets.compressorAttack, 20, 0.1, 200);
    const release = coerceNumber(inputWidgets.compressorRelease, 250, 1, 1000);
    filters.push(`acompressor=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}`);
  }

  if (enabled.bass) {
    const gain = coerceNumber(inputWidgets.bassGain, 4, -20, 20);
    const freq = coerceNumber(inputWidgets.bassFreq, 100, 20, 200);
    filters.push(`bass=g=${gain}:f=${freq}`);
  }

  if (enabled.treble) {
    const gain = coerceNumber(inputWidgets.trebleGain, 3, -20, 20);
    const freq = coerceNumber(inputWidgets.trebleFreq, 4500, 2000, 12000);
    filters.push(`treble=g=${gain}:f=${freq}`);
  }

  if (enabled.echo) {
    const inGain = coerceNumber(inputWidgets.echoInGain, 0.8, 0, 1);
    const outGain = coerceNumber(inputWidgets.echoOutGain, 0.9, 0, 1);
    const delay = coerceNumber(inputWidgets.echoDelay, 600, 10, 2000);
    const decay = coerceNumber(inputWidgets.echoDecay, 0.4, 0, 1);
    filters.push(`aecho=${inGain}:${outGain}:${delay}:${decay}`);
  }

  if (enabled.loudnorm) {
    const targetI = coerceNumber(inputWidgets.loudnormI, -16, -30, -5);
    const lra = coerceNumber(inputWidgets.loudnormLra, 11, 1, 20);
    const tp = coerceNumber(inputWidgets.loudnormTp, -1.5, -9, 0);
    filters.push(`loudnorm=I=${targetI}:LRA=${lra}:TP=${tp}`);
  }

  if (enabled.dynaudnorm) {
    const frame = coerceNumber(inputWidgets.dynaudnormFrame, 500, 50, 5000);
    const gain = coerceNumber(inputWidgets.dynaudnormGain, 10, 0, 30);
    const peak = coerceNumber(inputWidgets.dynaudnormPeak, 0.95, 0.5, 1);
    filters.push(`dynaudnorm=f=${frame}:g=${gain}:p=${peak}`);
  }

  if (enabled.volume) {
    const gain = coerceNumber(inputWidgets.volumeGain, 0, -20, 20);
    filters.push(`volume=${gain}dB`);
  }

  if (!filters.length) warnings.push("No filters enabled. FFmpeg will only re-encode the audio.");

  return { filters, warnings };
}

// Resolve output format from the select input, defaulting to wav.
function resolveOutputFormat(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "mp3" || normalized === "flac" || normalized === "ogg" || normalized === "wav") return normalized;
  return "wav";
}

// Resolve ffmpeg audio codec based on output format.
function resolveOutputCodec(format) {
  if (format === "mp3") return "libmp3lame";
  if (format === "flac") return "flac";
  if (format === "ogg") return "libvorbis";
  return "pcm_s16le";
}

// Resolve MIME type for downloads.
function resolveOutputMime(format) {
  if (format === "mp3") return "audio/mpeg";
  if (format === "flac") return "audio/flac";
  if (format === "ogg") return "audio/ogg";
  return "audio/wav";
}

// Build the full ffmpeg argument list for a single file.
function buildFfmpegArgs(inputName, outputName, codec, filters) {
  const args = ["-y", "-i", inputName, "-map_metadata", "0", "-map_chapters", "0", "-vn"];
  if (filters && filters.length) args.push("-af", filters.join(","));
  args.push("-c:a", codec, outputName);
  return args;
}

// Build a unique ffmpeg input name for each file.
function buildInputName(name, index) {
  const ext = getFileExtension(name);
  return ext ? `input-${index + 1}.${ext}` : `input-${index + 1}`;
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
  const ext = match[2] ? String(match[2]) : "";
  return { baseName: base, ext };
}

// Resolve internal/output names while keeping user-friendly download labels.
function resolveOutputNames(name, index, usedNames, outputFormat) {
  const downloadName = resolveDownloadName(name, index, usedNames, outputFormat);
  const outputName = `output-${index + 1}.${outputFormat || "wav"}`;
  return { downloadName, outputName };
}

// Resolve the download filename, ensuring uniqueness when duplicates exist.
function resolveDownloadName(name, index, usedNames, outputFormat) {
  const parts = splitFileName(sanitizeFileName(name, `audio-${index + 1}`));
  const base = parts.baseName || `audio-${index + 1}`;
  const ext = outputFormat || "wav";
  let candidate = `${base}-filtered.${ext}`;
  if (!usedNames[candidate]) {
    usedNames[candidate] = 1;
    return candidate;
  }
  let suffix = 2;
  while (usedNames[`${base}-filtered-${suffix}.${ext}`]) suffix += 1;
  candidate = `${base}-filtered-${suffix}.${ext}`;
  usedNames[candidate] = 1;
  return candidate;
}

// Extract a safe file extension for ffmpeg virtual FS usage.
function getFileExtension(value) {
  const match = String(value || "").match(/\.([^.]+)$/);
  const raw = match ? String(match[1]) : "";
  const cleaned = raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return cleaned;
}

// Build an idle response when inputs change but execution is not requested.
function buildIdleResponse(fileCount, filterPlan, outputFormat) {
  const label = fileCount
    ? `Ready to apply filters to ${fileCount} file(s).`
    : "Upload audio files to begin.";
  return {
    applyOutput  : buildPlaceholderHtml("No filtered audio yet."),
    applyStatus  : buildStatusHtml(label, filterPlan, outputFormat),
    applyProgress: buildProgressValue(0, "Idle", "Waiting for execution"),
    applyLog     : "",
  };
}

// Build an empty response for the initial load.
function buildEmptyResponse() {
  return {
    applyOutput  : buildPlaceholderHtml("Upload audio files and choose filters to start."),
    applyStatus  : buildPlaceholderHtml("Waiting for inputs."),
    applyProgress: buildProgressValue(0, "Idle", "Waiting for audio"),
    applyLog     : "",
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
      callback({ applyProgress: buildProgressValue(overall, label, hint) });
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

// Build a download entry payload for a filtered audio file.
function buildDownloadEntry(fileName, buffer, mime) {
  return {
    fileName,
    buffer,
    mime,
  };
}

// Build HTML output for all filtered entries.
function buildOutputHtml(entries) {
  if (!entries.length) return buildPlaceholderHtml("No filtered audio yet.");
  const blocks = entries.map((entry) => buildDownloadBlock(entry)).join("");
  return `
    <div class="space-y-3" data-download-container="true">
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">Filtered files</span>
        <a
          class="text-sm font-semibold text-primary underline underline-offset-2"
          href="#"
          onclick="(function(el){var root=el.closest(&quot;[data-download-container]&quot;);if(!root)return false;var links=root.querySelectorAll(&quot;a[data-download-file]&quot;);links.forEach(function(link,index){setTimeout(function(){link.click();},index*150);});return false;})(this)"
        >
          Download All
        </a>
      </div>
      ${blocks}
    </div>
  `;
}

// Build an HTML placeholder for empty states.
function buildPlaceholderHtml(text) {
  return `<div class="text-sm text-muted-foreground">${escapeHtml(text)}</div>`;
}

// Build a status message with warnings and filter chain details.
function buildStatusHtml(message, filterPlan, outputFormat) {
  const warnings = filterPlan?.warnings || [];
  const filters = filterPlan?.filters || [];
  const warningBlock = warnings.length
    ? `<ul class="list-disc pl-4 space-y-1 text-sm text-yellow-600">${warnings
      .map((warning) => `<li>${escapeHtml(warning)}</li>`)
      .join("")}</ul>`
    : "";
  const filterBlock = filters.length
    ? `<div class="text-sm text-muted-foreground">Filters: <code class="rounded bg-muted px-1 py-0.5 text-[12px] font-mono">${escapeHtml(
      filters.join(",")
    )}</code></div>`
    : "";
  const formatBlock = outputFormat
    ? `<div class="text-sm text-muted-foreground">Output: <span class="font-medium text-foreground">.${escapeHtml(
      outputFormat
    )}</span></div>`
    : "";
  return `
    <div class="space-y-2">
      <div class="text-sm font-semibold text-foreground">${escapeHtml(message)}</div>
      ${formatBlock}
      ${filterBlock}
      ${warningBlock}
    </div>
  `;
}

// Create a bounded log buffer for ffmpeg log output.
function createLogBuffer(limit) {
  return {
    limit: Math.max(5, Number(limit) || 0),
    items: [],
  };
}

// Build a log handler that streams ffmpeg log output into the log UI.
function buildLogHandler(logBuffer, callback) {
  return function handleFfmpegLog(event) {
    if (!event) return;
    const type = event.type ? String(event.type) : "";
    const message = event.message ? String(event.message) : "";
    if (!message) return;
    logBuffer.items.push(type ? `[${type}] ${message}` : message);
    if (logBuffer.items.length > logBuffer.limit) logBuffer.items.splice(0, logBuffer.items.length - logBuffer.limit);
    callback({ applyLog: buildLogStatusHtml(logBuffer.items) });
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

// Build a single download block with preview and metadata.
function buildDownloadBlock(entry) {
  const url = buildObjectUrl(entry.buffer, entry.mime);
  const sizeLabel = formatBytes(entry.buffer.length || 0);
  return `
    <div class="flex flex-col gap-2 px-3 py-2 rounded-sm bg-muted/40 border border-border/60">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col min-w-0">
          <div class="text-sm font-semibold text-foreground truncate" title="${escapeHtml(entry.fileName)}">${escapeHtml(
            entry.fileName
          )}</div>
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-wide">${escapeHtml(
              entry.mime
            )}</span>
            <span>${escapeHtml(sizeLabel)}</span>
          </div>
        </div>
        <a class="text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors whitespace-nowrap" href="${url}" download="${escapeHtml(
          entry.fileName
        )}" data-download-file="true">
          Download
        </a>
      </div>
      <audio controls src="${url}" class="w-full"></audio>
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
