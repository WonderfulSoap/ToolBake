/**
 * HTML escape/unescape handler
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const rawText = inputWidgets["raw-text"] || "";
  const escapedText = inputWidgets["escaped-text"] || "";
  const escapeSpace = !!inputWidgets["escape-space"];
  const escapeSlash = !!inputWidgets["escape-slash"];
  const escapeBacktick = !!inputWidgets["escape-backtick"];

  // Build escape map based on options
  const escapeMap = {
    "&" : "&amp;",
    "<" : "&lt;",
    ">" : "&gt;",
    "\"": "&quot;",
    "'" : "&#39;",
  };

  if (escapeSpace) escapeMap[" "] = "&#32;";
  if (escapeSlash) escapeMap["/"] = "&#47;";
  if (escapeBacktick) escapeMap["`"] = "&#96;";

  // Build unescape map (reverse of escape map)
  const unescapeMap = Object.fromEntries(
    Object.entries(escapeMap).map(([k, v]) => [v, k])
  );

  const escapeHtml = (text) => {
    return text.replace(/[&<>"'`/ ]/g, (char) => escapeMap[char] || char);
  };

  const unescapeHtml = (text) => {
    let result = text;
    // Sort by length descending to handle longer entities first
    const entities = Object.keys(unescapeMap).sort((a, b) => b.length - a.length);
    for (const entity of entities) {
      result = result.split(entity).join(unescapeMap[entity]);
    }
    return result;
  };

  if (changedWidgetIds === "raw-text") {
    return {
      "escaped-text": rawText ? escapeHtml(rawText) : "",
    };
  }

  if (changedWidgetIds === "escaped-text") {
    return {
      "raw-text": escapedText ? unescapeHtml(escapedText) : "",
    };
  }

  if (
    changedWidgetIds === "escape-space" ||
    changedWidgetIds === "escape-slash" ||
    changedWidgetIds === "escape-backtick"
  ) {
    // Re-escape raw text with new options
    return {
      "escaped-text": rawText ? escapeHtml(rawText) : "",
    };
  }

  return {
    "escaped-text": rawText ? escapeHtml(rawText) : "",
  };
}

