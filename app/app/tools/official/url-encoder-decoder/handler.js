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
  const { raw_text, encoded_uri, encoded_uri_component } = inputWidgets;

  if (changedWidgetIds === "raw_text") {
    const value = raw_text || "";
    return {
      encoded_uri          : value ? encodeURI(value) : "",
      encoded_uri_component: value ? encodeURIComponent(value) : "",
    };
  }

  if (changedWidgetIds === "encoded_uri") {
    const value = encoded_uri || "";
    if (!value) {
      return { raw_text: "", encoded_uri_component: "" };
    }
    const decoded = decodeURI(value);
    return { raw_text: decoded, encoded_uri_component: encodeURIComponent(decoded) };
  }

  if (changedWidgetIds === "encoded_uri_component") {
    const value = encoded_uri_component || "";
    if (!value) {
      return { raw_text: "", encoded_uri: "" };
    }
    const decoded = decodeURIComponent(value);
    return { raw_text: decoded, encoded_uri: encodeURI(decoded) };
  }

  return {};
}
