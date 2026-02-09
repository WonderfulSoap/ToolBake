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
 * @returns {Promise<HandlerReturnWidgets>}
 */

/**
 * Computes file hashes using the selected encoding.
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  const CryptoJS = await requirePackage("crypto-js");
  let file = inputWidgets.file_input;
  if (Array.isArray(file)) file = file[0];

  if (!file) return { file_status: buildIdleStatus(), hash_results: emptyHashResults() };

  const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024; // 20MB
  const isLargeFile = file.size > LARGE_FILE_THRESHOLD;

  // Show warning immediately if file is large
  if (isLargeFile) {
    callback({ file_status: buildProcessingStatus(file) });
  }

  try {
    const buffer = await readFileAsArrayBuffer(file);
    const wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(buffer));
    const encoding = inputWidgets.hash_encoding || "hex";
    const uppercaseOutput = inputWidgets.uppercase_output !== false;
    function encode(hash) { return encodeHash(hash, encoding, uppercaseOutput, CryptoJS); }
    return {
      file_status : buildFileStatus(file),
      hash_results: {
        md5      : encode(CryptoJS.MD5(wordArray)),
        sha1     : encode(CryptoJS.SHA1(wordArray)),
        sha224   : encode(CryptoJS.SHA224(wordArray)),
        sha256   : encode(CryptoJS.SHA256(wordArray)),
        sha384   : encode(CryptoJS.SHA384(wordArray)),
        sha512   : encode(CryptoJS.SHA512(wordArray)),
        sha3     : encode(CryptoJS.SHA3(wordArray)),
        ripemd160: encode(CryptoJS.RIPEMD160(wordArray)),
      },
    };
  } catch (err) {
    return { file_status: buildErrorStatus(err), hash_results: emptyHashResults() };
  }
}

/**
 * Reads a file into memory as an ArrayBuffer for hashing.
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error("Invalid file object"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Encodes the CryptoJS WordArray hash into the selected output format.
 */
function encodeHash(wordArray, encoding, uppercaseOutput, CryptoJS) {
  let result;
  if (encoding === "bin") {
    result = wordArray
      .toString(CryptoJS.enc.Hex)
      .split("")
      .map(h => parseInt(h, 16).toString(2).padStart(4, "0"))
      .join("");
  } else if (encoding === "hex") {
    result = wordArray.toString(CryptoJS.enc.Hex);
  } else if (encoding === "base64") {
    result = CryptoJS.enc.Base64.stringify(wordArray);
  } else if (encoding === "base64_safe") {
    result = CryptoJS.enc.Base64.stringify(wordArray).replace(/=+$/, "");
  } else {
    throw Error(`Unknown encoding selected: '${encoding}'`);
  }

  // Apply uppercase conversion if enabled
  return uppercaseOutput ? result.toUpperCase() : result;
}

/**
 * Provides a stable empty output payload for the MultiText widget.
 */
function emptyHashResults() {
  return { md5: "", sha1: "", sha224: "", sha256: "", sha384: "", sha512: "", sha3: "", ripemd160: "" };
}

/**
 * Builds the idle state message when no file is selected.
 */
function buildIdleStatus() {
  return "<div class='text-xs text-muted-foreground italic'>Awaiting file. Max size depends on your browser runtime resources.</div>";
}

/**
 * Builds a processing status message shown immediately for large files.
 */
function buildProcessingStatus(file) {
  return `
    <div class='flex flex-col gap-1'>
      <div class='text-sm font-medium text-foreground truncate' title='${file.name}'>${file.name}</div>
      <div class='text-xs text-muted-foreground'>${formatBytes(file.size)}</div>
      <div class='text-xs text-yellow-600 font-medium'>⚠ Large file detected. Hashing in progress, this may take a long time...</div>
    </div>
  `;
}

/**
 * Builds a file information summary after hashing completes.
 */
function buildFileStatus(file) {
  return `
    <div class='flex flex-col gap-1'>
      <div class='text-sm font-medium text-foreground truncate' title='${file.name}'>${file.name}</div>
      <div class='text-xs text-muted-foreground'>${formatBytes(file.size)}</div>
    </div>
  `;
}

/**
 * Builds a status message for unexpected hashing errors.
 */
function buildErrorStatus(error) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return `<div class='text-xs text-destructive font-medium'>Error: ${message}</div>`;
}

/**
 * Formats byte counts into human-friendly strings.
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
