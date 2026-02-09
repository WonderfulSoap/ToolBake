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

const DEFAULT_KEY_SIZE = 2048;
const MIN_KEY_SIZE = 1024;
const MAX_KEY_SIZE = 4096;
const KEY_EXPONENT = 0x10001;

async function handler(inputWidgets, changedWidgetIds, callback) {
  // Only generate keys when the user clicks the button.
  if (changedWidgetIds && changedWidgetIds !== "generate-button") return {};

  if (changedWidgetIds !== "generate-button") {
    return {
      "status-note"         : "<div class='text-xs text-muted-foreground italic'>Click Generate to create keys.</div>",
      "private-key-pem"     : "",
      "public-key-pem"      : "",
      "public-key-ssh"      : "",
      "download-private-pem": "",
      "download-public-pem" : "",
      "download-public-ssh" : "",
    };
  }

  const keySize = normalizeKeySize(inputWidgets["key-size"]);
  // Clear previous outputs before starting a new generation run.
  callback({ "status-note": buildStatusHtml(`Generating ${keySize}-bit RSA keys... This may take a while for larger sizes.`), "private-key-pem": "", "public-key-pem": "", "public-key-ssh": "", "download-private-pem": "", "download-public-pem": "", "download-public-ssh": "" });

  const forge = await requirePackage("node-forge");
  const keyPair = await generateKeyPairAsync(forge, keySize);
  const password = normalizePassword(inputWidgets["private-key-password"]);
  const privateKeyPem = password ? encryptPrivateKey(forge, keyPair.privateKey, password) : forge.pki.privateKeyToPem(keyPair.privateKey);
  const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);
  const comment = normalizeComment(inputWidgets["public-key-comment"]);
  const publicKeySsh = buildOpenSshPublicKey(forge, keyPair.publicKey, comment);

  console.log("rsa-keypair-generator: generated", { keySize });

  return {
    "status-note"         : buildStatusHtml(buildStatusMessage(keySize, password)),
    "private-key-pem"     : privateKeyPem,
    "public-key-pem"      : publicKeyPem,
    "public-key-ssh"      : publicKeySsh,
    "download-private-pem": buildPrivateKeyDownloadLabel(privateKeyPem, password),
    "download-public-pem" : buildDownloadLink(publicKeyPem, "public_key.pem", "application/x-pem-file"),
    "download-public-ssh" : buildDownloadLink(publicKeySsh, "public_key.pub", "text/plain"),
  };
}

// Normalize key size input while keeping it within accepted bounds.
function normalizeKeySize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_KEY_SIZE;
  if (parsed < MIN_KEY_SIZE) return MIN_KEY_SIZE;
  if (parsed > MAX_KEY_SIZE) return MAX_KEY_SIZE;
  return Math.round(parsed / 256) * 256;
}

// Build a short status label for the UI.
function buildStatusHtml(message) {
  return `<div class='text-xs text-muted-foreground'>${message}</div>`;
}

// Create download links for the generated PEM outputs.
function buildDownloadLink(content, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  return `<div class='text-sm leading-relaxed'><a class='font-medium text-primary underline underline-offset-2' href='${url}' download='${filename}'>Download ${filename}</a></div>`;
}

// Generate RSA keys asynchronously to avoid blocking the UI thread.
function generateKeyPairAsync(forge, keySize) {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair(
      { bits: keySize, e: KEY_EXPONENT, workers: 2 },
      (err, keyPair) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(keyPair);
      }
    );
  });
}

// Trim and normalize comment input for OpenSSH public key output.
function normalizeComment(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

// Trim and normalize password input for private key encryption.
function normalizePassword(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

// Encrypt the private key PEM using the provided password.
function encryptPrivateKey(forge, privateKey, password) {
  return forge.pki.encryptRsaPrivateKey(privateKey, password, { algorithm: "aes256" });
}

// Build a status message that explicitly indicates encryption when applied.
function buildStatusMessage(keySize, password) {
  const base = `Generated ${keySize}-bit RSA key pair.`;
  if (!password) return base;
  return `${base} Private key is encrypted.`;
}

// Provide a download link and OpenSSH conversion note for the private key.
function buildPrivateKeyDownloadLabel(privateKeyPem, password) {
  const downloadLink = buildDownloadLink(privateKeyPem, "private_key.pem", "application/x-pem-file");
  const formatNote = "This tool outputs a PEM (PKCS#1) private key and PEM/OpenSSH public keys.";
  const command = password
    ? "chmod 600 private_key.pem && ssh-keygen -p -m PEM -f private_key.pem -o -P \"your_password\" -N \"your_password\""
    : "chmod 600 private_key.pem && ssh-keygen -p -m PEM -f private_key.pem -o";
  const opensslCommand = password
    ? "chmod 600 private_key.pem && openssl pkey -in private_key.pem -out private_key.pkcs8.pem -passin pass:your_password"
    : "chmod 600 private_key.pem && openssl pkey -in private_key.pem -out private_key.pkcs8.pem";
  const passwordNote = password ? "Use the same password to keep the private key encrypted." : "";
  return `
    <div class='space-y-2'>
      ${downloadLink}
      <div class='text-xs leading-relaxed text-muted-foreground space-y-1'>
        <div>${formatNote}</div>
        <div>To convert the private key to OpenSSH format locally:</div>
        <div><code class='rounded bg-muted px-1 py-0.5 text-[12px] font-mono'>${command}</code></div>
        <div>OpenSSL converts to PKCS#8 PEM (still needs ssh-keygen for OpenSSH):</div>
        <div><code class='rounded bg-muted px-1 py-0.5 text-[12px] font-mono'>${opensslCommand}</code></div>
        ${passwordNote ? `<div>${passwordNote}</div>` : ""}
      </div>
    </div>`;
}

// Convert the generated public key into OpenSSH format when supported by node-forge.
function buildOpenSshPublicKey(forge, publicKey, comment) {
  if (!forge?.ssh?.publicKeyToOpenSSH) {
    throw new Error("OpenSSH export is not supported by the current node-forge build.");
  }
  return comment ? forge.ssh.publicKeyToOpenSSH(publicKey, comment) : forge.ssh.publicKeyToOpenSSH(publicKey);
}
