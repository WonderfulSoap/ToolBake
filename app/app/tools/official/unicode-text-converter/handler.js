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
  const originalText = inputWidgets["original-text"] || "";
  const unicodeCodePoint = inputWidgets["unicode-code-point"] || "";
  const htmlDecimal = inputWidgets["html-decimal"] || "";
  const htmlHex = inputWidgets["html-hex"] || "";
  const unicodeEscapeBraced = inputWidgets["unicode-escape-braced"] || "";
  const unicodeEscape16 = inputWidgets["unicode-escape-16"] || "";

  if (changedWidgetIds === "original-text") return pruneChangedOutput(buildOutputsFromText(originalText), changedWidgetIds);
  if (changedWidgetIds === "unicode-code-point") return pruneChangedOutput(buildOutputsFromCodePoints(parseUnicodeCodePoints(unicodeCodePoint)), changedWidgetIds);
  if (changedWidgetIds === "html-decimal") return pruneChangedOutput(buildOutputsFromCodePoints(parseHtmlDecimalReferences(htmlDecimal)), changedWidgetIds);
  if (changedWidgetIds === "html-hex") return pruneChangedOutput(buildOutputsFromCodePoints(parseHtmlHexReferences(htmlHex)), changedWidgetIds);
  if (changedWidgetIds === "unicode-escape-braced") return pruneChangedOutput(buildOutputsFromCodePoints(parseUnicodeEscapeBraced(unicodeEscapeBraced)), changedWidgetIds);
  if (changedWidgetIds === "unicode-escape-16") return pruneChangedOutput(buildOutputsFromText(parseUnicodeEscape16ToText(unicodeEscape16)), changedWidgetIds);

  return {};
}

function buildOutputsFromText(text) {
  if (!text) return buildEmptyOutputs();
  const codePoints = textToCodePoints(text);
  return {
    "original-text"        : text,
    "unicode-code-point"   : codePointsToUnicodeCodePointString(codePoints),
    "html-decimal"         : codePointsToHtmlDecimal(codePoints),
    "html-decimal-padded"  : codePointsToHtmlDecimalPadded(codePoints),
    "html-hex"             : codePointsToHtmlHex(codePoints),
    "html-hex-padded"      : codePointsToHtmlHexPadded(codePoints),
    "unicode-escape-braced": codePointsToUnicodeEscapeBraced(codePoints),
    "unicode-escape-16"    : codePointsToUnicodeEscape16(codePoints)
  };
}

function buildOutputsFromCodePoints(codePoints) {
  if (!codePoints.length) return buildEmptyOutputs();
  return buildOutputsFromText(codePointsToText(codePoints));
}

function buildEmptyOutputs() {
  return {
    "original-text"        : "",
    "unicode-code-point"   : "",
    "html-decimal"         : "",
    "html-decimal-padded"  : "",
    "html-hex"             : "",
    "html-hex-padded"      : "",
    "unicode-escape-braced": "",
    "unicode-escape-16"    : ""
  };
}

function textToCodePoints(text) {
  const codePoints = [];
  for (const char of text) codePoints.push(char.codePointAt(0));
  return codePoints;
}

function codePointsToText(codePoints) {
  let text = "";
  for (const cp of codePoints) text += String.fromCodePoint(cp);
  return text;
}

function codePointsToUnicodeCodePointString(codePoints) {
  return codePoints.map((cp) => "U+" + toUpperHex(cp, 4)).join(" ");
}

function codePointsToHtmlDecimal(codePoints) {
  return codePoints.map((cp) => "&#" + cp + ";").join("");
}

function codePointsToHtmlDecimalPadded(codePoints) {
  return codePoints.map((cp) => "&#" + String(cp).padStart(4, "0") + ";").join("");
}

function codePointsToHtmlHex(codePoints) {
  return codePoints.map((cp) => "&#x" + toUpperHex(cp, 1) + ";").join("");
}

function codePointsToHtmlHexPadded(codePoints) {
  return codePoints.map((cp) => "&#x" + toUpperHex(cp, 4) + ";").join("");
}

function codePointsToUnicodeEscapeBraced(codePoints) {
  return codePoints.map((cp) => "\\u{" + toUpperHex(cp, 1) + "}").join("");
}

