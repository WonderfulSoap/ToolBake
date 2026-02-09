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
  const archiveFile = pickFile(inputWidgets.archiveFile);
  const outputFormat = normalizeFormat(inputWidgets.outputFormat || "zip");
  const password = normalizePassword(inputWidgets.archivePassword);
  const isExecute = changedWidgetIds === "convertButton";

  if (!archiveFile) {
    return { status: buildEmptyStatus(), progress: buildEmptyProgress(), download: buildEmptyDownload(), rawOutput: buildEmptyRawOutput() };
  }

  if (!isExecute) {
    return {
      status   : buildReadyStatus({ archiveFile, outputFormat, password }),
      progress : buildReadyProgress(),
      download : buildEmptyDownload(),
      rawOutput: buildEmptyRawOutput(),
    };
  }

  console.log("Archive conversion requested:", archiveFile.name || "(unnamed)", "->", outputFormat);

  const logState = createLogState();
  const heartbeat = startLogHeartbeat(logState, callback);
  callback({
    status   : buildRunningStatus("Preparing 7-Zip worker..."),
    progress : buildProgressState(5, "Preparing", "Starting the 7-Zip worker."),
    download : buildEmptyDownload(),
    rawOutput: buildEmptyRawOutput(),
  });

  const createSevenZipWorker = await requirePackage("7z-worker");
  const sevenZip = await createSevenZipWorker({
    onLog: function handleLog(payload) {
      console.log("[archive-format-converter] 7z-worker", payload);
      appendLogLine(logState, payload);
      const percent = parseProgressPercent(payload.text);
      if (percent !== null) {
        const label = logState.stage === "extract" ? "Extracting" : logState.stage === "compress" ? "Compressing" : "Working";
        callback({ progress: buildProgressState(percent, label, "7-Zip progress update.") });
      }
      callback({ status: buildRunningStatusWithLog(`${labelForStage(logState.stage)}...`, logState), rawOutput: buildLiveRawOutputHtml(logState) });
    },
  });
  const archiveName = buildArchiveName(archiveFile.name);
  const outputName = buildOutputName(archiveFile.name, outputFormat);
  const workDir = buildWorkDir();

  let extractResult = null;
  let createResult = null;

  try {
    const archiveBytes = new Uint8Array(await archiveFile.arrayBuffer());
    await sevenZip.FS.writeFile(archiveName, archiveBytes);
    await safeMkdir(sevenZip, workDir);

    logState.stage = "extract";
    callback({ status: buildRunningStatusWithLog("Extracting archive contents...", logState), progress: buildProgressState(25, "Extracting", "Unpacking the archive.") });
    extractResult = await sevenZip.callMain(buildExtractArgs(archiveName, workDir, password));
    console.log("[archive-format-converter] Extract result:", extractResult);
    if (extractResult.exitCode !== 0) {
      return {
        status   : buildErrorStatus("Extraction failed. Check the password or archive format.", extractResult),
        progress : buildErrorProgress("Extraction failed."),
        download : buildEmptyDownload(),
        rawOutput: buildRawOutputHtml(extractResult, null),
      };
    }

    logState.stage = "compress";
    callback({ status: buildRunningStatusWithLog("Re-compressing archive...", logState), progress: buildProgressState(70, "Compressing", "Building the output archive.") });
    console.log("[archive-format-converter] Compress args:", buildCompressArgs(outputName, outputFormat, workDir));
    createResult = await sevenZip.callMain(buildCompressArgs(outputName, outputFormat, workDir));
    console.log("[archive-format-converter] Create result:", createResult);
    if (createResult.exitCode !== 0) {
      return {
        status   : buildErrorStatus("Re-compression failed. Try another output format.", createResult),
        progress : buildErrorProgress("Re-compression failed."),
        download : buildEmptyDownload(),
        rawOutput: buildRawOutputHtml(extractResult, createResult),
      };
    }

    const outputBytes = await sevenZip.FS.readFile(outputName);
    if (!outputBytes || outputBytes.length === 0) {
      return {
        status   : buildErrorStatus("Output archive was not generated.", createResult),
        progress : buildErrorProgress("Output archive was not generated."),
        download : buildEmptyDownload(),
        rawOutput: buildRawOutputHtml(extractResult, createResult),
      };
    }

    const downloadUrl = URL.createObjectURL(new Blob([outputBytes]));
    const statusHtml = buildSuccessStatus({
      archiveFile,
      outputFormat,
      password,
      outputName,
      outputSize: outputBytes.length,
    });

    return {
      status   : statusHtml,
      progress : buildProgressState(100, "Done", "Conversion completed."),
      download : buildDownloadHtml(downloadUrl, outputName, outputBytes.length),
      rawOutput: buildRawOutputHtml(extractResult, createResult),
      __cleanup: function cleanup() { URL.revokeObjectURL(downloadUrl); },
    };
  } finally {
    heartbeat.stop();
    await safeUnlink(sevenZip, archiveName);
    await safeUnlink(sevenZip, outputName);
    await removeDirRecursive(sevenZip, workDir);
    sevenZip.terminate();
  }
}

