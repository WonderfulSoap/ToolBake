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
  const audioFiles = normalizeInputFiles(inputWidgets.audioFiles);
  if (changedWidgetIds && ARTWORK_FILE_OUTPUT_MAP[changedWidgetIds]) {
    const outputId = ARTWORK_FILE_OUTPUT_MAP[changedWidgetIds];
    const file = normalizeInputFile(inputWidgets[changedWidgetIds]);
    return {
      [outputId]: await buildArtworkPreviewFromFile(file),
    };
  }
  if (!audioFiles.length) return buildEmptyResponse();
  if (changedWidgetIds === "metadataCore") return {};
  if (changedWidgetIds === "metadataOutput") return {};
  if (changedWidgetIds === "outputNameTemplate") return {};
  if (changedWidgetIds && !ALLOWED_WIDGET_IDS.includes(changedWidgetIds)) return {};

  if (changedWidgetIds === "audioFiles") {
    callback({
      metadataCore     : buildEmptyCoreInput(),
      metadataOutput   : "",
      downloadOutput   : buildDownloadPlaceholderHtml(),
      artworkFrontFile : null,
      artworkBackFile  : null,
      artworkDiscFile  : null,
      artworkArtistFile: null,
      artworkIconFile  : null,
    });
  }

  if (!FFmpegModule) FFmpegModule = await requirePackage("ffmpeg");
  if (!ffmpeg) {
    ffmpeg = new FFmpegModule.FFmpeg();
    await ffmpeg.load_ffmpeg();
  }

  if (changedWidgetIds === "editTrigger") {
    const coreInput = normalizeRecord(inputWidgets.metadataCore);
    const otherInput = normalizeText(inputWidgets.metadataOutput);
    const artworkInputs = {
      front : normalizeInputFile(inputWidgets.artworkFrontFile),
      back  : normalizeInputFile(inputWidgets.artworkBackFile),
      disc  : normalizeInputFile(inputWidgets.artworkDiscFile),
      artist: normalizeInputFile(inputWidgets.artworkArtistFile),
      icon  : normalizeInputFile(inputWidgets.artworkIconFile),
    };
    const nameTemplate = normalizeText(inputWidgets.outputNameTemplate);
    const editedFiles = await applyMetadataEdits(ffmpeg, audioFiles, coreInput, otherInput, artworkInputs, nameTemplate);
    return {
      downloadOutput: buildDownloadHtml(editedFiles),
    };
  }

  const metadataSnapshots = [];
  const artworkSlots = buildArtworkSlotState();
  for (let index = 0; index < audioFiles.length; index += 1) {
    const file = audioFiles[index];
    const inputName = ensureInputName(file.name, index);
    const outputName = `ffprobe-${index}.json`;

    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    await ffmpeg.ffprobe([
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "-i",
      inputName,
      "-o",
      outputName,
    ]);
    const outputBuffer = await ffmpeg.readFile(outputName);
    const probeData = parseProbeJson(outputBuffer);
    metadataSnapshots.push(extractFormatTags(probeData));
    await ffmpeg.deleteFile(outputName);

    const attachedStreams = extractAttachedPicStreams(probeData);
    for (const stream of attachedStreams) {
      const slot = resolveArtworkSlot(stream.tags);
      if (!slot || artworkSlots[slot]?.dataUrl) continue;
      const artwork = await extractArtwork(ffmpeg, inputName, stream, slot, index);
      if (artwork) artworkSlots[slot] = { ...artwork, fileName: file.name || `Audio ${index + 1}` };
    }

    await ffmpeg.deleteFile(inputName);
  }

  const metadataSummary = buildMetadataSummary(metadataSnapshots);

  return {
    metadataCore  : metadataSummary.coreFields,
    metadataOutput: metadataSummary.otherText,
    artworkFront  : buildArtworkHtml(artworkSlots.front),
    artworkBack   : buildArtworkHtml(artworkSlots.back),
    artworkDisc   : buildArtworkHtml(artworkSlots.disc),
    artworkArtist : buildArtworkHtml(artworkSlots.artist),
    artworkIcon   : buildArtworkHtml(artworkSlots.icon),
    downloadOutput: buildDownloadPlaceholderHtml(),
  };
}

