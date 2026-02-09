/**
 * The jsdoc comment below describes the handler function signature. Don't remove it.
 * We will dynamically maintance the type definition of 'inputWidgets' and 'changedWidgetIds' based on uiWidgets you defined.
 * So that you can get strong type checking and code completion in the editor.
 * 
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widget-id"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * 
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const enbaleAZ = inputWidgets.A_Z;
  const enableaz = inputWidgets.a_z;
  const enableNumber = inputWidgets.number;
  const enableSymbols = inputWidgets.symb;
  const generateLength = inputWidgets.len;

  let chars = "";
  if (enbaleAZ) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (enableaz) chars += "abcdefghijklmnopqrstuvwxyz";
  if (enableNumber) chars += "0123456789";
  if (enableSymbols) chars += "!@#$%^&*";

  let result = "";
  for (let i = 0; i < generateLength; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return {
    result: result
  };

}

