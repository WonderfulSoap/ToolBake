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

const KEY_SIZE_BITS = 256;

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
  callback({ "status-note": buildStatusHtml(`Generating ${keySize}-bit ED25519 keys...`), "private-key-pem": "", "public-key-pem": "", "public-key-ssh": "", "download-private-pem": "", "download-public-pem": "", "download-public-ssh": "" });

  const forge = await requirePackage("node-forge");
  const keyPair = generateEd25519KeyPair(forge);
  const password = normalizePassword(inputWidgets["private-key-password"]);
  const privateKeyPem = buildEd25519PrivateKeyPem(forge, keyPair.privateKey, password);
  const publicKeyPem = buildEd25519PublicKeyPem(forge, keyPair.publicKey);
  const comment = normalizeComment(inputWidgets["public-key-comment"]);
  const publicKeySsh = buildEd25519OpenSshPublicKey(forge, keyPair.publicKey, comment);

  console.log("ed25519-keypair-generator: generated", { keySize });

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

// Clamp the key size to the fixed ED25519 size.
function normalizeKeySize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return KEY_SIZE_BITS;
  return KEY_SIZE_BITS;
}

// Build a short status label for the UI.
function buildStatusHtml(message) {
  return `<div class='text-xs text-muted-foreground'>${message}</div>`;
}

// Create download links for the generated outputs.
function buildDownloadLink(content, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  return `<div class='text-sm leading-relaxed'><a class='font-medium text-primary underline underline-offset-2' href='${url}' download='${filename}'>Download ${filename}</a></div>`;
}

// Generate an ED25519 key pair in memory.
function generateEd25519KeyPair(forge) {
  return forge.pki.ed25519.generateKeyPair();
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

// Build a status message that explicitly indicates encryption when applied.
function buildStatusMessage(keySize, password) {
  const base = `Generated ${keySize}-bit ED25519 key pair.`;
  if (!password) return base;
  return `${base} Private key is encrypted.`;
}

// Provide a download link and OpenSSH conversion note for the private key.
function buildPrivateKeyDownloadLabel(privateKeyPem, password) {
  const downloadLink = buildDownloadLink(privateKeyPem, "private_key.pem", "application/x-pem-file");
  const formatNote = "This tool outputs a PEM (PKCS#8) private key and PEM/OpenSSH public keys.";
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

// Convert ed25519 private key bytes into a PKCS#8 PEM, encrypted if needed.
function buildEd25519PrivateKeyPem(forge, privateKeyBytes, password) {
  const privateKeyInfo = buildEd25519PrivateKeyInfo(forge, privateKeyBytes);
  if (!password) return forge.pki.privateKeyInfoToPem(privateKeyInfo);
  const encryptedInfo = forge.pki.encryptPrivateKeyInfo(privateKeyInfo, password, { algorithm: "aes256" });
  return forge.pki.encryptedPrivateKeyToPem(encryptedInfo);
}

// Convert ed25519 public key bytes into a PEM SubjectPublicKeyInfo.
function buildEd25519PublicKeyPem(forge, publicKeyBytes) {
  const publicKeyInfo = buildEd25519PublicKeyInfo(forge, publicKeyBytes);
  const derBytes = forge.asn1.toDer(publicKeyInfo).getBytes();
  return forge.pem.encode({ type: "PUBLIC KEY", body: derBytes });
}

// Build the RFC8410 PrivateKeyInfo structure for ed25519.
function buildEd25519PrivateKeyInfo(forge, privateKeyBytes) {
  const asn1 = forge.asn1;
  const privateKeySeed = bytesToBinaryString(privateKeyBytes.slice(0, 32));
  const innerOctet = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, privateKeySeed);
  const innerDer = asn1.toDer(innerOctet).getBytes();
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, String.fromCharCode(0)),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(forge.oids.EdDSA25519).getBytes())
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, innerDer)
  ]);
}

// Build the SubjectPublicKeyInfo structure for ed25519.
function buildEd25519PublicKeyInfo(forge, publicKeyBytes) {
  const asn1 = forge.asn1;
  const publicKeyBinary = String.fromCharCode(0) + bytesToBinaryString(publicKeyBytes);
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(forge.oids.EdDSA25519).getBytes())
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false, publicKeyBinary)
  ]);
}

// Convert a Uint8Array/Buffer into a binary string for ASN.1 encoding.
function bytesToBinaryString(bytes) {
  let result = "";
  for (let i = 0; i < bytes.length; i += 1) result += String.fromCharCode(bytes[i]);
  return result;
}

// Build an OpenSSH public key string for ed25519.
function buildEd25519OpenSshPublicKey(forge, publicKeyBytes, comment) {
  const type = "ssh-ed25519";
  const buffer = forge.util.createBuffer();
  addStringToBuffer(buffer, type);
  addBytesToBuffer(buffer, publicKeyBytes);
  const body = forge.util.encode64(buffer.bytes());
  return comment ? `${type} ${body} ${comment}` : `${type} ${body}`;
}

// Add length-prefixed string data into the SSH buffer.
function addStringToBuffer(buffer, value) {
  buffer.putInt32(value.length);
  buffer.putBytes(value);
}

// Add length-prefixed raw bytes into the SSH buffer.
function addBytesToBuffer(buffer, bytes) {
  buffer.putInt32(bytes.length);
  buffer.putBytes(bytesToBinaryString(bytes));
}
