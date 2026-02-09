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
  console.log("Handlebars renderer triggered.", changedWidgetIds);

  const jsonText = (inputWidgets["json-input"] || "").trim();
  const templateText = inputWidgets["template-input"] || "";
  console.log("Input sizes", { json: jsonText.length, template: templateText.length });

  const Handlebars = await requirePackage("handlebars");
  const data = parseJsonInput(jsonText);
  const rendered = renderTemplate(Handlebars, templateText, data);

  return { "rendered-output": rendered };
}

/**
 * Parse JSON input and fall back to an empty object when the input is blank.
 * @param {string} jsonText
 * @returns {Record<string, any>}
 */
function parseJsonInput(jsonText) {
  if (!jsonText) return {};
  return JSON.parse(jsonText);
}

/**
 * Compile and render a Handlebars template with the provided data.
 * @param {any} Handlebars
 * @param {string} templateText
 * @param {Record<string, any>} data
 * @returns {string}
 */
function renderTemplate(Handlebars, templateText, data) {
  if (!templateText) return "";
  const template = Handlebars.compile(templateText);
  return template(data);
}
