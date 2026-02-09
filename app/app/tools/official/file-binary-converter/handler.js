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

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SLOW_THRESHOLD = 5 * 1024 * 1024;

function fileToBinary(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target.result);
      const binaryArray = [];
      for (let i = 0; i < bytes.length; i++) {
        binaryArray.push(bytes[i].toString(2).padStart(8, "0"));
      }
      resolve(binaryArray.join(" "));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function fileToOctal(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target.result);
      const octalArray = [];
      for (let i = 0; i < bytes.length; i++) {
        octalArray.push(bytes[i].toString(8).padStart(3, "0"));
      }
      resolve(octalArray.join(" "));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function fileToDecimal(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target.result);
      const decimalArray = [];
      for (let i = 0; i < bytes.length; i++) {
        decimalArray.push(bytes[i].toString(10));
      }
      resolve(decimalArray.join(" "));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function fileToHexadecimal(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target.result);
      const hexArray = [];
      for (let i = 0; i < bytes.length; i++) {
        hexArray.push(bytes[i].toString(16).padStart(2, "0").toUpperCase());
      }
      resolve(hexArray.join(" "));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function isValidBinary(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[01]{1,8}$/.test(word)) {
      throw new Error("Binary input must contain 1-8 digit binary numbers (0-255)");
    }
    if (parseInt(word, 2) > 255) {
      throw new Error("Binary values must not exceed 255");
    }
  }
  return true;
}

function isValidOctal(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[0-7]{1,3}$/.test(word)) {
      throw new Error("Octal input must contain 1-3 digit octal numbers (0-377)");
    }
    if (parseInt(word, 8) > 255) {
      throw new Error("Octal values must not exceed 377 (255 in decimal)");
    }
  }
  return true;
}

function isValidDecimal(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[0-9]{1,3}$/.test(word)) {
      throw new Error("Decimal input must contain 1-3 digit numbers (0-255)");
    }
    const num = parseInt(word, 10);
    if (num < 0 || num > 255) {
      throw new Error("Decimal values must be between 0 and 255");
    }
  }
  return true;
}

function isValidHexadecimal(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[0-9A-Fa-f]{1,2}$/.test(word)) {
      throw new Error("Hexadecimal input must contain 1-2 digit hex numbers (00-FF)");
    }
    if (parseInt(word, 16) > 255) {
      throw new Error("Hexadecimal values must not exceed FF (255 in decimal)");
    }
  }
  return true;
}

function binaryToBytes(binaryStr) {
  const words = binaryStr.trim().split(/\s+/);
  return new Uint8Array(words.map(word => parseInt(word, 2)));
}

function octalToBytes(octalStr) {
  const words = octalStr.trim().split(/\s+/);
  return new Uint8Array(words.map(word => parseInt(word, 8)));
}

function decimalToBytes(decimalStr) {
  const words = decimalStr.trim().split(/\s+/);
  return new Uint8Array(words.map(word => parseInt(word, 10)));
}

function hexadecimalToBytes(hexStr) {
  const words = hexStr.trim().split(/\s+/);
  return new Uint8Array(words.map(word => parseInt(word, 16)));
}

function bytesToBinary(bytes) {
  const binaryArray = [];
  for (let i = 0; i < bytes.length; i++) {
    binaryArray.push(bytes[i].toString(2).padStart(8, "0"));
  }
  return binaryArray.join(" ");
}

function bytesToOctal(bytes) {
  const octalArray = [];
  for (let i = 0; i < bytes.length; i++) {
    octalArray.push(bytes[i].toString(8).padStart(3, "0"));
  }
  return octalArray.join(" ");
}

function bytesToDecimal(bytes) {
  const decimalArray = [];
  for (let i = 0; i < bytes.length; i++) {
    decimalArray.push(bytes[i].toString(10));
  }
  return decimalArray.join(" ");
}