function codePointsToUnicodeEscape16(codePoints) {
  return codePoints.map((cp) => codePointToUnicodeEscape16(cp)).join("");
}

function codePointToUnicodeEscape16(codePoint) {
  if (codePoint <= 0xFFFF) return "\\u" + toUpperHex(codePoint, 4);
  const offset = codePoint - 0x10000;
  const high = 0xD800 + (offset >> 10);
  const low = 0xDC00 + (offset & 0x3FF);
  return "\\u" + toUpperHex(high, 4) + "\\u" + toUpperHex(low, 4);
}

function parseUnicodeCodePoints(input) {
  const trimmed = normalizeInput(input);
  if (!trimmed) return [];
  ensureOnlyAllowedTokens(trimmed, /U\+[0-9A-Fa-f]{1,6}/g, "Unicode code point", "U+XXXX");
  const matches = trimmed.match(/U\+[0-9A-Fa-f]{1,6}/g) || [];
  const codePoints = matches.map((token) => parseInt(token.slice(2), 16));
  return validateCodePoints(codePoints);
}

function parseHtmlDecimalReferences(input) {
  const trimmed = normalizeInput(input);
  if (!trimmed) return [];
  ensureOnlyAllowedTokens(trimmed, /&#\d+;/g, "HTML decimal reference", "&#1234;");
  const matches = trimmed.match(/&#\d+;/g) || [];
  const codePoints = matches.map((token) => parseInt(token.slice(2, -1), 10));
  return validateCodePoints(codePoints);
}

function parseHtmlHexReferences(input) {
  const trimmed = normalizeInput(input);
  if (!trimmed) return [];
  ensureOnlyAllowedTokens(trimmed, /&#x[0-9A-Fa-f]+;/g, "HTML hex reference", "&#x1F600;");
  const matches = trimmed.match(/&#x[0-9A-Fa-f]+;/g) || [];
  const codePoints = matches.map((token) => parseInt(token.slice(3, -1), 16));
  return validateCodePoints(codePoints);
}

function parseUnicodeEscapeBraced(input) {
  const trimmed = normalizeInput(input);
  if (!trimmed) return [];
  ensureOnlyAllowedTokens(trimmed, /\\u\{[0-9A-Fa-f]+\}/g, "Unicode escape", "\\u{1F600}");
  const matches = trimmed.match(/\\u\{[0-9A-Fa-f]+\}/g) || [];
  const codePoints = matches.map((token) => parseInt(token.slice(3, -1), 16));
  return validateCodePoints(codePoints);
}

function parseUnicodeEscape16ToText(input) {
  const trimmed = normalizeInput(input);
  if (!trimmed) return "";
  ensureOnlyAllowedTokens(trimmed, /\\u[0-9A-Fa-f]{4}/g, "Unicode escape", "\\u0041");
  const matches = trimmed.match(/\\u[0-9A-Fa-f]{4}/g) || [];
  if (!matches.length) throw new Error("Unicode escape input must use \\uXXXX format");
  let text = "";
  for (const token of matches) text += String.fromCharCode(parseInt(token.slice(2), 16));
  return text;
}

function normalizeInput(input) {
  return String(input || "").trim();
}

function ensureOnlyAllowedTokens(input, tokenRegex, label, example) {
  const leftovers = input.replace(tokenRegex, "").replace(/\s+/g, "");
  if (leftovers) throw new Error(label + " input must match " + example + " (whitespace allowed)");
  const matches = input.match(tokenRegex) || [];
  if (!matches.length) throw new Error(label + " input must match " + example);
}

function validateCodePoints(codePoints) {
  for (const codePoint of codePoints) {
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) throw new Error("Unicode code point out of range");
    if (codePoint >= 0xD800 && codePoint <= 0xDFFF) throw new Error("Unicode code point must not be a surrogate");
  }
  return codePoints;
}

function toUpperHex(value, minLength) {
  return value.toString(16).toUpperCase().padStart(minLength, "0");
}

function pruneChangedOutput(result, changedWidgetId) {
  if (changedWidgetId && Object.prototype.hasOwnProperty.call(result, changedWidgetId)) delete result[changedWidgetId];
  return result;
}
