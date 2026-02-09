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
  const { raw_text, base64_text } = inputWidgets;

  // Handle encoding: Raw Text -> Base64
  if (changedWidgetIds === "raw_text") {
    if (!raw_text) {
      return { base64_text: "" };
    }
    try {
      // Use TextEncoder and btoa for proper UTF-8 handling
      const bytes = new TextEncoder().encode(raw_text);
      const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
      const encoded = btoa(binString);
      return { base64_text: encoded };
    } catch (e) {
      console.error("Encoding error:", e);
      return { base64_text: "Error: Failed to encode text" };
    }
  }

  // Handle decoding: Base64 -> Raw Text
  if (changedWidgetIds === "base64_text") {
    if (!base64_text) {
      return { raw_text: "" };
    }
    try {
      // Decode base64 to binary string then to UTF-8 text
      const binString = atob(base64_text.trim());
      const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
      const decoded = new TextDecoder().decode(bytes);
      return { raw_text: decoded };
    } catch (e) {
      console.error("Decoding error:", e);
      // Return error message or keep raw_text as is to avoid clearing user input on typo
      return { raw_text: "Invalid Base64 string" };
    }
  }

  return {};
}