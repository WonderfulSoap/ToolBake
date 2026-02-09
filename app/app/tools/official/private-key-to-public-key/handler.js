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

const MAX_FILE_SIZE = 2 * 1024 * 1024;

async function handler(inputWidgets, changedWidgetIds, callback) {
  // Only react to the private key input or initial execution.
  if (changedWidgetIds && changedWidgetIds !== "private-key-file") return {};

  const file = ensureSingleFile(inputWidgets["private-key-file"]);
  if (!file) {
    return {
      "key-info"      : "<div class='text-xs text-muted-foreground italic'>Awaiting private key...</div>",
      "public-key-pem": "",
      "download-link" : "",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Private key file exceeds 2MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

  const forge = await requirePackage("node-forge");
  const pemText = normalizePem(await readFileAsText(file));

  if (!pemText.includes("PRIVATE KEY")) {
    throw new Error("The uploaded file does not look like a PEM private key.");
  }

  const privateKey = forge.pki.privateKeyFromPem(pemText);
  const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
  const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
  const keyBits = typeof privateKey.n?.bitLength === "function" ? privateKey.n.bitLength() : undefined;

  console.log("private-key-to-public-key: loaded", { fileName: file.name, size: file.size, keyBits });

  return {
    "key-info"      : buildKeyInfoHtml(file, keyBits),
    "public-key-pem": publicKeyPem,
    "download-link" : buildDownloadHtml(publicKeyPem, buildPublicKeyFileName(file.name)),
  };
}

// Ensure FileUploadInput data resolves into a single file.
function ensureSingleFile(fileInput) {
  if (Array.isArray(fileInput)) return fileInput[0] || null;
  return fileInput || null;
}

// Read an uploaded file into a UTF-8 string.
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read the private key file."));
    reader.readAsText(file);
  });
}

// Normalize PEM line endings to reduce parsing issues.
function normalizePem(pemText) {
  return pemText.replace(/\r\n/g, "\n").trim();
}

// Build a compact key information block for the output label.
function buildKeyInfoHtml(file, keyBits) {
  const sizeLabel = `${(file.size / 1024).toFixed(2)} KB`;
  const bitsLabel = keyBits ? `${keyBits} bits` : "Unknown bits";
  return `
    <div class='text-sm leading-relaxed'>
      <div class='font-semibold text-foreground'>${file.name}</div>
      <div class='text-muted-foreground text-xs mt-1'>Size: ${sizeLabel} · RSA ${bitsLabel}</div>
    </div>`;
}

// Provide a download link that keeps the PEM intact.
function buildDownloadHtml(publicKeyPem, filename) {
  const blob = new Blob([publicKeyPem], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  return `<div class='text-sm leading-relaxed'><a class='font-medium text-primary underline underline-offset-2' href='${url}' download='${filename}'>Download ${filename}</a></div>`;
}

// Generate a stable output filename for the public key.
function buildPublicKeyFileName(fileName) {
  const base = fileName.replace(/\.(pem|key|txt)$/i, "");
  if (!base || base === fileName) return `public_key_${Date.now()}.pem`;
  return `${base}.pub.pem`;
}