// Cache the ffmpeg module and instance to avoid repeated wasm initialization.
let FFmpegModule;
let ffmpeg;

// Normalize FilesUploadInput payloads to a stable array.
function normalizeInputFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item instanceof Blob);
  if (value instanceof Blob) return [value];
  return [];
}

// Normalize FileUploadInput payloads to a single Blob or null.
function normalizeInputFile(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  if (value instanceof Blob) return value;
  return null;
}

// Normalize simple text input values.
function normalizeText(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
}

// Normalize record-like widget payloads.
function normalizeRecord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

// Ensure ffmpeg input names are safe and have extensions.
function ensureInputName(name, index) {
  const safeName = sanitizeFileName(name, `audio-${index + 1}.mp3`);
  return safeName.includes(".") ? safeName : `${safeName}.mp3`;
}

// Sanitize file names for ffmpeg virtual FS usage.
function sanitizeFileName(value, fallback) {
  const raw = String(value || "").split(/[\\/]/).pop() || "";
  const cleaned = raw.replace(/\s+/g, " ").replace(/["']/g, "").trim();
  return cleaned || fallback;
}

// Parse ffprobe JSON output into a usable object.
function parseProbeJson(buffer) {
  const text = new TextDecoder("utf-8").decode(buffer);
  return JSON.parse(text || "{}");
}

// Extract format tags from ffprobe results with normalized keys.
function extractFormatTags(probeData) {
  const tags = probeData && typeof probeData === "object" ? probeData.format && probeData.format.tags : null;
  const result = {};
  if (!tags || typeof tags !== "object") return result;
  for (const key of Object.keys(tags)) {
    const normalized = normalizeTagKey(key);
    result[normalized] = formatTagValue(tags[key]);
  }
  return result;
}

// Normalize metadata keys for consistent presentation.
function normalizeTagKey(key) {
  return String(key || "").trim().toUpperCase();
}

// Format tag values with a default placeholder when empty.
function formatTagValue(value) {
  const text = String(value ?? "").trim();
  return text ? text : "";
}

// Build the metadata output with core fields separated from the rest.
function buildMetadataSummary(tagSnapshots) {
  const normalizedSnapshots = tagSnapshots || [];
  const keys = collectMetadataKeys(normalizedSnapshots);
  const coreFields = buildCoreMetadataFields(normalizedSnapshots);
  if (!keys.size) return { coreFields, otherText: "" };
  const remainingKeys = Array.from(keys).filter((key) => !CORE_METADATA_KEYS.includes(key)).sort();
  if (!remainingKeys.length) return { coreFields, otherText: "" };
  const fileCount = normalizedSnapshots.length;
  const lines = remainingKeys.map((key) => {
    const values = normalizedSnapshots.map((snapshot) => formatTagValue(snapshot ? snapshot[key] : ""));
    const displayValue = buildDisplayValue(values, fileCount);
    return `${key}: ${displayValue}`;
  });
  return {
    coreFields,
    otherText: lines.join("\n"),
  };
}

// Collect metadata keys across multiple ffprobe snapshots.
function collectMetadataKeys(tagSnapshots) {
  const keys = new Set();
  for (const snapshot of tagSnapshots) {
    Object.keys(snapshot || {}).forEach((key) => keys.add(key));
  }
  return keys;
}

// Build the MultiTextInput payload for the core metadata fields.
function buildCoreMetadataFields(tagSnapshots) {
  const output = {};
  const fileCount = tagSnapshots.length;
  CORE_METADATA_KEYS.forEach((key) => {
    const id = CORE_METADATA_ID_MAP[key];
    const values = tagSnapshots.map((snapshot) => formatTagValue(snapshot ? snapshot[key] : ""));
    output[id] = buildDisplayValue(values, fileCount);
  });
  return output;
}

// Extract only the attached picture streams from ffprobe output.
function extractAttachedPicStreams(probeData) {
  const streams = extractStreams(probeData);
  return streams.filter((stream) => toNumber(stream && stream.disposition && stream.disposition.attached_pic) === 1);
}

// Extract stream array from ffprobe payload safely.
function extractStreams(probeData) {
  if (!probeData || typeof probeData !== "object") return [];
  const streams = probeData.streams;
  return Array.isArray(streams) ? streams : [];
}

// Resolve the most appropriate artwork slot from stream tags.
function resolveArtworkSlot(tags) {
  const label = buildArtworkLabel(tags);
  if (!label) return "front";
  if (label.includes("front")) return "front";
  if (label.includes("back")) return "back";
  if (label.includes("disc") || label.includes("cd") || label.includes("media")) return "disc";
  if (label.includes("artist") || label.includes("performer")) return "artist";
  if (label.includes("icon") || label.includes("logo")) return "icon";
  if (label.includes("cover")) return "front";
  return "front";
}

// Build a single lowercase label from available tag fields.
function buildArtworkLabel(tags) {
  if (!tags || typeof tags !== "object") return "";
  const parts = [tags.title, tags.comment, tags.description, tags.filename].filter(Boolean);
  return parts.join(" ").toLowerCase();
}

// Extract artwork image data from an attached pic stream.
async function extractArtwork(ffmpegInstance, inputName, stream, slot, index) {
  const streamIndex = Number(stream && stream.index);
  if (!Number.isFinite(streamIndex)) return null;
  const extension = resolveImageExtension(stream.tags);
  const outputName = `${slot}-${index + 1}-${streamIndex}.${extension}`;
  await ffmpegInstance.exec(["-i", inputName, "-map", `0:${streamIndex}`, "-frames:v", "1", "-c", "copy", outputName]);
  const buffer = await ffmpegInstance.readFile(outputName);
  await ffmpegInstance.deleteFile(outputName);
  const mimeType = resolveImageMimeType(stream.tags, extension);
  return { dataUrl: buildDataUrl(buffer, mimeType), mimeType };
}

// Resolve file extensions for common embedded image types.
function resolveImageExtension(tags) {
  const mime = String(tags && tags.mimetype || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("bmp")) return "bmp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  const filename = String(tags && tags.filename || "").toLowerCase();
  if (filename.includes(".")) return filename.split(".").pop() || "jpg";
  return "jpg";
}

// Resolve mime types from tags or file extensions.
function resolveImageMimeType(tags, extension) {
  const mime = String(tags && tags.mimetype || "").toLowerCase();
  if (mime) return mime;
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "bmp") return "image/bmp";
  return "image/jpeg";
}

// Build data URLs from ffmpeg buffers.
function buildDataUrl(buffer, mimeType) {
  const base64 = bufferToBase64(buffer);
  return `data:${mimeType};base64,${base64}`;
}

// Convert Uint8Array data into a base64 string.
function bufferToBase64(buffer) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Build HTML for each artwork slot output.
function buildArtworkHtml(artwork) {
  const imageBlock = artwork && artwork.dataUrl
    ? `<div class="w-full h-28 rounded-sm border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden"><img src="${artwork.dataUrl}" class="max-h-24 max-w-full object-contain" /></div>`
    : "<div class=\"w-full h-28 rounded-sm border border-dashed border-border/60 bg-muted/20 flex items-center justify-center text-[11px] text-muted-foreground\">No image detected</div>";
  return `<div class="flex flex-col items-center gap-2">${imageBlock}</div>`;
}

// Build placeholder output when no files are selected.
function buildEmptyResponse() {
  return {
    metadataCore  : buildCoreMetadataFields([]),
    metadataOutput: "",
    artworkFront  : buildArtworkHtml(null),
    artworkBack   : buildArtworkHtml(null),
    artworkDisc   : buildArtworkHtml(null),
    artworkArtist : buildArtworkHtml(null),
    artworkIcon   : buildArtworkHtml(null),
    downloadOutput: buildDownloadPlaceholderHtml(),
  };
}

// Parse numeric values safely.
function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
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

// Create the initial artwork slot map.
function buildArtworkSlotState() {
  return {
    front : null,
    back  : null,
    disc  : null,
    artist: null,
    icon  : null,
  };
}

const CORE_METADATA_KEYS = [
  "ALBUM",
  "ALBUM_ARTIST",
  "ARTIST",
  "COMMENT",
  "COMPOSER",
  "DATE",
  "GENRE",
  "PERFORMER",
  "TITLE",
  "TRACK",
  "TRACKTOTAL",
  "DISC",
  "DISCTOTAL",
];

const CORE_METADATA_ID_MAP = {
  ALBUM       : "album",
  ALBUM_ARTIST: "albumArtist",
  ARTIST      : "artist",
  COMMENT     : "comment",
  COMPOSER    : "composer",
  DATE        : "date",
  GENRE       : "genre",
  PERFORMER   : "performer",
  TITLE       : "title",
  TRACK       : "track",
  TRACKTOTAL  : "trackTotal",
  DISC        : "disc",
  DISCTOTAL   : "discTotal",
};

// Build per-file metadata tags by splitting multi-file values.
function buildMetadataTagsForIndex(coreInput, otherText, index, fileCount) {
  const tags = {};
  CORE_METADATA_KEYS.forEach((key) => {
    const id = CORE_METADATA_ID_MAP[key];
    const rawValue = normalizeText(coreInput[id]);
    const resolved = resolveIndexedValue(rawValue, index, fileCount);
    if (resolved) tags[mapMetadataKey(key)] = resolved;
  });
  parseOtherMetadataText(otherText).forEach((item) => {
    const resolved = resolveIndexedValue(item.value, index, fileCount);
    if (item.key && resolved) tags[mapMetadataKey(item.key)] = resolved;
  });
  return tags;
}

// Parse KEY: VALUE lines into a normalized array.
function parseOtherMetadataText(text) {
  const lines = String(text || "").split(/\r?\n/u);
  const results = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^([^:]+):(.*)$/u);
    if (!match) return;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!key) return;
    results.push({ key, value });
  });
  return results;
}

