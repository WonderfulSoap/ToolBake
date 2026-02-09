/**
 * Prettify or minify XML based on the selected mode.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const rawXml = inputWidgets["xml-input"] || "";
  if (!rawXml.trim()) return { "xml-output": "" };
  const mode = inputWidgets.mode || "prettify";
  const indentType = inputWidgets["indent-type"] || "spaces";
  const indentSize = normalizeIndentSize(inputWidgets["indent-size"]);
  const { XMLParser, XMLBuilder } = await requirePackage("fast-xml-parser");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const data = parser.parse(rawXml);
  const indentBy = indentType === "tab" ? "\t" : " ".repeat(indentSize);
  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_", format: mode !== "minify", suppressEmptyNode: true, indentBy });
  const output = builder.build(data);
  return { "xml-output": output };
}

function normalizeIndentSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 2;
  return Math.min(8, Math.floor(parsed));
}
