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
  if (!FFmpegModule) FFmpegModule = await requirePackage("ffmpeg");
  if (!ffmpeg) {
    ffmpeg = new FFmpegModule.FFmpeg();
    await ffmpeg.load_ffmpeg();
  }

  // Emit ffmpeg log output for debugging FFmpeg FS errors.
  if (!logListenerAttached && typeof ffmpeg.on === "function") {
    ffmpeg.on("log", handleFfmpegLog);
    logListenerAttached = true;
  }

  const videoFile = normalizeInputFile(inputWidgets.sourceVideo);
  const audioFiles = normalizeInputFiles(inputWidgets.extraAudio);
  const subtitleFiles = normalizeInputFiles(inputWidgets.extraSubtitles);
  const attachmentFiles = normalizeInputFiles(inputWidgets.extraAttachments);
  const outputNameInput = normalizeText(inputWidgets.outputFileName);
  const commandInput = normalizeText(inputWidgets.ffmpegCommand);

  if (!videoFile) {
    return {
      trackSummary  : buildIdleSummaryHtml(),
      outputFileName: "",
      ffmpegCommand : "",
      mergeProgress : buildProgressValue(0, "Idle", "Upload a video to begin"),
      mergeOutput   : buildEmptyOutputHtml("Awaiting input"),
    };
  }

  const videoInputName = ensureInputName(videoFile.name);
  const audioSelection = classifyFiles(audioFiles, "audio");
  const subtitleSelection = classifyFiles(subtitleFiles, "subtitle");
  const attachmentSelection = classifyFiles(attachmentFiles, "attachment");

  const audioEntries = buildInputEntries(audioSelection.valid, "audio");
  const subtitleEntries = buildInputEntries(subtitleSelection.valid, "subtitle");
  const attachmentEntries = buildInputEntries(attachmentSelection.valid, "attachment");
  const sanitizedOutputInput = sanitizeFileName(outputNameInput, "");
  const outputFileName = ensureOutputFileName(sanitizedOutputInput, videoFile.name);

  const mergePlan = buildMergePlan(videoInputName, audioEntries, subtitleEntries, attachmentEntries, outputFileName);
  const autoCommand = buildCommandString(mergePlan.args);
  const fileInputsChanged = ["sourceVideo", "extraAudio", "extraSubtitles", "extraAttachments"].includes(
    changedWidgetIds
  );
  const shouldUseAutoCommand = fileInputsChanged || lastCommandWasAuto || !commandInput;
  const commandValue = shouldUseAutoCommand ? autoCommand : commandInput;

  // Skip ffprobe and merge preparation when only the command textarea changes.
  if (changedWidgetIds === "ffmpegCommand") {
    if (!commandInput) {
      lastCommandWasAuto = true;
      return { ffmpegCommand: autoCommand };
    }
    lastCommandWasAuto = false;
    return {};
  }

  console.log("[video-track-merger] Inputs", {
    video      : buildFileDebugInfo(videoFile, videoInputName),
    audio      : audioEntries.map(buildEntryDebugInfo),
    subtitles  : subtitleEntries.map(buildEntryDebugInfo),
    attachments: attachmentEntries.map(buildEntryDebugInfo),
    outputFileName,
  });

  const execArgsForSummary = shouldUseAutoCommand
    ? mergePlan.args
    : parseCommandArgs(normalizeCommandForExec(commandValue));
  const summaryOutputName = shouldUseAutoCommand
    ? outputFileName
    : resolveOutputFileNameFromArgs(execArgsForSummary, outputFileName);

  const probeData = await inspectVideo(ffmpeg, videoFile, videoInputName);
  const trackSummaryHtml = buildTrackSummaryHtml(
    videoFile,
    probeData,
    audioSelection,
    subtitleSelection,
    attachmentSelection,
    summaryOutputName
  );

  const response = {
    trackSummary : trackSummaryHtml,
    mergeProgress: buildProgressValue(0, "Idle", "Click Merge Now to start"),
    mergeOutput  : buildEmptyOutputHtml("Ready to merge"),
  };

  if (shouldUseAutoCommand) {
    response.ffmpegCommand = autoCommand;
    lastCommandWasAuto = true;
  }
  if (!sanitizedOutputInput || outputFileName !== sanitizedOutputInput) {
    response.outputFileName = outputFileName;
  }

  if (changedWidgetIds !== "mergeTrigger") return response;

  // Use the auto-generated args when the command is untouched to avoid whitespace parsing issues.
  const execArgs = shouldUseAutoCommand
    ? mergePlan.args
    : parseCommandArgs(normalizeCommandForExec(commandValue));
  console.log("[video-track-merger] Command", {
    source: shouldUseAutoCommand ? "auto" : "custom",
    commandValue,
    execArgs,
  });
  if (!execArgs.length) {
    return {
      ...response,
      mergeProgress: buildProgressValue(0, "Idle", "Provide a valid ffmpeg command"),
    };
  }

  const outputNameFromArgs = shouldUseAutoCommand
    ? outputFileName
    : resolveOutputFileNameFromArgs(execArgs, outputFileName);
  console.log("[video-track-merger] Output target", { outputNameFromArgs });
  await stageInputFiles(ffmpeg, [
    { file: videoFile, name: videoInputName },
    ...audioEntries,
    ...subtitleEntries,
    ...attachmentEntries,
  ]);

  await runCommandWithProgress(ffmpeg, execArgs, "Merging", "Muxing tracks into the output", callback);

  console.log("[video-track-merger] Reading output", { outputNameFromArgs });
  const outputBuffer = await ffmpeg.readFile(outputNameFromArgs);
  console.log("[video-track-merger] Output ready", { size: outputBuffer.length || 0 });
  await cleanupStagedFiles(ffmpeg, [
    { name: videoInputName },
    ...audioEntries,
    ...subtitleEntries,
    ...attachmentEntries,
    { name: outputNameFromArgs },
  ]);

  return {
    ...response,
    mergeProgress: buildProgressValue(100, "Completed", "Merge finished successfully"),
    mergeOutput  : buildMergedOutputHtml(outputNameFromArgs, outputBuffer),
  };
}

