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
  const path = (inputWidgets["json-path"] || "").trim();
  if (changedWidgetIds === "escaped-text") {
    const inputText = inputWidgets["escaped-text"] || "";
    if (path) return { "raw-text": await extractJsonPathValue(inputText, path) };
    return { "raw-text": unescapeControlCharacters(inputText) };
  }
  if (changedWidgetIds === "raw-text") {
    if (path) return {};
    const inputText = inputWidgets["raw-text"] || "";
    return { "escaped-text": renderControlCharacters(inputText) };
  }
  if (changedWidgetIds === "json-path") {
    const inputText = inputWidgets["escaped-text"] || "";
    if (path) return { "raw-text": await extractJsonPathValue(inputText, path) };
    return { "raw-text": unescapeControlCharacters(inputText) };
  }
  return {};
}

function unescapeControlCharacters(text) {
  if (!text) return "";
  let result = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== "\\") {
      result += ch;
      continue;
    }
    const next = text[i + 1];
    if (!next) {
      result += "\\";
      continue;
    }
    if (next === "n") { result += "\n"; i += 1; continue; }
    if (next === "r") { result += "\r"; i += 1; continue; }
    if (next === "t") { result += "\t"; i += 1; continue; }
    if (next === "b") { result += "\b"; i += 1; continue; }
    if (next === "f") { result += "\f"; i += 1; continue; }
    if (next === "v") { result += "\v"; i += 1; continue; }
    if (next === "0") { result += "\0"; i += 1; continue; }
    if (next === "\\") { result += "\\"; i += 1; continue; }
    if (next === "x") {
      const hex = text.slice(i + 2, i + 4);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        result += String.fromCharCode(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    if (next === "u") {
      if (text[i + 2] === "{") {
        const end = text.indexOf("}", i + 3);
        const hex = end > -1 ? text.slice(i + 3, end) : "";
        if (hex && /^[0-9a-fA-F]{1,6}$/.test(hex)) {
          result += String.fromCodePoint(parseInt(hex, 16));
          i = end;
          continue;
        }
      } else {
        const hex = text.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
      }
    }
    result += next;
    i += 1;
  }
  return result;
}

function renderControlCharacters(text) {
  if (!text) return "";
  let result = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    if (ch === "\n") result += "\\n";
    else if (ch === "\r") result += "\\r";
    else if (ch === "\t") result += "\\t";
    else if (ch === "\b") result += "\\b";
    else if (ch === "\f") result += "\\f";
    else if (ch === "\v") result += "\\v";
    else if (code === 0x00) result += "\\0";
    else if (code < 0x20 || code === 0x7f) result += `\\x${code.toString(16).padStart(2, "0").toUpperCase()}`;
    else result += ch;
  }
  return result;
}

async function extractJsonPathValue(jsonText, path) {
  const { JSONPath } = await requirePackage("jsonpath-plus");
  const json = JSON.parse(jsonText);
  const result = JSONPath({ path: path, json: json, resultType: "value", wrap: false });
  return renderJsonPathResult(result);
}

function renderJsonPathResult(result) {
  if (result === undefined) return "";
  if (typeof result === "string") return result;
  return renderJsonEscapedControls(JSON.stringify(result, null, 2));
}

function renderJsonEscapedControls(text) {
  if (!text) return "";
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\v/g, "\v")
    .replace(/\\0/g, "\0");
}