// Apply metadata and artwork edits to every selected audio file.
async function applyMetadataEdits(ffmpegInstance, audioFiles, coreInput, otherText, artworkInputs, nameTemplate) {
  const outputs = [];
  const artworkEntries = buildArtworkEntries(artworkInputs);
  const fileCount = audioFiles.length;
  for (let index = 0; index < audioFiles.length; index += 1) {
    const file = audioFiles[index];
    const inputName = ensureInputName(file.name, index);
    const outputName = buildEditedOutputName(file.name, index);
    await ffmpegInstance.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    const probeResult = await inspectAudioMetadata(ffmpegInstance, inputName, index);
    const stagedArtworks = await stageArtworkInputs(ffmpegInstance, artworkEntries, index);
    const metadataTags = buildMetadataTagsForIndex(coreInput, otherText, index, fileCount);
    const resolvedOutputName = buildOutputNameFromTemplate(nameTemplate, file, probeResult.formatTags, index);
    const args = buildMetadataCommandArgs(
      inputName,
      resolvedOutputName,
      stagedArtworks,
      probeResult.attachedPictures,
      metadataTags
    );
    await ffmpegInstance.exec(args);
    const outputBuffer = await ffmpegInstance.readFile(resolvedOutputName);
    await cleanupStagedFiles(ffmpegInstance, [inputName, resolvedOutputName, ...stagedArtworks.map((item) => item.name)]);
    outputs.push(buildDownloadEntry(resolvedOutputName, outputBuffer));
  }
  return outputs;
}

