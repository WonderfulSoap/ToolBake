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
  const encoding = normalizeEncoding(inputWidgets.nameEncoding || "auto");
  const password = normalizePassword(inputWidgets.archivePassword);
  if (!archiveFile) return { status: buildEmptyStatus(), fileList: buildEmptyFileList() };

  console.log("Listing archive contents:", archiveFile.name || "(unnamed)", "encoding:", encoding);

  const sevenZip = await getSevenZip();
  const archiveBytes = new Uint8Array(await archiveFile.arrayBuffer());
  const archiveName = buildArchiveName(archiveFile.name);
  writeFileToSevenZipFS(sevenZip, archiveName, archiveBytes);

  let listResult = null;
  try {
    // Await list execution because 7z-wasm may return a Promise for callMain.
    listResult = await runSevenZipList(sevenZip, archiveName, password, encoding);
  } finally {
    // Explicitly ignore cleanup result to satisfy no-floating-promises.
    void safeUnlink(sevenZip, archiveName);
  }

  const parseResult = parseListOutput(listResult.stdout);
  const passwordState = resolvePasswordState({
    stdout             : listResult.stdout,
    stderr             : listResult.stderr,
    exitCode           : listResult.exitCode,
    hasEncryptedEntries: parseResult.hasEncryptedEntries,
    password,
  });

  const statusHtml = buildStatusHtml({
    archiveFile,
    encoding,
    entries : parseResult.entries,
    passwordState,
    exitCode: listResult.exitCode,
    stderr  : listResult.stderr,
  });
  const fileListHtml = buildFileListHtml(parseResult.entries, passwordState);
  const rawOutputHtml = buildRawOutputHtml(listResult.stdout, listResult.stderr, listResult.exitCode);

  return { status: statusHtml, fileList: fileListHtml, rawOutput: rawOutputHtml };
}

let sevenZipPromise = null;

/**
 * Lazily load 7z-wasm once per session to avoid re-initialization overhead.
 */
async function getSevenZip() {
  if (!sevenZipPromise) {
    sevenZipPromise = (async function loadSevenZip() {
      const SevenZipFactory = await requirePackage("7z-wasm");
      const capture = { stdout: [], stderr: [], active: false };
      const module = await SevenZipFactory({
        print   : function handleStdout(text) { if (capture.active) capture.stdout.push(String(text)); },
        printErr: function handleStderr(text) { if (capture.active) capture.stderr.push(String(text)); },
      });
      module.__capture = capture;
      return module;
    })();
  }
  return sevenZipPromise;
}

/**
 * Normalize the encoding selection for downstream decoding.
 */
function normalizeEncoding(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "auto";
}

/**
 * Map user-selected encoding names to 7-Zip code page numbers.
 */