// Cache the ffmpeg module and instance to avoid repeated wasm initialization.
let FFmpegModule;
let ffmpeg;
// Track whether the command textarea is still auto-managed.
let lastCommandWasAuto = true;
let logListenerAttached = false;

// Normalize FileUploadInput payloads to a single Blob or null.
function normalizeInputFile(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  if (value instanceof Blob) return value;
  return null;
}

// Normalize FilesUploadInput payloads to a stable array.
function normalizeInputFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item instanceof Blob);
  return [];
}

// Normalize simple text input values.
function normalizeText(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
}

// Ensure ffmpeg input names are safe and have extensions.
function ensureInputName(name) {
  const safe = sanitizeFileName(name, "input-video.mp4");
  return safe.includes(".") ? safe : `${safe}.mp4`;
}

// Ensure the output file name is derived from the source when empty.
function ensureOutputFileName(value, sourceName) {
  const safeValue = sanitizeFileName(value, "");
  if (safeValue) {
    if (safeValue.includes(".")) return safeValue;
    const fallbackExt = splitFileName(sourceName).ext || ".mp4";
    return `${safeValue}${fallbackExt}`;
  }
  const nameInfo = splitFileName(sourceName);
  const ext = nameInfo.ext || ".mp4";
  if (nameInfo.baseName.endsWith("-merged")) return `${nameInfo.baseName}${ext}`;
  return `${nameInfo.baseName}-merged${ext}`;
}

