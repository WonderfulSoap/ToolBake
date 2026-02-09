

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

  const videoFile = normalizeInputFile(inputWidgets.sourceVideo);
  if (!videoFile) {
    return {
      probeProgress: buildProgressValue(0, "Idle", "Upload a video to inspect"),
      summary      : "",
      streamDetails: "",
      rawJson      : "",
    };
  }

  callback({
    probeProgress: buildProgressValue(5, "Loading", "Preparing ffprobe"),
  });

  const inputName = ensureInputName(videoFile.name);
  const outputName = "ffprobe-output.json";

  callback({
    probeProgress: buildProgressValue(20, "Staging", "Writing file to the virtual file system"),
  });
  await ffmpeg.writeFile(inputName, new Uint8Array(await videoFile.arrayBuffer()));

  callback({
    probeProgress: buildProgressValue(45, "Inspecting", "Running ffprobe analysis"),
  });
  await ffmpeg.ffprobe([
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    "-show_chapters",
    "-i",
    inputName,
    "-o",
    outputName,
  ]);

  callback({
    probeProgress: buildProgressValue(75, "Parsing", "Building the metadata summary"),
  });
  const outputBuffer = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const probeData = parseProbeJson(outputBuffer);
  const summaryHtml = buildSummaryHtml(videoFile, probeData);
  const streamHtml = buildStreamsHtml(probeData);
  const rawHtml = buildRawJsonHtml(probeData);

  return {
    probeProgress: buildProgressValue(100, "Completed", "Metadata is ready"),
    summary      : summaryHtml,
    streamDetails: streamHtml,
    rawJson      : rawHtml,
  };
}

// Reuse the ffmpeg module across runs to avoid repeated dynamic imports.
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

// Ensure ffprobe input files have a usable name and extension.
function ensureInputName(name) {
  if (typeof name !== "string" || !name.trim()) return "input-video.mp4";
  return name.includes(".") ? name : `${name}.mp4`;
}

// Decode the ffprobe output file into a JSON object.
function parseProbeJson(buffer) {
  const text = new TextDecoder("utf-8").decode(buffer);
  return JSON.parse(text || "{}");
}

// Build the summary section with top-level container and format details.
function buildSummaryHtml(file, probeData) {
  const format = probeData && typeof probeData === "object" ? probeData.format || {} : {};
  const streams = extractStreams(probeData);
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  const subtitleStreams = streams.filter((stream) => stream.codec_type === "subtitle");
  const containerLabel = formatValue(format.format_long_name || format.format_name);
  const durationSeconds = resolveSummaryDurationSeconds(format, streams, videoStream);
  const bitrateValue = resolveSummaryBitrate(format, durationSeconds, file.size);
  const durationLabel = formatDuration(durationSeconds);
  const bitrateLabel = formatBitRate(bitrateValue);
  const sizeBytes = toNumber(format.size) || file.size || 0;
  const sizeLabel = formatBytes(sizeBytes);
  const resolutionLabel = videoStream ? `${formatValue(videoStream.width)} x ${formatValue(videoStream.height)}` : "-";
  const frameRateLabel = videoStream ? formatFrameRate(videoStream.avg_frame_rate || videoStream.r_frame_rate) : "-";

  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">File summary</p>
      <div class="grid gap-2 text-sm text-muted-foreground">
        ${buildSummaryRow("File name", escapeHtml(file.name || "Untitled"))}
        ${buildSummaryRow("Container", containerLabel)}
        ${buildSummaryRow("File size", sizeLabel)}
        ${buildSummaryRow("Duration", durationLabel)}
        ${buildSummaryRow("Bitrate", bitrateLabel)}
        ${buildSummaryRow("Resolution", resolutionLabel)}
        ${buildSummaryRow("Frame rate", frameRateLabel)}
        ${buildSummaryRow("Streams", `${streams.length} total / ${audioStreams.length} audio / ${subtitleStreams.length} subtitles`)}
      </div>
    </div>
  `;
}

// Build a list of stream cards with codec and track details.
function buildStreamsHtml(probeData) {
  const streams = extractStreams(probeData);
  if (streams.length === 0) {
    return "<div class=\"text-sm text-muted-foreground\">No streams detected in this file.</div>";
  }
  const blocks = streams.map((stream, index) => buildStreamBlock(stream, index, streams, probeData && probeData.format)).join("");
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">Stream details</p>
      <div class="space-y-2">${blocks}</div>
    </div>
  `;
}