// Build a list of artwork entries from user input.
function buildArtworkEntries(artworkInputs) {
  return [
    buildArtworkEntry("front", "Front Cover", artworkInputs.front),
    buildArtworkEntry("back", "Back Cover", artworkInputs.back),
    buildArtworkEntry("disc", "Disc", artworkInputs.disc),
    buildArtworkEntry("artist", "Artist", artworkInputs.artist),
    buildArtworkEntry("icon", "Icon", artworkInputs.icon),
  ].filter((entry) => entry);
}

// Normalize artwork entry metadata.
function buildArtworkEntry(slot, label, file) {
  if (!file) return null;
  const extension = resolveImageExtensionFromFile(file);
  const mimeType = file.type || resolveImageMimeTypeFromExtension(extension);
  const fileName = `${slot}.${extension}`;
  return { slot, label, file, extension, mimeType, fileName };
}

// Resolve image extension from file metadata.
function resolveImageExtensionFromFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.includes(".")) return name.split(".").pop() || "jpg";
  if (file?.type) {
    const typeExt = file.type.split("/").pop();
    if (typeExt) return typeExt.toLowerCase();
  }
  return "jpg";
}

// Resolve image mime types from file extensions.
function resolveImageMimeTypeFromExtension(extension) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "bmp") return "image/bmp";
  return "image/jpeg";
}

