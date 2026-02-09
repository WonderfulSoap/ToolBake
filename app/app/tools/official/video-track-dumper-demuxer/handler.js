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

  const includeVideo = inputWidgets.extractVideo !== false;
  const includeAudio = inputWidgets.extractAudio !== false;
  const videoContainer = normalizeContainer(inputWidgets.videoContainer);
  const videoFile = normalizeInputFile(inputWidgets.sourceVideo);
  if (!videoFile) {
    return {
      dumpProgress: buildProgressValue(0, "Idle", "Upload a video to start demuxing"),
      videoOutputs: "",
      audioOutputs: "",
      otherOutputs: "",
    };
  }

  if (changedWidgetIds !== "dumpTrigger") {
    return {
      dumpProgress: buildProgressValue(0, "Idle", "Click Dump Tracks to start"),
      videoOutputs: "",
      audioOutputs: "",
      otherOutputs: "",
    };
  }

  callback({
    dumpProgress: buildProgressValue(0, "Loading", "Preparing ffmpeg.wasm"),
    videoOutputs: "",
    audioOutputs: "",
    otherOutputs: "",
  });

  const sourceName = videoFile.name || "input-video.mp4";
  const nameInfo = splitFileName(sourceName);
  const inputName = ensureInputName(sourceName);
  const probeOutput = "ffprobe-output.json";

  callback({
    dumpProgress: buildProgressValue(10, "Staging", "Writing file to the virtual file system"),
  });
  await ffmpeg.writeFile(inputName, new Uint8Array(await videoFile.arrayBuffer()));

  callback({
    dumpProgress: buildProgressValue(25, "Inspecting", "Running ffprobe to list tracks"),
  });
  await ffmpeg.ffprobe([
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    "-i",
    inputName,
    "-o",
    probeOutput,
  ]);

  const probeBuffer = await ffmpeg.readFile(probeOutput);
  await ffmpeg.deleteFile(probeOutput);

  const probeData = parseProbeJson(probeBuffer);
  const streams = extractStreams(probeData);
  const videoStreams = includeVideo ? streams.filter((stream) => stream.codec_type === "video") : [];
  const audioStreams = includeAudio ? streams.filter((stream) => stream.codec_type === "audio") : [];
  const otherStreams = streams.filter((stream) => stream.codec_type && !["video", "audio"].includes(stream.codec_type));

  const videoOutputs = includeVideo
    ? videoStreams.map((stream, index) => buildVideoOutputMeta(stream, index, nameInfo.baseName, videoContainer, nameInfo.ext))
    : [];
  const audioOutputs = includeAudio
    ? audioStreams.map((stream, index) => buildAudioOutputMeta(stream, index, nameInfo.baseName))
    : [];
  const otherOutputs = otherStreams.map((stream, index) => buildOtherOutputMeta(stream, index, nameInfo.baseName));

  const totalStages = videoOutputs.length + audioOutputs.length + otherOutputs.length;
  if (totalStages === 0) {
    await ffmpeg.deleteFile(inputName);
    return {
      dumpProgress: buildProgressValue(0, "No tracks", "No extractable tracks found in this file"),
      videoOutputs: "",
      audioOutputs: "",
      otherOutputs: "",
    };
  }

  let stageCursor = 0;
  for (const meta of videoOutputs) {
    await runCommandWithProgress(ffmpeg, meta.args(inputName), stageCursor, totalStages, meta.label, callback);
    stageCursor += 1;
  }
  for (const meta of audioOutputs) {
    await runCommandWithProgress(ffmpeg, meta.args(inputName), stageCursor, totalStages, meta.label, callback);
    stageCursor += 1;
  }
  for (const meta of otherOutputs) {
    await runCommandWithProgress(ffmpeg, meta.args(inputName), stageCursor, totalStages, meta.label, callback);
    stageCursor += 1;
  }

  const videoBuffers = await Promise.all(videoOutputs.map(async (meta) => ({
    meta,
    buffer: await ffmpeg.readFile(meta.fileName),
  })));
  const audioBuffers = await Promise.all(audioOutputs.map(async (meta) => ({
    meta,
    buffer: await ffmpeg.readFile(meta.fileName),
  })));
  const otherBuffers = await Promise.all(otherOutputs.map(async (meta) => ({
    meta,
    buffer: await ffmpeg.readFile(meta.fileName),
  })));

  await ffmpeg.deleteFile(inputName);
  for (const { meta } of [...videoBuffers, ...audioBuffers, ...otherBuffers]) {
    await ffmpeg.deleteFile(meta.fileName);
  }

  const videoHtml = includeVideo
    ? videoBuffers.map(({ meta, buffer }) => buildDownloadBlock(meta, buffer, buildVideoPreview)).join("")
    : "";
  const audioHtml = includeAudio
    ? audioBuffers.map(({ meta, buffer }) => buildDownloadBlock(meta, buffer, buildAudioPreview)).join("")
    : "";
  const otherHtml = otherBuffers.map(({ meta, buffer }) => buildDownloadBlock(meta, buffer)).join("");

  return {
    dumpProgress: buildProgressValue(100, "Completed", "Tracks extracted successfully"),
    videoOutputs: videoHtml,
    audioOutputs: audioHtml,
    otherOutputs: otherHtml,
  };
}

