/**
 * Prettify or minify JSON based on the selected mode.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const rawJson = inputWidgets["json-input"] || "";
  if (!rawJson.trim()) return { "json-output": "" };
  const mode = inputWidgets.mode || "prettify";
  const indentType = inputWidgets["indent-type"] || "spaces";
  const indentSize = normalizeIndentSize(inputWidgets["indent-size"]);
  const data = JSON.parse(rawJson);
  const indent = indentType === "tab" ? "\t" : indentSize;
  const output = mode === "minify" ? JSON.stringify(data) : JSON.stringify(data, null, indent);
  return { "json-output": output };
}

function normalizeIndentSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 2;
  return Math.min(8, Math.floor(parsed));
}
