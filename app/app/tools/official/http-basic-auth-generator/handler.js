/**
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const { username, password } = inputWidgets;

  // Combine username and password
  const user = username || "";
  const pass = password || "";
  
  if (!user && !pass) {
    return {
      header     : "",
      full_header: ""
    };
  }
  
  const creds = `${user}:${pass}`;

  try {
    // Use TextEncoder and btoa for proper UTF-8 handling
    const bytes = new TextEncoder().encode(creds);
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
    const encoded = btoa(binString);
    const headerValue = `Basic ${encoded}`;
    return { 
      header     : headerValue,
      full_header: `Authorization: ${headerValue}`
    };
  } catch (e) {
    console.error("Encoding error:", e);
    return { 
      header     : "Error: Failed to generate header",
      full_header: "Error"
    };
  }
}