// Cache the ffmpeg module and instance to avoid repeated wasm initialization.
let FFmpegModule;
let ffmpeg;

// Normalize FileUploadInput payloads to a single Blob or null.
function normalizeInputFile(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  if (value instanceof Blob) return value;
  return null;
}

// Ensure ffmpeg input files have a usable name and extension.
function ensureInputName(name) {
  if (typeof name !== "string" || !name.trim()) return "input-video.mp4";
  return name.includes(".") ? name : `${name}.mp4`;
}

// Normalize container selections into a simple keyword.
function normalizeContainer(value) {
  if (typeof value !== "string" || !value.trim()) return "original";
  return value.toLowerCase();
}

// Parse the ffprobe output file into a JSON object.
function parseProbeJson(buffer) {
  const text = new TextDecoder("utf-8").decode(buffer);
  return JSON.parse(text || "{}");
}

// Extract stream entries from the ffprobe payload safely.
function extractStreams(probeData) {
  if (!probeData || typeof probeData !== "object") return [];
  return Array.isArray(probeData.streams) ? probeData.streams : [];
}

// Build metadata for a video stream output.
function buildVideoOutputMeta(stream, index, baseName, container, sourceExt) {
  const displayIndex = index + 1;
  const codecLabel = formatValue(stream.codec_long_name || stream.codec_name);
  const resolutionLabel = stream.width && stream.height ? `${stream.width} x ${stream.height}` : "-";
  const frameRateLabel = formatFrameRate(stream.avg_frame_rate || stream.r_frame_rate);
  const languageLabel = formatValue(stream.tags && stream.tags.language);
  const titleLabel = formatValue(stream.tags && stream.tags.title);
  const outputExt = resolveVideoExt(container, stream.codec_name, sourceExt);
  const fileName = `${baseName}-video-track${displayIndex}${outputExt}`;
  const outputFormat = videoFormatFromExt(outputExt);
  const streamIndex = normalizeStreamIndex(stream.index, index);
  return {
    fileName,
    mime         : videoMimeFromExt(outputExt),
    label        : `Extracting video track #${displayIndex}`,
    downloadLabel: `Video track #${displayIndex}`,
    details      : {
      codecLabel,
      resolutionLabel,
      frameRateLabel,
      languageLabel,
      titleLabel,
    },
    args(inputName) {
      return ["-i", inputName, "-map", `0:${streamIndex}`, "-c:v", "copy", "-f", outputFormat, fileName];
    },
  };
}

// Build metadata for an audio stream output.
function buildAudioOutputMeta(stream, index, baseName) {
  const displayIndex = index + 1;
  const codecLabel = formatValue(stream.codec_long_name || stream.codec_name);
  const sampleRateLabel = stream.sample_rate ? `${formatValue(stream.sample_rate)} Hz` : "-";
  const channelsLabel = formatValue(stream.channels);
  const layoutLabel = formatValue(stream.channel_layout);
  const languageLabel = formatValue(stream.tags && stream.tags.language);
  const titleLabel = formatValue(stream.tags && stream.tags.title);
  const outputExt = resolveAudioExt(stream.codec_name, stream.codec_type);
  const fileName = `${baseName}-audio-track${displayIndex}${outputExt}`;
  const streamIndex = normalizeStreamIndex(stream.index, index);
  return {
    fileName,
    mime         : mimeFromExt(outputExt),
    label        : `Extracting audio track #${displayIndex}`,
    downloadLabel: `Audio track #${displayIndex}`,
    details      : {
      codecLabel,
      sampleRateLabel,
      channelsLabel,
      layoutLabel,
      languageLabel,
      titleLabel,
    },
    args(inputName) {
      return ["-i", inputName, "-map", `0:${streamIndex}`, "-c:a", "copy", fileName];
    },
  };
}

