/**
 * Case conversion handler for ToolBake
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const input = inputWidgets["input-text"] || "";
  
  if (!input.trim()) {
    return {
      "out-lower"   : "", "out-upper"   : "", "out-camel"   : "", "out-capital" : "",
      "out-constant": "", "out-dot"     : "", "out-header"  : "", "out-no"      : "",
      "out-param"   : "", "out-pascal"  : "", "out-path"    : "", "out-sentence": "",
      "out-snake"   : "", "out-mocking" : ""
    };
  }

  // Helper to split string into words based on common delimiters and casing
  const getWords = (str) => {
    return str
      .replace(/([a-z])([A-Z])/g, "$1 $2") // Split camelCase
      .replace(/[^a-zA-Z0-9]+/g, " ")      // Replace non-alphanumeric with space
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  };

  const words = getWords(input);
  const lowerWords = words.map(w => w.toLowerCase());
  
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  return {
    "out-lower": input.toLowerCase(),
    "out-upper": input.toUpperCase(),
    
    "out-camel": lowerWords.map((w, i) => i === 0 ? w : capitalize(w)).join(""),
    
    "out-pascal": lowerWords.map(capitalize).join(""),
    
    "out-snake": lowerWords.join("_"),
    
    "out-param": lowerWords.join("-"),
    
    "out-constant": lowerWords.map(w => w.toUpperCase()).join("_"),
    
    "out-dot": lowerWords.join("."),
    
    "out-path": lowerWords.join("/"),
    
    "out-header": lowerWords.map(capitalize).join("-"),
    
    "out-capital": lowerWords.map(capitalize).join(" "),
    
    "out-sentence": lowerWords.map((w, i) => i === 0 ? capitalize(w) : w).join(" "),
    
    "out-no": lowerWords.join(" "),
    
    "out-mocking": input.split("").map((char, i) => i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()).join("")
  };
}