// Build artwork preview HTML from a newly selected image file.
async function buildArtworkPreviewFromFile(file) {
  if (!file) return buildArtworkHtml(null);
  const extension = resolveImageExtensionFromFile(file);
  const mimeType = file.type || resolveImageMimeTypeFromExtension(extension);
  const buffer = new Uint8Array(await file.arrayBuffer());
  return buildArtworkHtml({ dataUrl: buildDataUrl(buffer, mimeType), mimeType });
}

// Stage artwork inputs into the ffmpeg FS.
async function stageArtworkInputs(ffmpegInstance, artworkEntries, index) {
  const staged = [];
  for (let i = 0; i < artworkEntries.length; i += 1) {
    const entry = artworkEntries[i];
    const name = `artwork-${entry.slot}-${index + 1}.${entry.extension}`;
    await ffmpegInstance.writeFile(name, new Uint8Array(await entry.file.arrayBuffer()));
    staged.push({ ...entry, name });
  }
  return staged;
}

// Build ffmpeg args for metadata updates and artwork attachments.
function buildMetadataCommandArgs(inputName, outputName, stagedArtworks, attachedPictures, metadataTags) {
  const args = ["-y", "-i", inputName];
  stagedArtworks.forEach((artwork) => args.push("-i", artwork.name));
  const slotOverrides = new Set(stagedArtworks.map((artwork) => artwork.slot));
  const keptPictures = (attachedPictures || []).filter((pic) => !slotOverrides.has(pic.slot));
  args.push("-map", "0:a");
  keptPictures.forEach((pic) => args.push("-map", `0:${pic.streamIndex}`));
  stagedArtworks.forEach((artwork, index) => args.push("-map", `${index + 1}:0`));
  args.push("-map_metadata", "0");
  Object.keys(metadataTags || {}).forEach((key) => {
    args.push("-metadata", `${key}=${metadataTags[key]}`);
  });
  stagedArtworks.forEach((artwork, index) => {
    const streamIndex = keptPictures.length + index;
    const typeLabel = ARTWORK_TYPE_LABELS[artwork.slot] || "Cover (front)";
    args.push("-metadata:s:v:" + streamIndex, `title=${artwork.label}`);
    args.push("-metadata:s:v:" + streamIndex, `comment=${typeLabel}`);
    args.push("-metadata:s:v:" + streamIndex, `description=${typeLabel}`);
    args.push("-metadata:s:v:" + streamIndex, `mimetype=${artwork.mimeType}`);
    args.push("-metadata:s:v:" + streamIndex, `filename=${artwork.fileName}`);
    args.push("-disposition:v:" + streamIndex, "attached_pic");
  });
  args.push("-c", "copy", outputName);
  return args;
}

// Inspect attached picture streams and keep original format tags for templating.
async function inspectAudioMetadata(ffmpegInstance, inputName, index) {
  const probeOutput = `ffprobe-edit-${index}.json`;
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
  await ffmpegInstance.deleteFile(probeOutput);
  const probeData = parseProbeJson(outputBuffer);
  const attachedPictures = extractStreams(probeData)
    .filter((stream) => toNumber(stream && stream.disposition && stream.disposition.attached_pic) === 1)
    .map((stream) => ({
      streamIndex: Number(stream.index),
      slot       : resolveArtworkSlot(stream.tags),
    }));
  return {
    attachedPictures,
    formatTags: extractFormatTags(probeData),
  };
}

