

function isValidBinary(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[01]{1,16}$/.test(word)) {
      throw new Error("Binary input must contain 1-16 digit binary numbers (0-65535)");
    }
    if (parseInt(word, 2) > 65535) {
      throw new Error("Binary values must not exceed 65535");
    }
  }
  return true;
}

function isValidOctal(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[0-7]{1,6}$/.test(word)) {
      throw new Error("Octal input must contain 1-6 digit octal numbers (0-177777)");
    }
    if (parseInt(word, 8) > 65535) {
      throw new Error("Octal values must not exceed 177777 (65535 in decimal)");
    }
  }
  return true;
}

function isValidDecimal(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[0-9]{1,5}$/.test(word)) {
      throw new Error("Decimal input must contain 1-5 digit numbers (0-65535)");
    }
    const num = parseInt(word, 10);
    if (num < 0 || num > 65535) {
      throw new Error("Decimal values must be between 0 and 65535");
    }
  }
  return true;
}

function isValidHexadecimal(str) {
  if (!str.trim()) return true;
  const words = str.trim().split(/\s+/);
  for (let word of words) {
    if (!/^[0-9A-Fa-f]{1,4}$/.test(word)) {
      throw new Error("Hexadecimal input must contain 1-4 digit hex numbers (0-FFFF)");
    }
    if (parseInt(word, 16) > 65535) {
      throw new Error("Hexadecimal values must not exceed FFFF (65535 in decimal)");
    }
  }
  return true;
}

function textToBinary(text) {
  return text.split("").map(char => {
    const code = char.charCodeAt(0);
    return code.toString(2).padStart(code > 255 ? 16 : 8, "0");
  }).join(" ");
}

function textToOctal(text) {
  return text.split("").map(char => {
    const code = char.charCodeAt(0);
    return code.toString(8).padStart(code > 255 ? 6 : 3, "0");
  }).join(" ");
}

function textToDecimal(text) {
  return text.split("").map(char => {
    return char.charCodeAt(0).toString(10);
  }).join(" ");
}

function textToHexadecimal(text) {
  return text.split("").map(char => {
    const code = char.charCodeAt(0);
    return code.toString(16).padStart(code > 255 ? 4 : 2, "0").toUpperCase();
  }).join(" ");
}

function binaryToText(binaryStr) {
  return binaryStr.trim().split(/\s+/).map(binary => {
    return String.fromCharCode(parseInt(binary, 2));
  }).join("");
}

function octalToText(octalStr) {
  return octalStr.trim().split(/\s+/).map(octal => {
    return String.fromCharCode(parseInt(octal, 8));
  }).join("");
}

function decimalToText(decimalStr) {
  return decimalStr.trim().split(/\s+/).map(decimal => {
    return String.fromCharCode(parseInt(decimal, 10));
  }).join("");
}

function hexadecimalToText(hexStr) {
  return hexStr.trim().split(/\s+/).map(hex => {
    return String.fromCharCode(parseInt(hex, 16));
  }).join("");
}

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
async function handler(inputWidgets, changedWidgetIds) {
  let originalText = inputWidgets["original-text"] || "";
  const binaryText = inputWidgets["binary-text"] || "";
  const octalText = inputWidgets["octal-text"] || "";
  const decimalText = inputWidgets["decimal-text"] || "";
  const hexadecimalText = inputWidgets["hexadecimal-text"] || "";

  let result = {};

  try {
    if (changedWidgetIds === "original-text") {
      if (originalText === "") {
        result["binary-text"] = "";
        result["octal-text"] = "";
        result["decimal-text"] = "";
        result["hexadecimal-text"] = "";
      } else {
        result["binary-text"] = textToBinary(originalText);
        result["octal-text"] = textToOctal(originalText);
        result["decimal-text"] = textToDecimal(originalText);
        result["hexadecimal-text"] = textToHexadecimal(originalText);
      }
    } else if (changedWidgetIds === "binary-text") {
      if (binaryText === "") {
        result["original-text"] = "";
        result["octal-text"] = "";
        result["decimal-text"] = "";
        result["hexadecimal-text"] = "";
      } else {
        isValidBinary(binaryText);
        originalText = binaryToText(binaryText);
        result["original-text"] = originalText;
        result["octal-text"] = textToOctal(originalText);
        result["decimal-text"] = textToDecimal(originalText);
        result["hexadecimal-text"] = textToHexadecimal(originalText);
      }
    } else if (changedWidgetIds === "octal-text") {
      if (octalText === "") {
        result["original-text"] = "";
        result["binary-text"] = "";
        result["decimal-text"] = "";
        result["hexadecimal-text"] = "";
      } else {
        isValidOctal(octalText);
        originalText = octalToText(octalText);
        result["original-text"] = originalText;
        result["binary-text"] = textToBinary(originalText);
        result["decimal-text"] = textToDecimal(originalText);
        result["hexadecimal-text"] = textToHexadecimal(originalText);
      }
    } else if (changedWidgetIds === "decimal-text") {
      if (decimalText === "") {
        result["original-text"] = "";
        result["binary-text"] = "";
        result["octal-text"] = "";
        result["hexadecimal-text"] = "";
      } else {
        isValidDecimal(decimalText);
        originalText = decimalToText(decimalText);
        result["original-text"] = originalText;
        result["binary-text"] = textToBinary(originalText);
        result["octal-text"] = textToOctal(originalText);
        result["hexadecimal-text"] = textToHexadecimal(originalText);
      }
    } else if (changedWidgetIds === "hexadecimal-text") {
      if (hexadecimalText === "") {
        result["original-text"] = "";
        result["binary-text"] = "";
        result["octal-text"] = "";
        result["decimal-text"] = "";
      } else {
        isValidHexadecimal(hexadecimalText);
        originalText = hexadecimalToText(hexadecimalText);
        result["original-text"] = originalText;
        result["binary-text"] = textToBinary(originalText);
        result["octal-text"] = textToOctal(originalText);
        result["decimal-text"] = textToDecimal(originalText);
      }
    }
  } catch (error) {
    console.error("Conversion error:", error.message);
    throw error;
  }

  return result;
}