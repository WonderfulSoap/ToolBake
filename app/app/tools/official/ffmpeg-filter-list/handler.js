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
  // This tool has no inputs, so we only keep references to satisfy the handler signature.
  void inputWidgets;
  void changedWidgetIds;

  console.log("FFmpeg filter list: start scanning");

  if (!FFmpegModule) {
    console.log("FFmpeg filter list: loading ffmpeg package");
    FFmpegModule = await requirePackage("ffmpeg");
  }
  if (!ffmpeg) {
    callback({ scanProgress: buildProgressValue(10, "Loading", "Initializing ffmpeg.wasm") });
    ffmpeg = new FFmpegModule.FFmpeg();
    await ffmpeg.load_ffmpeg();
  }

  callback({ scanProgress: buildProgressValue(35, "Scanning", "Running ffmpeg -filters") });
  const rawOutput = await runFfmpegList(ffmpeg, ["-hide_banner", "-filters"]);
  console.log("FFmpeg filter list: raw output size", String(rawOutput || "").length);
  callback({ scanProgress: buildProgressValue(70, "Parsing", "Building filter tables") });

  const entries = parseFilterList(rawOutput);
  const groups = groupFilters(entries);
  console.log("FFmpeg filter list: parsed entries", entries.length);

  const summaryHtml = buildSummaryHtml(groups, entries.length);
  const audioHtml = buildFilterCategoryHtml("Audio", groups.audio, "A");
  const videoHtml = buildFilterCategoryHtml("Video", groups.video, "V");
  const sourceHtml = buildFilterCategoryHtml("Source/Sink", groups.sourceSink, "|");
  const otherHtml = buildFilterCategoryHtml("Other", groups.other, "N");
  const rawHtml = buildRawOutputHtml(rawOutput);

  return {
    scanProgress : buildProgressValue(100, "Completed", "Filter list ready"),
    summary      : summaryHtml,
    audioFilters : audioHtml,
    videoFilters : videoHtml,
    sourceFilters: sourceHtml,
    otherFilters : otherHtml,
    rawOutput    : rawHtml,
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

// Parse the `ffmpeg -filters` output into structured entries.
function parseFilterList(rawText) {
  const lines = String(rawText || "").split(/\r?\n/u);
  const entries = [];
  for (const line of lines) {
    // eslint-disable-next-line no-useless-escape
    const match = line.match(/^\s*([T\.])([S\.])([C\.])\s+(\S+)\s+([A-Z\|]+)->([A-Z\|]+)\s+(.*)$/u);
    if (!match) continue;
    const flags = buildFilterFlags(match[1], match[2], match[3]);
    entries.push({
      name       : match[4],
      inputTypes : match[5],
      outputTypes: match[6],
      description: match[7] || "",
      flags,
    });
  }
  return entries;
}

// Build the grouped filter buckets for summary and display sections.
function groupFilters(entries) {
  const groups = {
    audio     : [],
    video     : [],
    sourceSink: [],
    other     : [],
  };
  for (const entry of entries) {
    if (isSourceOrSink(entry)) {
      groups.sourceSink.push(entry);
      continue;
    }
    if (isAudioOnly(entry)) {
      groups.audio.push(entry);
      continue;
    }
    if (isVideoOnly(entry)) {
      groups.video.push(entry);
      continue;
    }
    groups.other.push(entry);
  }
  groups.audio = sortByName(groups.audio);
  groups.video = sortByName(groups.video);
  groups.sourceSink = sortByName(groups.sourceSink);
  groups.other = sortByName(groups.other);
  return groups;
}

// Build the summary card for filter counts.
function buildSummaryHtml(groups, totalEntries) {
  if (!totalEntries) {
    return "<div class=\"text-sm text-muted-foreground\">No filter entries detected from ffmpeg.</div>";
  }
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">Filter overview</p>
      <ul class="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
        <li>Total filter entries: <span class="font-medium text-foreground">${escapeHtml(totalEntries)}</span></li>
        <li>Audio-only filters: <span class="font-medium text-foreground">${escapeHtml(groups.audio.length)}</span></li>
        <li>Video-only filters: <span class="font-medium text-foreground">${escapeHtml(groups.video.length)}</span></li>
        <li>Source/Sink filters: <span class="font-medium text-foreground">${escapeHtml(groups.sourceSink.length)}</span></li>
        <li>Other filters: <span class="font-medium text-foreground">${escapeHtml(groups.other.length)}</span></li>
      </ul>
    </div>
  `;
}

// Build the HTML for a filter category block.
function buildFilterCategoryHtml(label, items, badgeLabel) {
  if (!items.length) {
    return `<div class="text-sm text-muted-foreground">No ${escapeHtml(label.toLowerCase())} filters detected.</div>`;
  }
  return `
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-sm font-semibold text-foreground">${escapeHtml(label)} filters</p>
        <span class="inline-flex items-center gap-1 rounded-sm bg-muted/60 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">${escapeHtml(badgeLabel)}</span>
        <span class="text-[11px] uppercase tracking-wide text-muted-foreground">${escapeHtml(items.length)} total</span>
      </div>
      <ul class="list-disc pl-4 space-y-2 text-sm text-muted-foreground">${buildFilterListHtml(items)}</ul>
    </div>
  `;
}

// Build the list entries for filters with flags and IO details.
function buildFilterListHtml(items) {
  return items.map((item) => {
    const ioText = `${item.inputTypes}->${item.outputTypes}`;
    const flagHtml = buildFlagBadgesHtml(item.flags);
    const description = item.description ? `<div class="text-[12px] text-muted-foreground">${escapeHtml(item.description)}</div>` : "";
    return `
      <li class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium text-foreground">${escapeHtml(item.name)}</span>
          <span class="text-[11px] uppercase tracking-wide text-muted-foreground">${escapeHtml(ioText)}</span>
          ${flagHtml}
        </div>
        ${description}
      </li>
    `;
  }).join("");
}

// Render the raw ffmpeg -filters output as formatted text.
function buildRawOutputHtml(rawText) {
  if (!rawText) return "<div class=\"text-sm text-muted-foreground\">No raw output available.</div>";
  return `
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">Raw ffmpeg output</p>
      <pre class="text-[12px] leading-snug text-muted-foreground whitespace-pre-wrap break-words">${escapeHtml(rawText)}</pre>
    </div>
  `;
}

// Build flags for timeline/slice/command support.
function buildFilterFlags(timelineFlag, sliceFlag, commandFlag) {
  const flags = [];
  if (timelineFlag === "T") flags.push("Timeline");
  if (sliceFlag === "S") flags.push("Slice");
  if (commandFlag === "C") flags.push("Command");
  return flags;
}

// Render flag badges for each filter entry.
function buildFlagBadgesHtml(flags) {
  if (!flags.length) return "";
  return flags.map((flag) => {
    return `<span class="inline-flex items-center gap-1 rounded-sm bg-muted/60 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">${escapeHtml(flag)}</span>`;
  }).join("");
}

// Check whether a filter is a source or sink based on IO symbols.
function isSourceOrSink(entry) {
  return entry.inputTypes.includes("|") || entry.outputTypes.includes("|");
}

// Check whether a filter is audio-only.
function isAudioOnly(entry) {
  return hasType(entry, "A") && !hasType(entry, "V");
}

// Check whether a filter is video-only.
function isVideoOnly(entry) {
  return hasType(entry, "V") && !hasType(entry, "A");
}

// Check whether the filter IO signature includes a specific type marker.
function hasType(entry, marker) {
  return entry.inputTypes.includes(marker) || entry.outputTypes.includes(marker);
}

// Sort filter entries alphabetically for stable output.
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