/**
 * Normalize the output format selection.
 */
function normalizeFormat(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return FORMAT_DEFINITIONS[normalized] ? normalized : "zip";
}

/**
 * Normalize the optional password input to a trimmed string.
 */
function normalizePassword(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : "";
}

/**
 * Accepts either a single file or an array and returns the first file.
 */
function pickFile(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Generate a safe virtual filename for the 7-Zip filesystem.
 */
function buildArchiveName(name) {
  const safeName = (name || "archive").split(/[\\/]+/).pop() || "archive";
  const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : "";
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `archive-${nonce}${ext}`;
}

/**
 * Build a unique working directory name for extraction.
 */
function buildWorkDir() {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `work-${nonce}`;
}

/**
 * Build the output archive name based on selected format.
 */
function buildOutputName(originalName, format) {
  const definition = resolveFormatDefinition(format);
  const baseName = stripArchiveExtension(originalName || "archive") || "archive";
  return `${baseName}${definition.extension}`;
}

/**
 * Resolve the worker factory from a mixed ESM/CJS module shape.
 */

/**
 * Strip common archive extensions from the original file name.
 */
function stripArchiveExtension(name) {
  const safeName = (name || "archive").split(/[\\/]+/).pop() || "archive";
  const withoutCompound = safeName.replace(/\.(tar\.gz|tar\.bz2|tar\.xz)$/i, "");
  return withoutCompound.replace(/\.(zip|7z|rar|tar|gz|bz2|xz)$/i, "");
}

/**
 * Map the output format to 7-Zip arguments.
 */
function resolveFormatDefinition(format) {
  return FORMAT_DEFINITIONS[format] || FORMAT_DEFINITIONS.zip;
}

/**
 * Build arguments for 7-Zip extraction.
 */
function buildExtractArgs(archiveName, workDir, password) {
  const args = ["x", "-y", "-bb1", "-bso1", "-bse1", "-bsp1", `-o${workDir}`];
  if (password) args.push(`-p${password}`);
  args.push(archiveName);
  return args;
}

/**
 * Build arguments for 7-Zip compression.
 */
function buildCompressArgs(outputName, format, workDir) {
  const definition = resolveFormatDefinition(format);
  const args = ["a", "-r", "-bb1", "-bso1", "-bse1", "-bsp1", `-t${definition.type}`];
  args.push(outputName, `${workDir}/*`);
  return args;
}

/**
 * Ensure a directory exists without failing if it already does.
 */
async function safeMkdir(sevenZip, path) {
  try {
    await sevenZip.FS.mkdir(path);
  } catch (error) {
    if (!String(error || "").includes("EEXIST")) throw error;
  }
}

/**
 * Remove a file if it exists.
 */
async function safeUnlink(sevenZip, path) {
  try {
    await sevenZip.FS.unlink(path);
  } catch (error) {
    if (!String(error || "").includes("ENOENT")) throw error;
  }
}

/**
 * Recursively remove a working directory and its contents.
 */
async function removeDirRecursive(sevenZip, dirPath) {
  try {
    const entries = await sevenZip.FS.readdir(dirPath);
    for (const entry of entries) {
      if (entry === "." || entry === "..") continue;
      const fullPath = `${dirPath}/${entry}`;
      const stat = await sevenZip.FS.stat(fullPath);
      if (isDirMode(stat.mode)) await removeDirRecursive(sevenZip, fullPath);
      else await safeUnlink(sevenZip, fullPath);
    }
    await sevenZip.FS.rmdir(dirPath);
  } catch (error) {
    if (!String(error || "").includes("ENOENT")) throw error;
  }
}

/**
 * Check if the mode flag represents a directory.
 */
function isDirMode(mode) {
  return (mode & 0o170000) === 0o040000;
}

/**
 * Build the empty status block shown before any file is uploaded.
 */
function buildEmptyStatus() {
  return "<div class='text-xs text-muted-foreground italic'>Upload an archive, pick a format, then click Convert.</div>";
}

/**
 * Build the empty progress state before execution.
 */
function buildEmptyProgress() {
  return buildProgressState(0, "Awaiting conversion", "Upload an archive to begin.");
}

/**
 * Render the empty download block shown before conversion.
 */
function buildEmptyDownload() {
  return "<div class='text-xs text-muted-foreground italic'>No converted archive yet.</div>";
}

/**
 * Render the empty 7-Zip output block.
 */
function buildEmptyRawOutput() {
  return "<div class='text-xs text-muted-foreground italic'>7-Zip output will appear after conversion.</div>";
}

/**
 * Build a ready state message before executing the conversion.
 */
function buildReadyStatus({ archiveFile, outputFormat, password }) {
  const formatLabel = resolveFormatDefinition(outputFormat).label;
  const passwordLabel = password ? "Password provided" : "No password";
  return `
    <div class='flex flex-col gap-1 text-xs text-muted-foreground'>
      <div>Archive: <span class='font-medium text-foreground'>${escapeHtml(archiveFile.name || "(unnamed)")}</span> (${formatBytes(archiveFile.size || 0)})</div>
      <div>Output: <span class='font-medium text-foreground'>${escapeHtml(formatLabel)}</span></div>
      <div>Password: <span class='font-medium text-foreground'>${escapeHtml(passwordLabel)}</span></div>
      <div class='text-[11px] text-muted-foreground'>Click Convert to rebuild the archive.</div>
    </div>
  `;
}

/**
 * Build a ready progress state when awaiting user execution.
 */
function buildReadyProgress() {
  return buildProgressState(0, "Ready", "Click Convert to start.");
}

/**
 * Build a success status summary after conversion.
 */
function buildSuccessStatus({ archiveFile, outputFormat, password, outputName, outputSize }) {
  const formatLabel = resolveFormatDefinition(outputFormat).label;
  const passwordLabel = password ? "Input password provided" : "No input password";
  return `
    <div class='flex flex-col gap-1 text-xs text-muted-foreground'>
      <div>Source: <span class='font-medium text-foreground'>${escapeHtml(archiveFile.name || "(unnamed)")}</span> (${formatBytes(archiveFile.size || 0)})</div>
      <div>Output: <span class='font-medium text-foreground'>${escapeHtml(outputName)}</span> (${formatBytes(outputSize || 0)})</div>
      <div>Format: <span class='font-medium text-foreground'>${escapeHtml(formatLabel)}</span> · ${escapeHtml(passwordLabel)}</div>
      <div class='text-[11px] text-muted-foreground'>Download the converted archive below.</div>
    </div>
  `;
}

/**
 * Build a progress payload for the progress bar widget.
 */
function buildProgressState(percent, label, hint) {
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 0;
  return { current: safePercent, total: 100, percent: safePercent, label: label, hint: hint };
}

/**
 * Build a progress payload for failure cases.
 */
function buildErrorProgress(message) {
  return buildProgressState(0, "Failed", message);
}

/**
 * Build a running status message for long tasks.
 */
function buildRunningStatus(message) {
  return `
    <div class='flex flex-col gap-1 text-xs text-muted-foreground'>
      <div class='font-medium text-foreground'>${escapeHtml(message)}</div>
      <div class='text-[11px] text-muted-foreground'>Processing may take a moment for large archives.</div>
    </div>
  `;
}

/**
 * Build an error status summary with exit code and hints.
 */
function buildErrorStatus(message, result) {
  const exitCode = result ? Number(result.exitCode) || 0 : 0;
  return `
    <div class='flex flex-col gap-1 text-xs text-muted-foreground'>
      <div class='text-destructive font-medium'>${escapeHtml(message)}</div>
      <div>Exit code: <span class='font-medium text-foreground'>${escapeHtml(exitCode)}</span></div>
      <div class='text-[11px] text-muted-foreground'>Review the 7-Zip log for details.</div>
    </div>
  `;
}

/**
 * Build a download link for the converted archive.
 */
function buildDownloadHtml(url, filename, size) {
  return `
    <div class='flex flex-col gap-1 text-sm leading-relaxed'>
      <a class='font-medium text-primary underline underline-offset-2' href='${url}' download='${escapeHtml(filename)}'>Download ${escapeHtml(filename)}</a>
      <div class='text-xs text-muted-foreground'>${formatBytes(size || 0)}</div>
    </div>
  `;
}

/**
 * Render combined stdout/stderr output for debugging.
 */
function buildRawOutputHtml(extractResult, createResult) {
  const outputText = buildCombinedOutput(extractResult, createResult);
  if (!outputText) return "<div class='text-xs text-muted-foreground italic'>No 7-Zip output.</div>";
  return `<pre class='text-xs font-mono whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/40 p-3'>${escapeHtml(outputText)}</pre>`;
}

/**
 * Render a live log panel while the worker is running.
 */
function buildLiveRawOutputHtml(logState) {
  if (!logState.latestLine) return buildEmptyRawOutput();
  return `<pre class='text-xs font-mono whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/40 p-3'>${escapeHtml(logState.latestLine)}</pre>`;
}

/**
 * Build a mutable log buffer for streaming output.
 */
function createLogState() {
  return { lastLogAt: Date.now(), stage: "", latestLine: "" };
}

/**
 * Append a worker log payload into the log buffer with control-char handling.
 */
function appendLogLine(logState, payload) {
  const stream = payload.stream === "stderr" ? "stderr" : "stdout";
  const prefix = stream === "stderr" ? "[stderr]" : "[stdout]";
  const text = String(payload.text || "");
  logState.lastLogAt = Date.now();
  logState.latestLine = `${prefix} ${text}`.trimEnd();
}

/**
 * Parse a percentage value from a raw 7-Zip output chunk.
 */
function parseProgressPercent(text) {
  const matches = String(text || "").match(/(\\d{1,3})%/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const value = Number(last.replace("%", ""));
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/**
 * Emit periodic UI updates when logs go quiet during long compression.
 */
function startLogHeartbeat(logState, callback) {
  const intervalId = setInterval(function tick() {
    const idleMs = Date.now() - logState.lastLogAt;
    if (idleMs < 1500) return;
    callback({
      status   : buildRunningStatusWithLog("Compressing... no new logs yet.", logState),
      rawOutput: buildLiveRawOutputHtml(logState),
    });
  }, 1500);
  return { stop: function stop() { clearInterval(intervalId); } };
}

/**
 * Build a running status message with the latest 7-Zip log line.
 */
function buildRunningStatusWithLog(message, logState) {
  const logLine = logState && logState.latestLine ? escapeHtml(logState.latestLine) : "No log output yet.";
  return `
    <div class='flex flex-col gap-1 text-xs text-muted-foreground'>
      <div class='font-medium text-foreground'>${escapeHtml(message)}</div>
      <div class='text-[11px] text-muted-foreground'>Processing may take a moment for large archives.</div>
      <div class='rounded-sm border border-border/40 bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground/80'>${logLine}</div>
    </div>
  `;
}

/**
 * Create a friendly label for the current worker stage.
 */
function labelForStage(stage) {
  if (stage === "extract") return "Extracting";
  if (stage === "compress") return "Compressing";
  return "Working";
}

/**
 * Merge stdout/stderr into a single block with exit code details.
 */
function buildCombinedOutput(extractResult, createResult) {
  const blocks = [];
  if (extractResult) {
    blocks.push("[extract]", `Exit code: ${Number(extractResult.exitCode) || 0}`);
    if (extractResult.stdout) blocks.push("", extractResult.stdout);
    if (extractResult.stderr) blocks.push("", extractResult.stderr);
  }
  if (createResult) {
    blocks.push("", "[compress]", `Exit code: ${Number(createResult.exitCode) || 0}`);
    if (createResult.stdout) blocks.push("", createResult.stdout);
    if (createResult.stderr) blocks.push("", createResult.stderr);
  }
  return blocks.join("\n").trim();
}

/**
 * Escape HTML for safe label rendering.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format bytes into a readable size string.
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

const FORMAT_DEFINITIONS = {
  zip : { type: "zip", extension: ".zip", label: "ZIP" },
  "7z": { type: "7z", extension: ".7z", label: "7Z" },
  tar : { type: "tar", extension: ".tar", label: "TAR" },
  gz  : { type: "gzip", extension: ".gz", label: "GZ" },
  bz2 : { type: "bzip2", extension: ".bz2", label: "BZ2" },
  xz  : { type: "xz", extension: ".xz", label: "XZ" },
};
