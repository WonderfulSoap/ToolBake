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
  const rawText = inputWidgets["input-text"] || "";
  const joinEnabled = !!inputWidgets["join-enabled"];
  const joinDelimiter = inputWidgets["join-delimiter"] ?? "";
  const trimLines = !!inputWidgets["trim-lines"];
  const removeDuplicates = !!inputWidgets["remove-duplicates"];
  const caseMode = inputWidgets["case-mode"] || "none";
  const sortOrder = inputWidgets["sort-order"] || "none";
  const linePrefix = inputWidgets["line-prefix"] || "";
  const lineSuffix = inputWidgets["line-suffix"] || "";
  const outputPrefix = inputWidgets["output-prefix"] || "";
  const outputSuffix = inputWidgets["output-suffix"] || "";

  let lines = splitLines(rawText);
  if (trimLines) lines = lines.map(line => line.trim());
  if (caseMode !== "none") lines = lines.map(line => applyCaseMode(line, caseMode));
  if (removeDuplicates) lines = uniqueLines(lines);
  if (sortOrder !== "none") lines = sortLinesByOrder(lines, sortOrder);
  if (linePrefix || lineSuffix) lines = lines.map(line => `${linePrefix}${line}${lineSuffix}`);

  const joined = joinEnabled ? lines.join(joinDelimiter) : lines.join("\n");
  const outputText = `${outputPrefix}${joined}${outputSuffix}`;

  return {
    "output-text": outputText
  };
}

function splitLines(text) {
  if (!text) return [""];
  return text.split(/\r?\n/);
}

function uniqueLines(lines) {
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    if (seen.has(line)) continue;
    seen.add(line);
    result.push(line);
  }
  return result;
}

function applyCaseMode(line, mode) {
  if (mode === "lower") return line.toLowerCase();
  if (mode === "upper") return line.toUpperCase();
  if (mode === "title") return toTitleCase(line);
  return line;
}

function toTitleCase(text) {
  return text.toLowerCase().replace(/\b\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
}

function sortLinesByOrder(lines, order) {
  const sorted = lines.slice().sort((a, b) => a.localeCompare(b));
  return order === "desc" ? sorted.reverse() : sorted;
}