// Build metadata for non-audio/video streams (subtitles, data, attachments).
function buildOtherOutputMeta(stream, index, baseName) {
  const displayIndex = index + 1;
  const streamLabel = normalizeOtherStreamType(stream.codec_type);
  const codecLabel = formatValue(stream.codec_long_name || stream.codec_name);
  const languageLabel = formatValue(stream.tags && stream.tags.language);
  const titleLabel = formatValue(stream.tags && stream.tags.title);
  const outputExt = resolveOtherExt(streamLabel, stream.codec_name);
  const fileName = `${baseName}-${streamLabel}-track${displayIndex}${outputExt}`;
  const streamIndex = normalizeStreamIndex(stream.index, index);
  return {
    fileName,
    mime         : mimeFromExt(outputExt),
    label        : `Extracting ${streamLabel} track #${displayIndex}`,
    downloadLabel: `${capitalizeLabel(streamLabel)} track #${displayIndex}`,
    details      : {
      codecLabel,
      languageLabel,
      titleLabel,
    },
    args(inputName) {
      return ["-i", inputName, "-map", `0:${streamIndex}`, "-c", "copy", fileName];
    },
  };
}

// Run a single ffmpeg command while emitting progress updates.
function runCommandWithProgress(ffmpegInstance, args, stageIndex, totalStages, label, callback) {
  return new Promise((resolve, reject) => {
    const stageHint = buildStageHint(stageIndex, totalStages);
    callback({
      dumpProgress: buildProgressValue(percentForStage(stageIndex, totalStages, 0), label, stageHint),
    });

    function handleProgress({ progress }) {
      const localPercent = clampPercent(progress * 100);
      callback({
        dumpProgress: buildProgressValue(percentForStage(stageIndex, totalStages, localPercent), label, stageHint),
      });
    }

    ffmpegInstance.on("progress", handleProgress);
    ffmpegInstance.exec(args).then(resolve, reject).finally(() => {
      if (typeof ffmpegInstance.off === "function") ffmpegInstance.off("progress", handleProgress);
    });
  });
}

// Build the progress value expected by the ProgressBar widget.
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

// Spread stages evenly across the progress bar.
function percentForStage(stageIndex, totalStages, localPercent) {
  const span = 100 / Math.max(1, totalStages);
  return Math.round(Math.min(99.9, stageIndex * span + (span * clampPercent(localPercent)) / 100));
}

// Build a stage hint string for the progress bar.
function buildStageHint(stageIndex, totalStages) {
  const current = Math.min(stageIndex + 1, totalStages);
  return `Stage ${current}/${totalStages}`;
}

// Clamp a percent value between 0 and 100.
function clampPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

// Split a filename into base name and extension.
function splitFileName(name) {
  const match = String(name || "").match(/^(.*?)(?:\.([^.]+))?$/);
  if (!match) return { baseName: "output", ext: "" };
  const base = match[1] || "output";
  const ext = match[2] ? `.${match[2]}` : "";
  return { baseName: base, ext };
}

