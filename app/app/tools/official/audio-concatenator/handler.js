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
  const audioFiles = normalizeInputFiles(inputWidgets.sourceAudios);
  const gapMs = normalizeGapMs(inputWidgets.gapMs);
  const orderValue = normalizeOrderValue(inputWidgets.audioOrder);
  const outputNameInput = normalizeText(inputWidgets.outputFileName);
  const orderSync = syncOrderSelection(audioFiles, orderValue);
  const orderedFiles = resolveOrderedFiles(audioFiles, orderSync.orderedIds);
  const baseResponse = buildBaseResponse(audioFiles.length);

  if (orderSync.shouldUpdate) baseResponse.audioOrder = orderSync.nextValue;
  if (changedWidgetIds && changedWidgetIds !== "concatTrigger") revokeObjectUrls();
  if (!audioFiles.length) {
    revokeObjectUrls();
    return baseResponse;
  }

  const formatCheck = validateAudioFormats(audioFiles);
  if (!formatCheck.ok) {
    console.log("[audio-concatenator] Format mismatch", formatCheck);
    return {
      ...baseResponse,
      concatStatus  : buildErrorHtml(formatCheck.message),
      concatProgress: buildProgressValue(0, "Idle", "Fix input formats"),
      concatOutput  : buildPlaceholderHtml("No output generated."),
    };
  }

  const orderedList = orderedFiles.length ? orderedFiles : audioFiles;
  const outputName = buildOutputName(orderedList[0]?.name, formatCheck.extension, outputNameInput);
  console.log("[audio-concatenator] Inputs", {
    count: audioFiles.length,
    gapMs,
    outputName,
    order: orderedList.map((file) => file.name),
  });

  const resolvedOutputName = ensureOutputExtension(outputName, formatCheck.extension);
  const idleResponse = {
    ...baseResponse,
    concatStatus  : buildStatusHtml(`Ready to merge ${audioFiles.length} file(s).`),
    concatProgress: buildProgressValue(0, "Idle", "Click Merge Now to start"),
  };
  if (outputNameInput && outputNameInput !== resolvedOutputName) idleResponse.outputFileName = resolvedOutputName;

  if (changedWidgetIds !== "concatTrigger") return idleResponse;
  if (audioFiles.length < 2) {
    return {
      ...idleResponse,
      concatStatus: buildErrorHtml("Select at least two audio files to concatenate."),
    };
  }

  if (!FFmpegModule) FFmpegModule = await requirePackage("ffmpeg");
  if (!ffmpeg) {
    ffmpeg = new FFmpegModule.FFmpeg();
    await ffmpeg.load_ffmpeg();
  }

  revokeObjectUrls();
  callback({
    concatProgress: buildProgressValue(0, "Starting", "Preparing ffmpeg"),
    concatStatus  : buildStatusHtml("Preparing inputs..."),
  });

  const inputEntries = orderedList.map((file, index) => ({
    file,
    name: buildInputName(file.name, index),
  }));

  await stageInputFiles(ffmpeg, inputEntries);
  const audioFormat = await probeAudioFormat(ffmpeg, inputEntries[0].name);
  const gapSeconds = gapMs / 1000;
  const filterInfo = buildConcatFilter(inputEntries.length, audioFormat, gapSeconds);
  const args = buildFfmpegArgs(inputEntries, filterInfo, resolvedOutputName, formatCheck.extension, audioFormat);

  console.log("[audio-concatenator] Using filter_complex concat to avoid stream copy mismatch", {
    audioFormat,
    gapSeconds,
    args,
  });

  await runCommandWithProgress(ffmpeg, args, "Concatenating", "Merging audio tracks", callback);

  console.log("[audio-concatenator] Reading output", { outputName: resolvedOutputName });
  const outputBuffer = await ffmpeg.readFile(resolvedOutputName);
  console.log("[audio-concatenator] Output ready", { size: outputBuffer.length || 0 });
  await cleanupStagedFiles(ffmpeg, [...inputEntries, { name: resolvedOutputName }]);

  return {
    ...idleResponse,
    concatStatus  : buildStatusHtml("Concatenation complete."),
    concatProgress: buildProgressValue(100, "Done", "Merge finished"),
    concatOutput  : buildOutputHtml(resolvedOutputName, outputBuffer, formatCheck.mime),
  };
}

// Cache the ffmpeg module and instance to avoid repeated wasm initialization.
let FFmpegModule;
let ffmpeg;
// Track created object URLs for cleanup between runs.
let outputUrls = [];