// Build the raw JSON section with formatted metadata output.
function buildRawJsonHtml(probeData) {
  const jsonText = JSON.stringify(probeData, null, 2);
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">Raw ffprobe JSON</p>
      <pre class="text-[12px] leading-snug text-muted-foreground whitespace-pre-wrap break-words">${escapeHtml(jsonText)}</pre>
    </div>
  `;
}

// Render a single stream card with type-specific fields.
function buildStreamBlock(stream, index, streams, format) {
  const streamType = formatValue(stream.codec_type || "stream");
  const codecLabel = formatValue(stream.codec_long_name || stream.codec_name);
  const profileLabel = formatValue(stream.profile);
  const languageLabel = formatValue(stream.tags && stream.tags.language);
  const titleLabel = formatValue(stream.tags && stream.tags.title);
  const durationLabel = formatDuration(resolveStreamDurationSeconds(stream));
  const bitrateLabel = formatBitRate(resolveStreamBitrate(stream, streams, format));
  const details = buildStreamDetailLines(stream);

  return `
    <div class="rounded-sm border border-border/60 bg-muted/30 px-3 py-2 space-y-1">
      <div class="flex items-center justify-between text-sm text-foreground">
        <span class="font-semibold">Stream ${index + 1} · ${escapeHtml(streamType)}</span>
        <span class="text-[11px] uppercase tracking-wide text-muted-foreground">${escapeHtml(codecLabel)}</span>
      </div>
      ${profileLabel !== "-" ? `<div class="text-xs text-muted-foreground">Profile: <span class="font-medium text-foreground">${escapeHtml(profileLabel)}</span></div>` : ""}
      ${titleLabel !== "-" ? `<div class="text-xs text-muted-foreground">Title: <span class="font-medium text-foreground">${escapeHtml(titleLabel)}</span></div>` : ""}
      ${languageLabel !== "-" ? `<div class="text-xs text-muted-foreground">Language: <span class="font-medium text-foreground">${escapeHtml(languageLabel)}</span></div>` : ""}
      <div class="text-xs text-muted-foreground">Duration: <span class="font-medium text-foreground">${escapeHtml(durationLabel)}</span></div>
      <div class="text-xs text-muted-foreground">Bitrate: <span class="font-medium text-foreground">${escapeHtml(bitrateLabel)}</span></div>
      ${details}
    </div>
  `;
}

// Build detail lines for stream-specific properties.
function buildStreamDetailLines(stream) {
  if (stream.codec_type === "video") {
    const resolutionLabel = `${formatValue(stream.width)} x ${formatValue(stream.height)}`;
    const frameRateLabel = formatFrameRate(stream.avg_frame_rate || stream.r_frame_rate);
    const pixelFormatLabel = formatValue(stream.pix_fmt);
    const aspectRatioLabel = formatValue(stream.display_aspect_ratio);
    return `
      <div class="text-xs text-muted-foreground">Resolution: <span class="font-medium text-foreground">${escapeHtml(resolutionLabel)}</span></div>
      <div class="text-xs text-muted-foreground">Frame rate: <span class="font-medium text-foreground">${escapeHtml(frameRateLabel)}</span></div>
      <div class="text-xs text-muted-foreground">Pixel format: <span class="font-medium text-foreground">${escapeHtml(pixelFormatLabel)}</span></div>
      <div class="text-xs text-muted-foreground">Aspect ratio: <span class="font-medium text-foreground">${escapeHtml(aspectRatioLabel)}</span></div>
    `;
  }
  if (stream.codec_type === "audio") {
    const sampleRateLabel = stream.sample_rate ? `${formatValue(stream.sample_rate)} Hz` : "-";
    const channelsLabel = formatValue(stream.channels);
    const layoutLabel = formatValue(stream.channel_layout);
    return `
      <div class="text-xs text-muted-foreground">Sample rate: <span class="font-medium text-foreground">${escapeHtml(sampleRateLabel)}</span></div>
      <div class="text-xs text-muted-foreground">Channels: <span class="font-medium text-foreground">${escapeHtml(channelsLabel)}</span></div>
      <div class="text-xs text-muted-foreground">Layout: <span class="font-medium text-foreground">${escapeHtml(layoutLabel)}</span></div>
    `;
  }
  if (stream.codec_type === "subtitle") {
    const codecTag = formatValue(stream.codec_tag_string);
    return `
      <div class="text-xs text-muted-foreground">Codec tag: <span class="font-medium text-foreground">${escapeHtml(codecTag)}</span></div>
    `;
  }
  return "";
}

// Build a simple row for summary values.
function buildSummaryRow(label, value) {
  const safeValue = value || "-";
  return `
    <div class="flex items-center justify-between gap-2">
      <span>${escapeHtml(label)}</span>
      <span class="font-medium text-foreground text-right">${escapeHtml(safeValue)}</span>
    </div>
  `;
}

// Extract stream array from the ffprobe payload safely.
function extractStreams(probeData) {
  if (!probeData || typeof probeData !== "object") return [];
  const streams = probeData.streams;
  return Array.isArray(streams) ? streams : [];
}

// Format values with fallbacks for display.
function formatValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

// Format the duration in seconds into a human-readable label.
function formatDuration(value) {
  const seconds = toNumber(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [hours, minutes, secs].map((part) => String(part).padStart(2, "0"));
  return parts.join(":");
}

// Format bit rates into kbps/mbps labels.
function formatBitRate(value) {
  const bitrate = toNumber(value);
  if (!Number.isFinite(bitrate) || bitrate <= 0) return "-";
  if (bitrate >= 1_000_000) return `${(bitrate / 1_000_000).toFixed(2)} Mbps`;
  return `${Math.round(bitrate / 1_000)} kbps`;
}

// Format byte sizes into a human-readable string.
function formatBytes(bytes) {
  const value = toNumber(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / (1024 ** exp);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[exp]}`;
}

