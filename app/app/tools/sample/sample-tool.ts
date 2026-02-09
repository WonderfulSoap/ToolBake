import type { Tool } from "~/entity/tool";

export const sampleToolSourceCode = `
/**
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widgetId"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * - Checks the 'uiWidgets' tab to check and modify the input/output UI widgets of this tool
 * - callback() can be used to update the UI widgets asynchronously during long tasks. Example: callback({ output_widget_id: "new value" });
 * - The 'handler.d.ts' tab shows the full auto generated type definitions for the handler function
 * 
 * !! The jsdoc comment below describes the handler function signature, and provides type information for the editor. Don't remove it.
 *
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  console.log("inputWidgets: ", JSON.stringify(inputWidgets));
  console.log("changedWidgetIds: ", changedWidgetIds);

  const inputValue = inputWidgets.user_input_text;
  const processedValue = inputValue.split("").join("😊");

  return {
    processed_output_text: processedValue
  };
}

`;
export const sampleTool: Tool = {
  id               : "sample-tool",
  uid              : "local-sample-tool-001",
  name             : "Sample Tool",
  namespace        : "CustomTools",
  isOfficial       : false,
  realtimeExecution: true,
  description      : "",
  extraInfo        : {},
  uiWidgets        : [
    [
      { 
        type : "TextareaInput", 
        id   : "user_input_text", 
        title: "User Input Text", 
        mode : "input", 
        props: { placeholder: "Enter your text here..."  }
      },
    ],
    [
      {
        type : "TextareaInput",
        id   : "processed_output_text",
        title: "Processed Output Text",
        mode : "output",
        props: {  }
      }
    ]
  ],
  source: sampleToolSourceCode,
};