// Normalize FilesUploadInput payloads to a stable array.
function normalizeInputFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item instanceof Blob);
  if (value instanceof Blob) return [value];
  return [];
}

// Normalize SortableListInput payloads to a list of value strings.
function normalizeOrderValue(value) {
  if (!value || !Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.value))
    .filter((item) => typeof item === "string" && item.trim());
}

// Normalize simple text input values.
function normalizeText(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
}

// Normalize the silence gap input into a non-negative number.
function normalizeGapMs(value) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) return 0;
  return Math.max(0, Math.round(num));
}

// Sync the sortable list with the latest files while preserving user order.
function syncOrderSelection(files, orderValue) {
  const fileMap = new Map();
  const fileIds = files.map((file) => {
    const id = buildFileId(file);
    fileMap.set(id, file);
    return id;
  });

  const nextIds = [];
  orderValue.forEach((id) => {
    if (fileMap.has(id)) nextIds.push(id);
  });

  fileIds.forEach((id) => {
    if (!nextIds.includes(id)) nextIds.push(id);
  });

  const nextValue = nextIds.map((id) => ({ value: id, label: fileMap.get(id)?.name || id }));
  const shouldUpdate = nextIds.length !== orderValue.length || nextIds.some((id, index) => id !== orderValue[index]);

  return { orderedIds: nextIds, nextValue, shouldUpdate };
}

// Resolve the ordered file list based on the sortable list values.
function resolveOrderedFiles(files, orderedIds) {
  if (!orderedIds.length) return [];
  const fileMap = new Map(files.map((file) => [buildFileId(file), file]));
  return orderedIds.map((id) => fileMap.get(id)).filter(Boolean);
}

// Build a unique id for each file to keep ordering stable.
function buildFileId(file) {
  return `${file?.name || "file"}-${file?.size || 0}-${file?.lastModified || 0}`;
}

// Validate that all files are audio and share the same extension.
function validateAudioFormats(files) {
  if (!files.length) return { ok: false, message: "No audio files selected." };
  const first = files[0];
  if (!isAudioFile(first)) {
    return { ok: false, message: `Unsupported file detected: ${first?.name || "Unknown"}.` };
  }
  const firstExt = resolveFileExtension(first);
  const firstMime = resolveFileMime(first);
  const firstKey = resolveFormatKey(first);
  for (const file of files.slice(1)) {
    if (!isAudioFile(file)) {
      return { ok: false, message: `Unsupported file detected: ${file?.name || "Unknown"}.` };
    }
    const nextKey = resolveFormatKey(file);
    if (firstKey && nextKey && nextKey !== firstKey) {
      return {
        ok     : false,
        message: `All files must share the same format. Found ${firstKey} and ${nextKey}.`,
      };
    }
  }
  const extension = firstExt || resolveMimeExtension(firstMime) || "wav";
  return {
    ok  : true,
    extension,
    mime: firstMime || resolveMimeFromExtension(extension) || "audio/mpeg",
  };
}

// Resolve the file extension from the file name.
function resolveFileExtension(file) {
  const name = String(file?.name || "").toLowerCase();
  if (!name.includes(".")) return "";
  return name.split(".").pop() || "";
}

// Resolve the mime type string from a file.
function resolveFileMime(file) {
  const mime = String(file?.type || "").toLowerCase();
  return mime || "";
}

// Resolve a format key for comparison across files.
function resolveFormatKey(file) {
  const ext = resolveFileExtension(file);
  if (ext) return `.${ext}`;
  const mime = resolveFileMime(file);
  if (mime) return mime;
  return "";
}

// Check whether a file should be treated as audio.
function isAudioFile(file) {
  const mime = resolveFileMime(file);
  if (mime.startsWith("audio/")) return true;
  const ext = resolveFileExtension(file);
  return ["mp3", "m4a", "aac", "flac", "wav", "ogg", "opus", "wma", "alac", "tta", "pcm"].includes(ext);
}

// Build a safe input file name for ffmpeg's virtual FS.
function buildInputName(name, index) {
  const safeName = sanitizeFileName(name, `audio-${index + 1}`);
  return `input-${index + 1}-${safeName}`;
}

// Build the output file name based on the first file and extension.
function buildOutputName(name, extension, customName) {
  const customValue = sanitizeFileName(customName, "");
  if (customValue) return ensureOutputExtension(customValue, extension);
  const parts = splitFileName(sanitizeFileName(name, "audio"));
  const ext = extension ? `.${extension}` : parts.ext || ".wav";
  const base = parts.baseName || "audio";
  if (base.endsWith("-merged")) return `${base}${ext}`;
  return `${base}-merged${ext}`;
}