// Clean up staged files after ffmpeg execution.
async function cleanupStagedFiles(ffmpegInstance, names) {
  for (const name of names) {
    if (!name) continue;
    await ffmpegInstance.deleteFile(name);
  }
}

// Build a download entry for the edited file.
function buildDownloadEntry(fileName, buffer) {
  const mimeType = resolveAudioMimeType(fileName);
  const url = buildObjectUrl(buffer, mimeType);
  return {
    fileName,
    url,
    mimeType,
    sizeLabel: formatBytes(buffer.length || 0),
  };
}

// Build the download list HTML.
function buildDownloadHtml(entries) {
  if (!entries.length) return buildDownloadPlaceholderHtml();
  const items = entries.map((entry) => {
    return `
      <li class="flex items-center justify-between gap-3 rounded-sm border border-border/60 bg-muted/30 px-3 py-2">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-foreground truncate" title="${escapeHtml(entry.fileName)}">${escapeHtml(entry.fileName)}</div>
          <div class="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center rounded-sm bg-muted/60 px-1.5 py-0.5 uppercase tracking-wide">${escapeHtml(entry.mimeType)}</span>
            <span>${escapeHtml(entry.sizeLabel)}</span>
          </div>
        </div>
        <a class="text-sm font-semibold text-primary underline underline-offset-2" href="${entry.url}" download="${escapeHtml(entry.fileName)}" data-download-file="true">Download</a>
      </li>
    `;
  }).join("");
  return `
    <div class="space-y-2" data-download-container="true">
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">Generated files</span>
        <a
          class="text-sm font-semibold text-primary underline underline-offset-2"
          href="#"
          onclick="(function(el){var root=el.closest(&quot;[data-download-container]&quot;);if(!root)return false;var links=root.querySelectorAll(&quot;a[data-download-file]&quot;);links.forEach(function(link,index){setTimeout(function(){link.click();},index*150);});return false;})(this)"
        >
          Download All
        </a>
      </div>
      <ul class="space-y-2">${items}</ul>
    </div>
  `;
}

// Build placeholder output HTML for downloads.
function buildDownloadPlaceholderHtml() {
  return "<div class='text-xs text-muted-foreground italic'>Click Apply Edits to generate downloadable files.</div>";
}

// Resolve audio MIME types from file extension.
function resolveAudioMimeType(fileName) {
  const ext = String(fileName || "").toLowerCase().split(".").pop();
  if (ext === "flac") return "audio/flac";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "opus") return "audio/opus";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  return "audio/mpeg";
}

// Build an object URL from a Uint8Array buffer.
function buildObjectUrl(fileContent, mime) {
  const blob = new Blob([fileContent], { type: mime });
  return URL.createObjectURL(blob);
}