function bytesToHexadecimal(bytes) {
  const hexArray = [];
  for (let i = 0; i < bytes.length; i++) {
    hexArray.push(bytes[i].toString(16).padStart(2, "0").toUpperCase());
  }
  return hexArray.join(" ");
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function generateDownloadLink(bytes, filename) {
  const blob = new Blob([bytes]);
  const dataUrl = URL.createObjectURL(blob);
  const safeFilename = escapeHtml(filename);
  return `<div class="text-sm leading-relaxed"><a href="${dataUrl}" download="${safeFilename}" class="font-medium text-primary underline underline-offset-2">📥 Download ${safeFilename}</a></div>`;
}

function getDownloadFilename(customFilename, originalFilename, defaultFilename) {
  if (customFilename && customFilename.trim()) {
    return customFilename.trim();
  }
  if (originalFilename) {
    return originalFilename;
  }
  return defaultFilename;
}

async function handler(inputWidgets, changedWidgetIds) {
  const fileUpload = inputWidgets["file-upload"];
  const binaryContent = inputWidgets["binary-content"] || "";
  const octalContent = inputWidgets["octal-content"] || "";
  const decimalContent = inputWidgets["decimal-content"] || "";
  const hexadecimalContent = inputWidgets["hexadecimal-content"] || "";
  const customFilename = inputWidgets["custom-filename"] || "";

  let result = {};

  try {
    if (changedWidgetIds === "file-upload" && fileUpload) {
      const file = fileUpload;
      const fileSize = file.size;

      if (fileSize > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 20MB limit. Current size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
      }

      const binary = await fileToBinary(file);
      const octal = await fileToOctal(file);
      const decimal = await fileToDecimal(file);
      const hexadecimal = await fileToHexadecimal(file);

      result["binary-content"] = binary;
      result["octal-content"] = octal;
      result["decimal-content"] = decimal;
      result["hexadecimal-content"] = hexadecimal;

      if (!customFilename || !customFilename.trim()) {
        result["custom-filename"] = file.name;
      }

      let warningContent = `<div class="text-sm leading-relaxed"><p class="font-semibold">File: <span class="text-primary">${escapeHtml(file.name)}</span></p><p>Size: <span class="font-semibold">${(fileSize / 1024 / 1024).toFixed(2)}MB</span></p>`;

      if (fileSize > SLOW_THRESHOLD) {
        warningContent += "<p class=\"text-yellow-600 mt-2\">⚠️ File size exceeds 5MB. Conversion and display may be slow.</p>";
      }

      warningContent += "</div>";
      result["file-size-warning"] = warningContent;

      const bytes = binaryToBytes(binary);
      const downloadFilename = getDownloadFilename(customFilename, file.name, `file_${Date.now()}.bin`);
      result["download-label"] = generateDownloadLink(bytes, downloadFilename);

    } else if (changedWidgetIds === "binary-content" && binaryContent) {
      isValidBinary(binaryContent);
      const bytes = binaryToBytes(binaryContent);
      result["octal-content"] = bytesToOctal(bytes);
      result["decimal-content"] = bytesToDecimal(bytes);
      result["hexadecimal-content"] = bytesToHexadecimal(bytes);
      const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
      result["download-label"] = generateDownloadLink(bytes, downloadFilename);

    } else if (changedWidgetIds === "octal-content" && octalContent) {
      isValidOctal(octalContent);
      const bytes = octalToBytes(octalContent);
      result["binary-content"] = bytesToBinary(bytes);
      result["decimal-content"] = bytesToDecimal(bytes);
      result["hexadecimal-content"] = bytesToHexadecimal(bytes);
      const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
      result["download-label"] = generateDownloadLink(bytes, downloadFilename);

    } else if (changedWidgetIds === "decimal-content" && decimalContent) {
      isValidDecimal(decimalContent);
      const bytes = decimalToBytes(decimalContent);
      result["binary-content"] = bytesToBinary(bytes);
      result["octal-content"] = bytesToOctal(bytes);
      result["hexadecimal-content"] = bytesToHexadecimal(bytes);
      const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
      result["download-label"] = generateDownloadLink(bytes, downloadFilename);

    } else if (changedWidgetIds === "hexadecimal-content" && hexadecimalContent) {
      isValidHexadecimal(hexadecimalContent);
      const bytes = hexadecimalToBytes(hexadecimalContent);
      result["binary-content"] = bytesToBinary(bytes);
      result["octal-content"] = bytesToOctal(bytes);
      result["decimal-content"] = bytesToDecimal(bytes);
      const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
      result["download-label"] = generateDownloadLink(bytes, downloadFilename);

    } else if (changedWidgetIds === "custom-filename" && customFilename) {
      if (binaryContent) {
        isValidBinary(binaryContent);
        const bytes = binaryToBytes(binaryContent);
        const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
        result["download-label"] = generateDownloadLink(bytes, downloadFilename);
      } else if (octalContent) {
        isValidOctal(octalContent);
        const bytes = octalToBytes(octalContent);
        const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
        result["download-label"] = generateDownloadLink(bytes, downloadFilename);
      } else if (decimalContent) {
        isValidDecimal(decimalContent);
        const bytes = decimalToBytes(decimalContent);
        const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
        result["download-label"] = generateDownloadLink(bytes, downloadFilename);
      } else if (hexadecimalContent) {
        isValidHexadecimal(hexadecimalContent);
        const bytes = hexadecimalToBytes(hexadecimalContent);
        const downloadFilename = getDownloadFilename(customFilename, null, `file_${Date.now()}.bin`);
        result["download-label"] = generateDownloadLink(bytes, downloadFilename);
      }
    }
  } catch (error) {
    console.error("Conversion error:", error.message);
    throw error;
  }

  return result;
}