// Convert frame rate strings like 30000/1001 into a numeric label.
function formatFrameRate(value) {
  if (!value) return "-";
  if (typeof value === "number") return `${value.toFixed(2)} fps`;
  if (typeof value === "string" && value.includes("/")) {
    const parts = value.split("/").map((part) => toNumber(part));
    if (parts.length === 2 && parts[0] && parts[1]) {
      return `${(parts[0] / parts[1]).toFixed(2)} fps`;
    }
  }
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "-";
  return `${numeric.toFixed(2)} fps`;
}

// Parse numbers from mixed string/number values.
function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
}

// Try to resolve a stream duration in seconds with tag fallbacks.
function resolveStreamDurationSeconds(stream) {
  const direct = toNumber(stream && stream.duration);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const tagDuration = parseDurationString(findTagValue(stream && stream.tags, "duration"));
  if (Number.isFinite(tagDuration) && tagDuration > 0) return tagDuration;
  return NaN;
}

// Try to resolve a stream bitrate with tag fallbacks.
function resolveStreamBitrate(stream, streams, format) {
  const direct = toNumber(stream && stream.bit_rate);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const tagBitrate = toNumber(findTagValue(stream && stream.tags, "bitrate"));
  if (Number.isFinite(tagBitrate) && tagBitrate > 0) return tagBitrate;
  const estimated = estimateMissingStreamBitrate(stream, streams, format);
  if (Number.isFinite(estimated) && estimated > 0) return estimated;
  return NaN;
}

// Use format duration first, then stream durations as a fallback.
function resolveSummaryDurationSeconds(format, streams, videoStream) {
  const formatDuration = toNumber(format && format.duration);
  if (Number.isFinite(formatDuration) && formatDuration > 0) return formatDuration;
  const tagDuration = parseDurationString(findTagValue(format && format.tags, "duration"));
  if (Number.isFinite(tagDuration) && tagDuration > 0) return tagDuration;
  const videoDuration = resolveStreamDurationSeconds(videoStream || {});
  if (Number.isFinite(videoDuration) && videoDuration > 0) return videoDuration;
  const streamDurations = (streams || []).map((stream) => resolveStreamDurationSeconds(stream)).filter((value) => Number.isFinite(value));
  if (!streamDurations.length) return NaN;
  return Math.max(...streamDurations);
}

// Use format bitrate first, then estimate via size/duration.
function resolveSummaryBitrate(format, durationSeconds, fileSize) {
  const formatBitrate = toNumber(format && format.bit_rate);
  if (Number.isFinite(formatBitrate) && formatBitrate > 0) return formatBitrate;
  const tagBitrate = toNumber(findTagValue(format && format.tags, "bitrate"));
  if (Number.isFinite(tagBitrate) && tagBitrate > 0) return tagBitrate;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return NaN;
  if (!Number.isFinite(fileSize) || fileSize <= 0) return NaN;
  return (fileSize * 8) / durationSeconds;
}

// Parse duration strings like HH:MM:SS.mmm into seconds.
function parseDurationString(value) {
  if (typeof value !== "string" || !value.trim()) return NaN;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+):([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if ([hours, minutes, seconds].every((part) => Number.isFinite(part))) {
      return (hours * 3600) + (minutes * 60) + seconds;
    }
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : NaN;
}

// Pick a tag value by common key patterns (case-insensitive).
function findTagValue(tags, category) {
  if (!tags || typeof tags !== "object") return undefined;
  const keys = Object.keys(tags);
  if (category === "duration") {
    const match = keys.find((key) => key.toLowerCase().includes("duration"));
    return match ? tags[match] : undefined;
  }
  if (category === "bitrate") {
    const match = keys.find((key) => {
      const lowered = key.toLowerCase();
      return lowered.includes("bitrate") || lowered.includes("bps");
    });
    return match ? tags[match] : undefined;
  }
  return undefined;
}

// Estimate missing stream bitrate when the container bitrate is known.
function estimateMissingStreamBitrate(stream, streams, format) {
  if (!stream || stream.codec_type !== "video") return NaN;
  const formatBitrate = toNumber(format && format.bit_rate);
  if (!Number.isFinite(formatBitrate) || formatBitrate <= 0) return NaN;
  const bitrateValues = (streams || []).map((item) => toNumber(item && item.bit_rate)).filter((value) => Number.isFinite(value) && value > 0);
  const knownTotal = bitrateValues.reduce((sum, value) => sum + value, 0);
  const remaining = formatBitrate - knownTotal;
  if (!Number.isFinite(remaining) || remaining <= 0) return NaN;
  const missingVideoStreams = (streams || []).filter((item) => item && item.codec_type === "video" && !toNumber(item.bit_rate));
  if (!missingVideoStreams.length) return NaN;
  return remaining / missingVideoStreams.length;
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

// Normalize progress values for the ProgressBar widget.
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