// Ensure stream indices are usable for ffmpeg mapping.
function normalizeStreamIndex(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

// Build a download block with metadata and optional preview.
function buildDownloadBlock(meta, buffer, previewBuilder) {
  const mime = meta.mime || "application/octet-stream";
  const url = buildObjectUrl(buffer, mime);
  const sizeLabel = formatBytes(buffer.length || 0);
  const detailsHtml = buildDetailsHtml(meta.details);
  const previewHtml = typeof previewBuilder === "function" ? previewBuilder(url) : "";
  const previewSection = previewHtml ? `<div class="mt-2">${previewHtml}</div>` : "";
  // Place previews under the header row so they can use full width.
  return `
    <div class="flex flex-col gap-2 px-3 py-2 rounded-sm bg-muted/40 border border-border/60">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col min-w-0">
          <div class="text-sm font-semibold text-foreground truncate" title="${escapeHtml(meta.fileName)}">${escapeHtml(meta.downloadLabel)}</div>
          <div class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-wide">${escapeHtml(mime)}</span>
            <span>${escapeHtml(sizeLabel)}</span>
          </div>
          ${detailsHtml}
        </div>
        <a class="text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors whitespace-nowrap" href="${url}" download="${escapeHtml(meta.fileName)}">
          Download
        </a>
      </div>
      ${previewSection}
    </div>
  `;
}

// Build the metadata detail lines for a track output.
function buildDetailsHtml(details) {
  const lines = [];
  if (!details || typeof details !== "object") return "";
  if (details.codecLabel && details.codecLabel !== "-") lines.push(buildMetaLine("Codec", details.codecLabel));
  if (details.resolutionLabel && details.resolutionLabel !== "-") lines.push(buildMetaLine("Resolution", details.resolutionLabel));
  if (details.frameRateLabel && details.frameRateLabel !== "-") lines.push(buildMetaLine("Frame rate", details.frameRateLabel));
  if (details.sampleRateLabel && details.sampleRateLabel !== "-") lines.push(buildMetaLine("Sample rate", details.sampleRateLabel));
  if (details.channelsLabel && details.channelsLabel !== "-") lines.push(buildMetaLine("Channels", details.channelsLabel));
  if (details.layoutLabel && details.layoutLabel !== "-") lines.push(buildMetaLine("Layout", details.layoutLabel));
  if (details.languageLabel && details.languageLabel !== "-") lines.push(buildMetaLine("Language", details.languageLabel));
  if (details.titleLabel && details.titleLabel !== "-") lines.push(buildMetaLine("Title", details.titleLabel));
  if (!lines.length) return "";
  return `<div class="mt-1 space-y-1">${lines.join("")}</div>`;
}

// Build a single metadata line for display.
function buildMetaLine(label, value) {
  return `<div class="text-[11px] text-muted-foreground">${escapeHtml(label)}: <span class="font-medium text-foreground">${escapeHtml(value)}</span></div>`;
}

// Build a preview block for video outputs.
function buildVideoPreview(url) {
  if (!url) return "";
  return `
    <video controls src="${url}" class="w-full max-h-80 bg-black"></video>
  `;
}

// Build a preview block for audio outputs.
function buildAudioPreview(url) {
  if (!url) return "";
  return `
    <audio controls src="${url}" class="w-full"></audio>
  `;
}

// Create an object URL for a Uint8Array buffer.
function buildObjectUrl(fileContent, mime) {
  const blob = new Blob([fileContent], { type: mime });
  return URL.createObjectURL(blob);
}

// Format values with fallbacks for display.
function formatValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

// Format frame rate values into a readable label.
function formatFrameRate(value) {
  if (!value) return "-";
  if (typeof value === "number") return `${value.toFixed(2)} fps`;
  if (typeof value === "string" && value.includes("/")) {
    const parts = value.split("/").map((part) => Number(part));
    if (parts.length === 2 && parts[0] && parts[1]) return `${(parts[0] / parts[1]).toFixed(2)} fps`;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "-";
  return `${numeric.toFixed(2)} fps`;
}

// Format byte sizes into human-friendly strings.
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exp);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exp]}`;
}

// Resolve video output extensions using container or codec.
function resolveVideoExt(container, codec, sourceExt) {
  if (container && container !== "original") return ensureLeadingDot(container);
  const normalizedCodec = (codec || "").toLowerCase();
  if (normalizedCodec.includes("vp9") || normalizedCodec.includes("vp8")) return ".webm";
  if (normalizedCodec.includes("av1")) return ".mp4";
  if (normalizedCodec.includes("hevc") || normalizedCodec.includes("h265")) return ".mp4";
  if (normalizedCodec.includes("h264")) return ".mp4";
  if (sourceExt) return ensureLeadingDot(sourceExt);
  return ".mp4";
}

// Resolve audio output extensions using codec names.
function resolveAudioExt(codec) {
  const normalizedCodec = (codec || "").toLowerCase();
  if (normalizedCodec.includes("opus")) return ".opus";
  if (normalizedCodec.includes("vorbis")) return ".ogg";
  if (normalizedCodec.includes("mp3")) return ".mp3";
  if (normalizedCodec.includes("flac")) return ".flac";
  if (normalizedCodec.includes("aac")) return ".aac";
  if (normalizedCodec.includes("eac3")) return ".eac3";
  if (normalizedCodec.includes("ac3")) return ".ac3";
  if (normalizedCodec.includes("pcm")) return ".wav";
  return ".m4a";
}

// Resolve extensions for non-audio/video streams.
function resolveOtherExt(streamType, codec) {
  const normalizedType = (streamType || "").toLowerCase();
  const normalizedCodec = (codec || "").toLowerCase();
  if (normalizedType === "subtitle") {
    if (normalizedCodec.includes("subrip")) return ".srt";
    if (normalizedCodec.includes("ass")) return ".ass";
    if (normalizedCodec.includes("webvtt")) return ".vtt";
    if (normalizedCodec.includes("hdmv_pgs_subtitle")) return ".sup";
    if (normalizedCodec.includes("dvd_subtitle")) return ".sub";
    return ".srt";
  }
  if (normalizedType === "attachment") {
    if (normalizedCodec.includes("ttf")) return ".ttf";
    if (normalizedCodec.includes("otf")) return ".otf";
    if (normalizedCodec.includes("woff2")) return ".woff2";
    if (normalizedCodec.includes("woff")) return ".woff";
    if (normalizedCodec.includes("png")) return ".png";
    if (normalizedCodec.includes("jpeg") || normalizedCodec.includes("jpg")) return ".jpg";
  }
  return ".bin";
}

// Normalize non-video/audio stream categories for labeling.
function normalizeOtherStreamType(streamType) {
  const normalized = (streamType || "").toLowerCase();
  if (normalized === "subtitle") return "subtitle";
  if (normalized === "attachment") return "attachment";
  if (normalized === "data") return "data";
  return "other";
}

// Build video container format identifiers for ffmpeg.
function videoFormatFromExt(ext) {
  const normalized = (ext || "").replace(/^\./, "").toLowerCase();
  if (normalized === "mkv") return "matroska";
  if (normalized === "webm") return "webm";
  if (normalized === "avi") return "avi";
  if (normalized === "ts") return "mpegts";
  return "mp4";
}

// Pick video MIME types based on extensions.
function videoMimeFromExt(ext) {
  const normalized = (ext || "").replace(/^\./, "").toLowerCase();
  if (normalized === "mkv") return "video/x-matroska";
  if (normalized === "webm") return "video/webm";
  if (normalized === "avi") return "video/x-msvideo";
  if (normalized === "ts") return "video/mp2t";
  return "video/mp4";
}

// Pick general MIME types for audio/subtitle/attachment outputs.
function mimeFromExt(ext) {
  const normalized = (ext || "").replace(/^\./, "").toLowerCase();
  if (normalized === "mp3") return "audio/mpeg";
  if (normalized === "opus") return "audio/opus";
  if (normalized === "flac") return "audio/flac";
  if (normalized === "srt") return "text/plain";
  if (normalized === "ass") return "text/plain";
  if (normalized === "vtt") return "text/vtt";
  if (normalized === "sup") return "application/octet-stream";
  if (normalized === "sub") return "application/octet-stream";
  if (normalized === "ttf") return "font/ttf";
  if (normalized === "otf") return "font/otf";
  if (normalized === "woff") return "font/woff";
  if (normalized === "woff2") return "font/woff2";
  if (normalized === "png") return "image/png";
  if (normalized === "jpg" || normalized === "jpeg") return "image/jpeg";
  if (normalized === "bin") return "application/octet-stream";
  if (normalized === "ogg") return "audio/ogg";
  if (normalized === "wav") return "audio/wav";
  if (["m4a", "aac", "eac3", "ac3"].includes(normalized)) return "audio/mp4";
  return "application/octet-stream";
}

// Ensure dot-prefixed extensions for consistent naming.
function ensureLeadingDot(ext) {
  if (!ext) return "";
  return ext.startsWith(".") ? ext : `.${ext}`;
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

// Capitalize labels for display.
function capitalizeLabel(label) {
  if (!label) return "Other";
  return `${label[0].toUpperCase()}${label.slice(1)}`;
}
