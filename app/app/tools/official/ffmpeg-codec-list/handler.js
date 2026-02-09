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
  // The refresh button only triggers execution, so we do not need its value.
  void inputWidgets;
  void changedWidgetIds;

  if (!FFmpegModule) FFmpegModule = await requirePackage("ffmpeg");
  if (!ffmpeg) {
    callback({ scanProgress: buildProgressValue(10, "Loading", "Initializing ffmpeg.wasm") });
    ffmpeg = new FFmpegModule.FFmpeg();
    await ffmpeg.load_ffmpeg();
  }

  callback({ scanProgress: buildProgressValue(35, "Scanning", "Running ffmpeg -codecs") });
  const rawOutput = await runFfmpegList(ffmpeg, ["-hide_banner", "-codecs"]);
  callback({ scanProgress: buildProgressValue(70, "Parsing", "Building codec tables") });

  const entries = parseCodecList(rawOutput);
  const groups = groupCodecs(entries);
  const summaryHtml = buildSummaryHtml(groups, entries.length);
  const videoHtml = buildCodecCategoryHtml("Video", groups.videoEncoders, groups.videoDecoders);
  const audioHtml = buildCodecCategoryHtml("Audio", groups.audioEncoders, groups.audioDecoders);
  const rawHtml = buildRawOutputHtml(rawOutput);

  return {
    scanProgress: buildProgressValue(100, "Completed", "Codec list ready"),
    summary     : summaryHtml,
    videoCodecs : videoHtml,
    audioCodecs : audioHtml,
    rawOutput   : rawHtml,
  };
}

// Cache the ffmpeg module and instance to avoid repeated wasm initialization.
let FFmpegModule;
let ffmpeg;

// Execute ffmpeg commands while capturing stdout/stderr logs.
function runFfmpegList(ffmpegInstance, args) {
  return new Promise((resolve, reject) => {
    const logs = [];
    function handleLog({ message }) {
      if (typeof message === "string") logs.push(message);
    }
    if (typeof ffmpegInstance.on === "function") ffmpegInstance.on("log", handleLog);
    ffmpegInstance.exec(args).then(() => resolve(logs.join("\n")), reject).finally(() => {
      if (typeof ffmpegInstance.off === "function") ffmpegInstance.off("log", handleLog);
    });
  });
}

// Parse the `ffmpeg -codecs` output into structured entries.
function parseCodecList(rawText) {
  const lines = String(rawText || "").split(/\r?\n/u);
  const entries = [];
  for (const line of lines) {
    // eslint-disable-next-line no-useless-escape
    const match = line.match(/^\s*([D\.])([E\.])([VAS])([I\.])([L\.])([S\.])\s+(\S+)\s+(.*)$/u);
    if (!match) continue;
    entries.push({
      decode     : match[1] === "D",
      encode     : match[2] === "E",
      type       : match[3],
      name       : match[7],
      description: match[8] || "",
    });
  }
  return entries;
}

// Split parsed entries into audio/video encoder/decoder buckets.
function groupCodecs(entries) {
  const groups = {
    audioEncoders: [],
    audioDecoders: [],
    videoEncoders: [],
    videoDecoders: [],
  };
  for (const entry of entries) {
    if (entry.type !== "A" && entry.type !== "V") continue;
    if (entry.type === "A" && entry.encode) addUnique(groups.audioEncoders, entry);
    if (entry.type === "A" && entry.decode) addUnique(groups.audioDecoders, entry);
    if (entry.type === "V" && entry.encode) addUnique(groups.videoEncoders, entry);
    if (entry.type === "V" && entry.decode) addUnique(groups.videoDecoders, entry);
  }
  groups.audioEncoders = sortByName(groups.audioEncoders);
  groups.audioDecoders = sortByName(groups.audioDecoders);
  groups.videoEncoders = sortByName(groups.videoEncoders);
  groups.videoDecoders = sortByName(groups.videoDecoders);
  return groups;
}

// Build the summary card for encoder/decoder counts.
function buildSummaryHtml(groups, totalEntries) {
  if (!totalEntries) {
    return "<div class=\"text-sm text-muted-foreground\">No codec entries detected from ffmpeg.</div>";
  }
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">Codec overview</p>
      <ul class="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
        <li>Total codec entries: <span class="font-medium text-foreground">${escapeHtml(totalEntries)}</span></li>
        <li>Video encoders: <span class="font-medium text-foreground">${escapeHtml(groups.videoEncoders.length)}</span></li>
        <li>Video decoders: <span class="font-medium text-foreground">${escapeHtml(groups.videoDecoders.length)}</span></li>
        <li>Audio encoders: <span class="font-medium text-foreground">${escapeHtml(groups.audioEncoders.length)}</span></li>
        <li>Audio decoders: <span class="font-medium text-foreground">${escapeHtml(groups.audioDecoders.length)}</span></li>
      </ul>
    </div>
  `;
}

// Build the HTML for a codec category block.
function buildCodecCategoryHtml(label, encoders, decoders) {
  if (!encoders.length && !decoders.length) {
    return `<div class="text-sm text-muted-foreground">No ${escapeHtml(label.toLowerCase())} codecs detected.</div>`;
  }
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">${escapeHtml(label)} codecs</p>
      <div class="grid gap-3 md:grid-cols-2">
        ${buildCodecListHtml("Encoders", encoders)}
        ${buildCodecListHtml("Decoders", decoders)}
      </div>
    </div>
  `;
}

// Build a list section for codecs with descriptions.
function buildCodecListHtml(title, items) {
  if (!items.length) {
    return `
      <div class="space-y-1">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">${escapeHtml(title)} (0)</div>
        <div class="text-sm text-muted-foreground">None found.</div>
      </div>
    `;
  }
  const listItems = items.map((item) => {
    const description = item.description ? ` — ${escapeHtml(item.description)}` : "";
    return `<li><span class="font-medium text-foreground">${escapeHtml(item.name)}</span><span class="text-muted-foreground">${description}</span></li>`;
  }).join("");
  return `
    <div class="space-y-1">
      <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">${escapeHtml(title)} (${escapeHtml(items.length)})</div>
      <ul class="list-disc pl-4 space-y-1 text-sm text-muted-foreground">${listItems}</ul>
    </div>
  `;
}

// Render the raw ffmpeg -codecs output as formatted text.
function buildRawOutputHtml(rawText) {
  if (!rawText) return "<div class=\"text-sm text-muted-foreground\">No raw output available.</div>";
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">Raw ffmpeg output</p>
      <pre class="text-[12px] leading-snug text-muted-foreground whitespace-pre-wrap break-words">${escapeHtml(rawText)}</pre>
    </div>
  `;
}

// Add entries without duplicating names in the same list.
function addUnique(list, entry) {
  if (!list.some((item) => item.name === entry.name)) list.push(entry);
}

// Sort codec entries alphabetically for stable output.
function sortByName(list) {
  return list.slice().sort((a, b) => a.name.localeCompare(b.name));
}

// Escape HTML entities to keep the output safe.
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