function resolveCodePage(encoding) {
  const mapping = {
    "utf-8"       : 65001,
    "gbk"         : 936,
    "big5"        : 950,
    "shift_jis"   : 932,
    "euc-kr"      : 949,
    "cp437"       : 437,
    "windows-1251": 1251,
  };
  return mapping[encoding] ?? null;
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
 * Generate a safe virtual filename for the 7z-wasm filesystem.
 */
function buildArchiveName(name) {
  const safeName = (name || "archive").split(/[\\/]+/).pop() || "archive";
  const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : "";
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `archive-${nonce}${ext}`;
}

/**
 * Write the archive bytes into the in-memory 7z-wasm filesystem.
 */
function writeFileToSevenZipFS(sevenZip, archiveName, bytes) {
  sevenZip.FS.writeFile(archiveName, bytes);
}

/**
 * Clean up the virtual file to keep the WASM filesystem small.
 */
function safeUnlink(sevenZip, archiveName) {
  const existing = sevenZip.FS.analyzePath(archiveName);
  if (existing.exists) sevenZip.FS.unlink(archiveName);
}

/**
 * Execute a 7z list command and capture stdout/stderr output.
 */
async function runSevenZipList(sevenZip, archiveName, password, encoding) {
  const args = buildListArgs(archiveName, password, encoding);
  return await captureSevenZipOutput(sevenZip, args);
}

/**
 * Build arguments for listing archive contents in structured format.
 */
function buildListArgs(archiveName, password, encoding) {
  const args = ["l", "-slt", "-mcu-"];
  const codePage = resolveCodePage(encoding);
  if (codePage) args.push(`-mcp=${codePage}`);
  if (password) args.push(`-p${password}`);
  args.push(archiveName);
  return args;
}

/**
 * Capture 7z-wasm console output so it can be parsed later.
 */
async function captureSevenZipOutput(sevenZip, args) {
  const capture = sevenZip.__capture;
  capture.stdout = [];
  capture.stderr = [];
  capture.active = true;
  let exitCode = 0;
  try {
    // Normalize synchronous or async return values from callMain.
    exitCode = Number(await sevenZip.callMain(args));
  } finally {
    capture.active = false;
  }

  return { exitCode, stdout: capture.stdout.join("\n"), stderr: capture.stderr.join("\n") };
}

/**
 * Decode output text based on the selected filename encoding.
 */
/**
 * Parse 7z -slt output into a list of entries.
 */
function parseListOutput(output) {
  const lines = String(output || "").split(/\r?\n/);
  const entries = [];
  let hasEncryptedEntries = false;
  let inEntries = false;
  let current = null;

  for (const line of lines) {
    if (line.startsWith("----------")) {
      inEntries = true;
      continue;
    }
    if (!inEntries) continue;

    if (line.startsWith("Path = ")) {
      if (current) entries.push(current);
      current = { path: line.slice(7).trim(), folder: false, encrypted: false, size: null };
      continue;
    }
    if (!current) continue;

    if (line.startsWith("Folder = +")) current.folder = true;
    if (line.startsWith("Encrypted = +")) {
      current.encrypted = true;
      hasEncryptedEntries = true;
    }
    if (line.startsWith("Size = ")) {
      const sizeValue = Number(line.slice(7).trim());
      if (Number.isFinite(sizeValue)) current.size = sizeValue;
    }
  }
  if (current) entries.push(current);

  const normalizedEntries = entries.filter(entry => entry.path);
  return { entries: normalizedEntries, hasEncryptedEntries };
}

/**
 * Determine whether the archive requires a password based on 7z output.
 */
function resolvePasswordState({ stdout, stderr, exitCode, hasEncryptedEntries, password }) {
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  const passwordHints = [
    "enter password",
    "wrong password",
    "incorrect password",
    "encrypted archive",
    "can not open encrypted",
    "headers error",
    "password is incorrect",
  ];
  const hintMatch = passwordHints.some(hint => combined.includes(hint));
  const wrongPassword = Boolean(password) && /wrong password|incorrect password|password is incorrect/.test(combined);
  const requiresPassword = !password && (hintMatch || exitCode !== 0 && combined.includes("password"));

  return {
    passwordProvided: Boolean(password),
    requiresPassword,
    wrongPassword,
    hasEncryptedEntries,
  };
}

/**
 * Build the status HTML summary shown to the user.
 */
function buildStatusHtml({ archiveFile, encoding, entries, passwordState, exitCode, stderr }) {
  const entryCount = entries.length;
  const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  const passwordLabel = resolvePasswordLabel(passwordState);
  const passwordTone = passwordState.wrongPassword || passwordState.requiresPassword ? "text-destructive" : "text-foreground";
  const errorHint = buildErrorHint(exitCode, stderr, passwordState);

  return `
    <div class='flex flex-col gap-1 text-xs text-muted-foreground'>
      <div>Archive: <span class='font-medium text-foreground'>${escapeHtml(archiveFile.name || "(unnamed)")}</span> (${formatBytes(archiveFile.size || 0)})</div>
      <div>Entries: <span class='font-medium text-foreground'>${entryCount}</span> · Total size: <span class='font-medium text-foreground'>${formatBytes(totalSize)}</span></div>
      <div>Filename encoding: <span class='font-medium text-foreground'>${escapeHtml(encodingLabel(encoding))}</span></div>
      <div>Password: <span class='font-medium ${passwordTone}'>${escapeHtml(passwordLabel)}</span></div>
      ${errorHint}
    </div>
  `;
}

/**
 * Translate the password state to a readable label.
 */
function resolvePasswordLabel(passwordState) {
  if (passwordState.wrongPassword) return "Incorrect password";
  if (passwordState.requiresPassword) return "Password required";
  if (passwordState.hasEncryptedEntries) return passwordState.passwordProvided ? "Encrypted entries unlocked" : "Encrypted entries detected";
  return passwordState.passwordProvided ? "Password supplied" : "No password detected";
}

/**
 * Provide a short error hint when 7z returns a non-zero exit code.
 */
function buildErrorHint(exitCode, stderr, passwordState) {
  if (exitCode === 0 || passwordState.requiresPassword || passwordState.wrongPassword) return "";
  const hint = String(stderr || "").trim();
  const label = hint ? escapeHtml(hint.split(/\r?\n/)[0]) : "Archive listing returned a warning.";
  return `<div class='text-[11px] text-yellow-600'>${label}</div>`;
}

/**
 * Render the file list as a monospaced block.
 */
function buildFileListHtml(entries, passwordState) {
  if (!entries.length) {
    if (passwordState.requiresPassword) {
      return "<div class='text-xs text-muted-foreground italic'>Enter the archive password to list files.</div>";
    }
    return "<div class='text-xs text-muted-foreground italic'>No files listed yet.</div>";
  }
  const rows = entries.map(entry => buildEntryRow(entry)).join("");
  return `
    <div class='rounded-md border border-border/40 bg-muted/40 overflow-hidden'>
      <table class='w-full table-auto text-xs'>
        <thead class='border-b border-border/40 bg-muted/60 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
          <tr>
            <th class='px-3 py-2 text-left'>Path</th>
            <th class='px-3 py-2 text-left'>Flag</th>
            <th class='px-3 py-2 text-right'>Size</th>
          </tr>
        </thead>
        <tbody class='divide-y divide-border/40'>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Build a single entry row for the output table.
 */
function buildEntryRow(entry) {
  const name = entry.folder && !entry.path.endsWith("/") ? `${entry.path}/` : entry.path;
  const sizeLabel = entry.size != null ? formatBytes(entry.size) : "-";
  const flags = buildEntryFlags(entry);
  return `
    <tr>
      <td class='px-3 py-2'>
        <div class='truncate font-mono' title='${escapeHtml(name)}'>${escapeHtml(name)}</div>
      </td>
      <td class='px-3 py-2'>
        <div class='text-[11px] text-muted-foreground'>${escapeHtml(flags)}</div>
      </td>
      <td class='px-3 py-2 text-right font-mono text-muted-foreground'>${escapeHtml(sizeLabel)}</td>
    </tr>
  `;
}

/**
 * Compose readable flags for a file entry.
 */
function buildEntryFlags(entry) {
  const flags = [];
  if (entry.folder) flags.push("DIR");
  if (entry.encrypted) flags.push("ENCRYPTED");
  return flags.length ? flags.join(" · ") : "—";
}

/**
 * Render full 7z stdout/stderr output for debugging.
 */
function buildRawOutputHtml(stdout, stderr, exitCode) {
  const outputText = buildCombinedOutput(stdout, stderr, exitCode);
  if (!outputText) return "<div class='text-xs text-muted-foreground italic'>No 7-Zip output.</div>";
  return `<pre class='text-xs font-mono whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/40 p-3'>${escapeHtml(outputText)}</pre>`;
}

/**
 * Merge stdout/stderr into a single block with exit code details.
 */
function buildCombinedOutput(stdout, stderr, exitCode) {
  const lines = [];
  lines.push(`Exit code: ${Number(exitCode) || 0}`);
  if (stdout) lines.push("", "[stdout]", String(stdout));
  if (stderr) lines.push("", "[stderr]", String(stderr));
  return lines.join("\n").trim();
}

/**
 * Format a single entry line for the list output.
 */
function formatEntryLine(entry) {
  const name = entry.folder && !entry.path.endsWith("/") ? `${entry.path}/` : entry.path;
  const sizeLabel = entry.size != null ? ` (${formatBytes(entry.size)})` : "";
  const encryptedLabel = entry.encrypted ? " [encrypted]" : "";
  return `${name}${sizeLabel}${encryptedLabel}`;
}

/**
 * Build the empty status block shown before any file is uploaded.
 */
function buildEmptyStatus() {
  return "<div class='text-xs text-muted-foreground italic'>Upload a single archive to list its contents.</div>";
}

/**
 * Build the empty list block shown before any file is uploaded.
 */
function buildEmptyFileList() {
  return "<div class='text-xs text-muted-foreground italic'>Awaiting archive file...</div>";
}

/**
 * Provide a human readable label for the encoding selection.
 */
function encodingLabel(encoding) {
  if (!encoding || encoding === "auto") return "Auto";
  return encoding.toUpperCase();
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