// Sanitize file names for ffmpeg virtual FS usage.
function sanitizeFileName(value, fallback) {
  const raw = String(value || "").split(/[\\/]/).pop() || "";
  const cleaned = raw.replace(/\s+/g, " ").replace(/["']/g, "").trim();
  return cleaned || fallback;
}

// Build input entries with stable names for command generation.
function buildInputEntries(files, prefix) {
  if (!Array.isArray(files)) return [];
  return files.map((file, index) => {
    const safeName = sanitizeFileName(file.name, `${prefix}-${index + 1}.bin`);
    return {
      file,
      name        : `${prefix}-${index + 1}-${safeName}`,
      mime        : file.type || "",
      originalName: safeName,
    };
  });
}

// Inspect a video via ffprobe and return the parsed JSON payload.
async function inspectVideo(ffmpegInstance, videoFile, inputName) {
  const probeOutput = "ffprobe-output.json";
  console.log("[video-track-merger] ffprobe stage", { inputName, probeOutput });
  await ffmpegInstance.writeFile(inputName, new Uint8Array(await videoFile.arrayBuffer()));
  await ffmpegInstance.ffprobe([
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    "-i",
    inputName,
    "-o",
    probeOutput,
  ]);
  const outputBuffer = await ffmpegInstance.readFile(probeOutput);
  console.log("[video-track-merger] ffprobe done", { outputSize: outputBuffer.length || 0 });
  await ffmpegInstance.deleteFile(inputName);
  await ffmpegInstance.deleteFile(probeOutput);
  return parseProbeJson(outputBuffer);
}

// Parse ffprobe JSON output into a usable object.
function parseProbeJson(buffer) {
  const text = new TextDecoder("utf-8").decode(buffer);
  return JSON.parse(text || "{}");
}

// Collect valid and invalid files for each input category.
function classifyFiles(files, kind) {
  const valid = [];
  const invalid = [];
  for (const file of files || []) {
    if (isFileKind(file, kind)) valid.push(file);
    else invalid.push(file);
  }
  return { valid, invalid };
}

// Detect file kinds based on MIME type and extension.
function isFileKind(file, kind) {
  const name = String(file?.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const mime = String(file?.type || "").toLowerCase();
  if (kind === "audio") return mime.startsWith("audio/") || isAudioExtension(ext);
  if (kind === "subtitle") return isSubtitleExtension(ext) || mime.includes("subtitle") || mime.includes("subrip");
  if (kind === "attachment") return isAttachmentExtension(ext) || mime.startsWith("font/") || mime.startsWith("image/");
  return false;
}

// Check audio extensions when MIME is unavailable.
function isAudioExtension(ext) {
  return ["mp3", "m4a", "aac", "flac", "wav", "ogg", "opus", "ac3", "eac3"].includes(ext);
}

// Check subtitle extensions when MIME is unavailable.
function isSubtitleExtension(ext) {
  return ["srt", "vtt", "ass", "ssa", "sub", "ttml", "dfxp"].includes(ext);
}

// Check attachment extensions when MIME is unavailable.
function isAttachmentExtension(ext) {
  return ["ttf", "otf", "woff", "woff2", "png", "jpg", "jpeg"].includes(ext);
}

// Build an auto-generated ffmpeg plan that keeps all source tracks.
function buildMergePlan(videoInputName, audioEntries, subtitleEntries, attachmentEntries, outputFileName) {
  const args = ["-y", "-i", videoInputName];
  audioEntries.forEach((entry) => args.push("-i", entry.name));
  subtitleEntries.forEach((entry) => args.push("-i", entry.name));

  args.push("-map", "0");
  audioEntries.forEach((entry, index) => args.push("-map", `${index + 1}:0`));
  subtitleEntries.forEach((entry, index) => args.push("-map", `${index + 1 + audioEntries.length}:0`));

  attachmentEntries.forEach((entry, index) => {
    args.push("-attach", entry.name);
    const mime = entry.mime || guessAttachmentMime(entry.name);
    if (mime) args.push(`-metadata:s:t:${index}`, `mimetype=${mime}`);
    if (entry.originalName) args.push(`-metadata:s:t:${index}`, `filename=${entry.originalName}`);
  });

  args.push("-c", "copy", outputFileName);
  return { args };
}

// Guess attachment MIME types from file extensions.
function guessAttachmentMime(name) {
  const ext = String(name || "").toLowerCase().split(".").pop();
  if (ext === "ttf") return "font/ttf";
  if (ext === "otf") return "font/otf";
  if (ext === "woff") return "font/woff";
  if (ext === "woff2") return "font/woff2";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "";
}

// Convert a command arg list into a multi-line command string (flag/value pairs per line).
function buildCommandString(args) {
  const lines = formatCommandLines(args);
  return ["ffmpeg", ...lines].join("\n");
}

// Build a single-line command string for execution logs.
function buildExecCommandString(args) {
  const segments = ["ffmpeg", ...args.map((arg) => quoteArg(arg))];
  return segments.join(" ");
}

// Quote arguments for display in the command textarea.
function quoteArg(value) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (!/[\\s"]/u.test(text)) return text;
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

// Group flags with their values so each line stays readable.
function formatCommandLines(args) {
  const lines = [];
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    const next = args[i + 1];
    if (current.startsWith("-") && next && !next.startsWith("-")) {
      lines.push(`${current} ${quoteArg(next)}`);
      i += 1;
      continue;
    }
    lines.push(quoteArg(current));
  }
  return lines;
}

// Normalize multiline command text before parsing for execution.
function normalizeCommandForExec(value) {
  if (!value) return "";
  return String(value).replace(/\s*\n\s*/g, " ").trim();
}

// Build the summary card with track counts and validation warnings.
function buildTrackSummaryHtml(videoFile, probeData, audioSelection, subtitleSelection, attachmentSelection, outputName) {
  const streams = extractStreams(probeData);
  const videoCount = streams.filter((stream) => stream.codec_type === "video").length;
  const audioCount = streams.filter((stream) => stream.codec_type === "audio").length;
  const subtitleCount = streams.filter((stream) => stream.codec_type === "subtitle").length;
  const attachmentCount = streams.filter((stream) => stream.codec_type === "attachment").length;
  const dataCount = streams.filter((stream) => stream.codec_type === "data").length;
  const warningLines = buildWarningLines(audioSelection, subtitleSelection, attachmentSelection, outputName);
  const warningsHtml = warningLines.length ? buildWarningHtml(warningLines) : "";
  const outputExt = splitFileName(outputName).ext || ".mp4";

  return `
    <div class="space-y-2">
      <div class="rounded-sm border border-border/60 bg-muted/30 px-3 py-2">
        <div class="text-sm font-semibold text-foreground">Source track overview</div>
        <div class="mt-1 text-xs text-muted-foreground">
          ${escapeHtml(videoFile.name || "Untitled")} | ${videoCount} video / ${audioCount} audio / ${subtitleCount} subtitles / ${attachmentCount} attachments / ${dataCount} data
        </div>
        <div class="mt-2 text-xs text-muted-foreground">
          Extra inputs: ${audioSelection.valid.length} audio / ${subtitleSelection.valid.length} subtitles / ${attachmentSelection.valid.length} attachments
        </div>
        <div class="mt-2 text-[11px] text-muted-foreground uppercase tracking-wide">
          Output extension: ${escapeHtml(outputExt)}
        </div>
      </div>
      ${warningsHtml}
    </div>
  `;
}

// Build warnings for mismatched files and container limitations.
function buildWarningLines(audioSelection, subtitleSelection, attachmentSelection, outputName) {
  const warnings = [];
  if (audioSelection.invalid.length) {
    warnings.push(`Ignored non-audio files: ${formatFileList(audioSelection.invalid)}`);
  }
  if (subtitleSelection.invalid.length) {
    warnings.push(`Ignored non-subtitle files: ${formatFileList(subtitleSelection.invalid)}`);
  }
  if (attachmentSelection.invalid.length) {
    warnings.push(`Ignored unsupported attachments: ${formatFileList(attachmentSelection.invalid)}`);
  }
  const ext = splitFileName(outputName).ext.toLowerCase();
  if (attachmentSelection.valid.length && ext !== ".mkv") {
    warnings.push("Attachments are best supported in MKV. Consider using a .mkv output extension.");
  }
  if (subtitleSelection.valid.length && ext === ".mp4") {
    warnings.push("MP4 subtitles may require conversion. Consider switching to .mkv or editing the command.");
  }
  return warnings;
}

// Render warning blocks using Tailwind utility classes.
function buildWarningHtml(lines) {
  const items = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `
    <div class="rounded-sm border border-yellow-500/30 bg-yellow-50/60 px-3 py-2 text-xs text-yellow-700">
      <div class="font-semibold uppercase tracking-wide text-[11px]">Warnings</div>
      <ul class="list-disc pl-4 space-y-1 mt-1">${items}</ul>
    </div>
  `;
}

// Format a list of files into a compact label.
function formatFileList(files) {
  const names = files.map((file) => file.name || "Unnamed").slice(0, 4);
  const suffix = files.length > 4 ? ` +${files.length - 4} more` : "";
  return `${names.join(", ")}${suffix}`;
}

// Build the idle summary card before any video is selected.
function buildIdleSummaryHtml() {
  return `
    <div class="rounded-sm border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      Upload a video to inspect its tracks with ffprobe.
    </div>
  `;
}

// Extract stream arrays from ffprobe data safely.
function extractStreams(probeData) {
  if (!probeData || typeof probeData !== "object") return [];
  return Array.isArray(probeData.streams) ? probeData.streams : [];
}

// Stage all selected files into the ffmpeg virtual file system.
async function stageInputFiles(ffmpegInstance, entries) {
  for (const entry of entries) {
    if (!entry || !entry.file) continue;
    console.log("[video-track-merger] Writing file", buildEntryDebugInfo(entry));
    await ffmpegInstance.writeFile(entry.name, new Uint8Array(await entry.file.arrayBuffer()));
  }
}

// Clean up staged files after ffmpeg execution.
async function cleanupStagedFiles(ffmpegInstance, entries) {
  for (const entry of entries) {
    if (!entry || !entry.name) continue;
    console.log("[video-track-merger] Deleting file", { name: entry.name });
    await ffmpegInstance.deleteFile(entry.name);
  }
}

// Parse a textarea command string into ffmpeg argument tokens.
function parseCommandArgs(command) {
  const cleaned = stripCommandComments(command);
  if (!cleaned) return [];
  const args = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
        continue;
      }
      if (char === "\\" && cleaned[i + 1]) {
        current += cleaned[i + 1];
        i += 1;
        continue;
      }
      current += char;
      continue;
    }
    if (char === "\"" || char === "'") {
      inQuote = true;
      quoteChar = char;
      continue;
    }
    if (/\s/u.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) args.push(current);
  if (args[0] === "ffmpeg") args.shift();
  return args;
}

// Remove comment-only lines to keep parsing reliable.
function stripCommandComments(command) {
  if (!command) return "";
  return command
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join(" ");
}

// Resolve the output file name from the parsed ffmpeg arguments.
function resolveOutputFileNameFromArgs(args, fallback) {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    if (!args[i].startsWith("-")) return args[i];
  }
  return fallback;
}

// Run ffmpeg with progress callbacks to keep UI responsive.
function runCommandWithProgress(ffmpegInstance, args, label, hint, callback) {
  return new Promise((resolve, reject) => {
    callback({
      mergeProgress: buildProgressValue(0, label, hint),
    });
    function handleProgress({ progress }) {
      const percent = Math.min(100, Math.max(0, Math.round((progress || 0) * 100)));
      callback({
        mergeProgress: buildProgressValue(percent, label, hint),
      });
    }
    ffmpegInstance.on("progress", handleProgress);
    console.log(`[video-track-merger] ffmpeg exec: ${buildExecCommandString(args)}`);
    ffmpegInstance.exec(args).then(resolve, reject).finally(() => {
      if (typeof ffmpegInstance.off === "function") ffmpegInstance.off("progress", handleProgress);
    });
  });
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

// Build the output HTML with download link and preview.
function buildMergedOutputHtml(fileName, buffer) {
  const mime = videoMimeFromExt(fileName);
  const url = buildObjectUrl(buffer, mime);
  const sizeLabel = formatBytes(buffer.length || 0);
  return `
    <div class="flex flex-col gap-2">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col min-w-0">
          <div class="text-sm font-semibold text-foreground truncate" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-wide">${escapeHtml(mime)}</span>
            <span>${escapeHtml(sizeLabel)}</span>
          </div>
        </div>
        <a class="text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors whitespace-nowrap" href="${url}" download="${escapeHtml(fileName)}">
          Download
        </a>
      </div>
      <div class="mt-2">
        <video controls src="${url}" class="w-full max-h-96 bg-black"></video>
      </div>
    </div>
  `;
}

// Build placeholder output HTML for empty states.
function buildEmptyOutputHtml(message) {
  return `<div class="text-sm text-muted-foreground">${escapeHtml(message)}</div>`;
}

// Build an object URL from a Uint8Array buffer.
function buildObjectUrl(fileContent, mime) {
  const blob = new Blob([fileContent], { type: mime });
  return URL.createObjectURL(blob);
}

// Resolve a video MIME type from a file extension.
function videoMimeFromExt(fileName) {
  const ext = splitFileName(fileName).ext.replace(".", "").toLowerCase();
  if (ext === "mkv") return "video/x-matroska";
  if (ext === "webm") return "video/webm";
  if (ext === "avi") return "video/x-msvideo";
  if (ext === "ts") return "video/mp2t";
  return "video/mp4";
}

// Split filenames into base name and extension.
function splitFileName(name) {
  const match = String(name || "").match(/^(.*?)(?:\.([^.]+))?$/);
  if (!match) return { baseName: "output", ext: "" };
  const base = match[1] || "output";
  const ext = match[2] ? `.${match[2]}` : "";
  return { baseName: base, ext };
}

// Format byte sizes into human-friendly strings.
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exp);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exp]}`;
}

// Escape HTML entities to keep output safe.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Log ffmpeg internal output to help debug FS failures.
function handleFfmpegLog({ type, message }) {
  console.log("[video-track-merger] ffmpeg", { type, message });
}

// Build compact debug details for file entries.
function buildEntryDebugInfo(entry) {
  return {
    name        : entry?.name,
    size        : entry?.file?.size,
    type        : entry?.file?.type,
    originalName: entry?.originalName,
  };
}

// Build compact debug details for the main video file.
function buildFileDebugInfo(file, inputName) {
  return {
    inputName,
    name: file?.name,
    size: file?.size,
    type: file?.type,
  };
}
