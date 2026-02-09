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
  const jsonata = await requirePackage("jsonata");

  const expressionStr = inputWidgets.jsonata_expression;
  const jsonStr = inputWidgets.input_json;

  if (!jsonStr || !expressionStr) {
    return {
      output_result: ""
    };
  }

  try {
    const json = JSON.parse(jsonStr);
    const expression = jsonata(expressionStr);
    const result = await expression.evaluate(json);
    
    // Handle different result types for display
    let resultStr;
    if (typeof result === "undefined") {
      resultStr = "undefined";
    } else if (typeof result === "object") {
      resultStr = JSON.stringify(result, null, 2);
    } else {
      resultStr = String(result);
    }

    return {
      output_result: resultStr
    };
  } catch (e) {
    return {
      output_result: "Error: " + e.message
    };
  }
}