// Format byte sizes into human-friendly strings.
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exp);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exp]}`;
}

// Build the output name for edited files.
function buildEditedOutputName(name, index) {
  const safeName = sanitizeFileName(name, `audio-${index + 1}.mp3`);
  const dotIndex = safeName.lastIndexOf(".");
  if (dotIndex > 0) return `${safeName.slice(0, dotIndex)}-edited${safeName.slice(dotIndex)}`;
  return `${safeName}-edited.mp3`;
}

// Build file names from a user template and original metadata tags.
function buildOutputNameFromTemplate(template, file, formatTags, index) {
  const fallback = buildEditedOutputName(file?.name, index);
  const rawTemplate = normalizeText(template);
  if (!rawTemplate) return fallback;
  const originalName = sanitizeFileName(file?.name, `audio-${index + 1}.mp3`);
  const extension = resolveFileExtension(originalName, "mp3");
  const templateValues = buildTemplateValueMap(formatTags, originalName);
  const resolved = renderTemplate(rawTemplate, templateValues);
  const sanitized = sanitizeFileName(resolved, `audio-${index + 1}`);
  if (!sanitized) return fallback;
  if (sanitized.includes(".")) return sanitized;
  return `${sanitized}.${extension}`;
}

// Resolve placeholders in {token} format, falling back to literal text for unknown tokens.
function renderTemplate(template, values) {
  return String(template || "").replace(/\{([^{}]+)\}/g, (match, token) => {
    const key = String(token || "").trim().toLowerCase();
    if (!key) return match;
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    return values[key];
  });
}

// Build a map of supported placeholders with normalized original metadata.
function buildTemplateValueMap(formatTags, originalName) {
  const map = { filename: originalName };
  CORE_METADATA_KEYS.forEach((key) => {
    const value = formatTagValue(formatTags?.[key]);
    const normalized = normalizeTemplateValue(value);
    const snake = key.toLowerCase();
    map[snake] = normalized;
  });
  map.album_artists = map.album_artist ?? "";
  map.track_total = map.tracktotal ?? "";
  map.disc_total = map.disctotal ?? "";
  return map;
}

// Normalize template values to safe file-name segments.
function normalizeTemplateValue(value) {
  const raw = String(value ?? "").replace(/[\\/]/g, " ").replace(/["']/g, "").trim();
  return raw.replace(/\s+/g, " ");
}

// Resolve file extension with a fallback.
function resolveFileExtension(name, fallback) {
  const ext = String(name || "").split(".").pop();
  if (!ext || ext === name) return fallback;
  return ext.toLowerCase();
}

const ARTWORK_TYPE_LABELS = {
  front : "Cover (front)",
  back  : "Cover (back)",
  disc  : "Media (e.g. label side of CD)",
  artist: "Artist/performer",
  icon  : "Other file icon",
};

const ARTWORK_FILE_OUTPUT_MAP = {
  artworkFrontFile : "artworkFront",
  artworkBackFile  : "artworkBack",
  artworkDiscFile  : "artworkDisc",
  artworkArtistFile: "artworkArtist",
  artworkIconFile  : "artworkIcon",
};

const ALLOWED_WIDGET_IDS = ["audioFiles", "editTrigger", "outputNameTemplate", ...Object.keys(ARTWORK_FILE_OUTPUT_MAP)];

// Map core metadata keys to Vorbis-style tag names for better player compatibility.
function mapMetadataKey(key) {
  const normalized = String(key || "").trim().toUpperCase();
  return METADATA_KEY_MAP[normalized] || normalized;
}

const METADATA_KEY_MAP = {
  ALBUM_ARTIST: "album_artist",
  COMMENT     : "comment",
  TRACK       : "track",
  DISC        : "disc",
};

// Build a clean core metadata payload with blank values.
function buildEmptyCoreInput() {
  const output = {};
  CORE_METADATA_KEYS.forEach((key) => {
    output[CORE_METADATA_ID_MAP[key]] = "";
  });
  return output;
}

// Split multi-file values while keeping single-file values intact.
function resolveIndexedValue(value, index, fileCount) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "-") return "";
  if (!Number.isFinite(fileCount) || fileCount <= 1) return trimmed;
  const parts = trimmed.split(",").map((part) => part.trim());
  if (!parts.length) return "";
  if (parts.length >= fileCount) {
    const selected = parts[index] ?? parts[parts.length - 1] ?? "";
    return selected === "-" ? "" : selected;
  }
  const fallback = parts[index] ?? parts[parts.length - 1] ?? "";
  return fallback === "-" ? "" : fallback;
}

// Build display values for multi-file metadata fields.
function buildDisplayValue(values, fileCount) {
  if (!values.length) return "-";
  if (!Number.isFinite(fileCount) || fileCount <= 1) return formatDisplayValue(values[0]);
  const normalized = values.map((value) => normalizeDisplayValue(value));
  const allSame = normalized.every((value) => value === normalized[0]);
  if (allSame) return formatDisplayValue(normalized[0]);
  return normalized.map((value) => formatDisplayValue(value)).join(",");
}

// Normalize values to compare empties consistently.
function normalizeDisplayValue(value) {
  return String(value ?? "").trim();
}

// Format display values so empty fields show "-".
function formatDisplayValue(value) {
  const normalized = normalizeDisplayValue(value);
  return normalized ? normalized : "-";
}