// Split filenames into base name and extension.
function splitFileName(name) {
  const match = String(name || "").match(/^(.*?)(?:\.([^.]+))?$/);
  if (!match) return { baseName: "output", ext: "" };
  const base = match[1] || "output";
  const ext = match[2] ? `.${match[2]}` : "";
  return { baseName: base, ext };
}

// Sanitize file names for ffmpeg virtual FS usage.
function sanitizeFileName(value, fallback) {
  const raw = String(value || "").split(/[\\/]/).pop() || "";
  const cleaned = raw.replace(/\s+/g, " ").replace(/["']/g, "").trim();
  return cleaned || fallback;
}

// Ensure the output file name carries the selected extension.
function ensureOutputExtension(name, extension) {
  const safe = sanitizeFileName(name, "audio-merged");
  if (!extension) return safe;
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return safe.toLowerCase().endsWith(ext.toLowerCase()) ? safe : `${safe}${ext}`;
}

// Prepare all files in ffmpeg's in-memory filesystem.
async function stageInputFiles(ffmpegInstance, entries) {
  for (const entry of entries) {
    console.log("[audio-concatenator] Writing input", { name: entry.name, size: entry.file?.size });
    await ffmpegInstance.writeFile(entry.name, new Uint8Array(await entry.file.arrayBuffer()));
  }
}

// Remove staged files after ffmpeg execution.
async function cleanupStagedFiles(ffmpegInstance, entries) {
  for (const entry of entries) {
    if (!entry?.name) continue;
    console.log("[audio-concatenator] Deleting file", { name: entry.name });
    await ffmpegInstance.deleteFile(entry.name);
  }
}

// Probe the first audio file to capture sample rate and channel layout.
async function probeAudioFormat(ffmpegInstance, inputName) {
  const probeOutput = "ffprobe-audio.json";
  console.log("[audio-concatenator] ffprobe start", { inputName });
  await ffmpegInstance.ffprobe([
    "-print_format",
    "json",
    "-show_streams",
    "-select_streams",
    "a:0",
    "-i",
    inputName,
    "-o",
    probeOutput,
  ]);
  const outputBuffer = await ffmpegInstance.readFile(probeOutput);
  await ffmpegInstance.deleteFile(probeOutput);
  const probeData = parseProbeJson(outputBuffer);
  const stream = Array.isArray(probeData.streams) ? probeData.streams[0] : undefined;
  const sampleRate = Number(stream?.sample_rate) || 44100;
  const channels = Number(stream?.channels) || 2;
  const channelLayout = stream?.channel_layout || (channels === 1 ? "mono" : "stereo");
  const bitRate = normalizeBitRate(stream?.bit_rate);
  console.log("[audio-concatenator] ffprobe format", { sampleRate, channels, channelLayout, bitRate });
  return { sampleRate, channelLayout, bitRate };
}

// Normalize ffprobe bitrate into a positive integer or null.
function normalizeBitRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

// Parse ffprobe JSON output into a usable object.
function parseProbeJson(buffer) {
  const text = new TextDecoder("utf-8").decode(buffer);
  return JSON.parse(text || "{}");
}

// Build the filter_complex concat graph with optional silence segments.
function buildConcatFilter(fileCount, audioFormat, gapSeconds) {
  const { sampleRate, channelLayout } = audioFormat;
  const nodes = [];
  const inputs = [];
  for (let i = 0; i < fileCount; i += 1) {
    nodes.push(`[${i}:a]aformat=sample_rates=${sampleRate}:channel_layouts=${channelLayout}[a${i}]`);
    inputs.push(`[a${i}]`);
    if (gapSeconds > 0 && i < fileCount - 1) {
      nodes.push(`anullsrc=channel_layout=${channelLayout}:sample_rate=${sampleRate}:d=${gapSeconds}[s${i}]`);
      inputs.push(`[s${i}]`);
    }
  }
  const concatCount = inputs.length;
  nodes.push(`${inputs.join("")}concat=n=${concatCount}:v=0:a=1[outa]`);
  return { filterGraph: nodes.join(";"), outputLabel: "[outa]" };
}

// Build the full ffmpeg args for filter_complex concat output.
function buildFfmpegArgs(entries, filterInfo, outputName, extension, audioFormat) {
  const args = ["-y"];
  entries.forEach((entry) => args.push("-i", entry.name));
  args.push("-filter_complex", filterInfo.filterGraph, "-map", filterInfo.outputLabel);
  const codec = resolveEncoderForExtension(extension);
  if (codec) args.push("-c:a", codec);
  const targetBitRate = resolveTargetBitRate(audioFormat, extension);
  if (targetBitRate) args.push("-b:a", `${Math.round(targetBitRate / 1000)}k`);
  args.push(outputName);
  return args;
}

// Resolve the target bitrate for lossy encoders based on the first input file.
function resolveTargetBitRate(audioFormat, extension) {
  if (!audioFormat?.bitRate || !isLossyExtension(extension)) return null;
  return audioFormat.bitRate;
}

// Check whether the output extension is lossy.
function isLossyExtension(extension) {
  const ext = String(extension || "").toLowerCase();
  return ["mp3", "m4a", "aac", "ogg", "opus", "wma"].includes(ext);
}

// Resolve an encoder based on the output extension.
function resolveEncoderForExtension(extension) {
  const ext = String(extension || "").toLowerCase();
  if (ext === "flac") return "flac";
  if (ext === "wav") return "pcm_s16le";
  if (ext === "mp3") return "libmp3lame";
  if (ext === "m4a" || ext === "aac") return "aac";
  if (ext === "ogg") return "libvorbis";
  if (ext === "opus") return "libopus";
  return "";
}

// Resolve extension from MIME when the name is missing.
function resolveMimeExtension(mime) {
  const cleaned = String(mime || "").toLowerCase();
  if (!cleaned.includes("/")) return "";
  return cleaned.split("/")[1] || "";
}

// Resolve a likely MIME type from an extension.
function resolveMimeFromExtension(extension) {
  const ext = String(extension || "").toLowerCase();
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  if (ext === "flac") return "audio/flac";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "opus") return "audio/opus";
  if (ext === "wma") return "audio/x-ms-wma";
  if (ext === "alac") return "audio/alac";
  if (ext === "tta") return "audio/x-tta";
  return "";
}

// Run ffmpeg with progress callbacks to keep UI responsive.
function runCommandWithProgress(ffmpegInstance, args, label, hint, callback) {
  return new Promise((resolve, reject) => {
    callback({ concatProgress: buildProgressValue(0, label, hint) });
    function handleProgress({ progress, time }) {
      const percent = Math.min(100, Math.max(0, Math.round((progress || 0) * 100)));
      const seconds = Number.isFinite(time) ? (time / 1000000).toFixed(2) : "0.00";
      // Stream ffmpeg progress into the log panel for debugging longer merges.
      console.log(`[audio-concatenator] ${percent} % (transcoded time: ${seconds} s)`);
      callback({ concatProgress: buildProgressValue(percent, label, hint) });
    }
    if (typeof ffmpegInstance.on === "function") ffmpegInstance.on("progress", handleProgress);
    console.log("[audio-concatenator] ffmpeg exec", { args });
    ffmpegInstance.exec(args).then(resolve, reject).finally(() => {
      if (typeof ffmpegInstance.off === "function") ffmpegInstance.off("progress", handleProgress);
    });
  });
}

// Build an HTML placeholder for empty states.
function buildPlaceholderHtml(text) {
  return `<div class="text-sm text-muted-foreground">${escapeHtml(text)}</div>`;
}

// Build a status line in the output panel.
function buildStatusHtml(text) {
  if (!text) return "";
  return `<div class="text-sm text-muted-foreground">${escapeHtml(text)}</div>`;
}

// Build an error status line with emphasis.
function buildErrorHtml(text) {
  if (!text) return "";
  return `<div class="text-sm text-destructive">${escapeHtml(text)}</div>`;
}

// Build the initial output response shape.
function buildBaseResponse(fileCount) {
  const idleText = fileCount ? `Ready to merge ${fileCount} file(s).` : "Upload audio files to begin.";
  return {
    concatProgress: buildProgressValue(0, "Idle", "Waiting for input"),
    concatStatus  : buildStatusHtml(idleText),
    concatOutput  : buildPlaceholderHtml("Merged output will appear here."),
  };
}

// Build a basic ProgressBarInput payload.
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

// Build the merged output HTML with download and preview.
function buildOutputHtml(fileName, buffer, mime) {
  const outputMime = mime || "audio/mpeg";
  const url = buildObjectUrl(buffer, outputMime);
  const sizeLabel = formatBytes(buffer.length || 0);
  return `
    <div class="flex flex-col gap-2">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col min-w-0">
          <div class="text-sm font-semibold text-foreground truncate" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-wide">${escapeHtml(outputMime)}</span>
            <span>${escapeHtml(sizeLabel)}</span>
          </div>
        </div>
        <a class="text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors whitespace-nowrap" href="${url}" download="${escapeHtml(fileName)}">
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
