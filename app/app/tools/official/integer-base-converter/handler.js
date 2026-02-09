/**
 * Core Conversion Function provided by User
 */
function convertBase(value, base, targetBase) {
  const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
  if (base < 2 || base > 62 || targetBase < 2 || targetBase > 62) {
    return undefined;
  }
  const sourceAlphabet = ALPHABET.slice(0, base);
  const valueStr = String(value);
  let decimalValue = 0n;
  for (let i = 0; i < valueStr.length; i++) {
    const char = valueStr[i];
    const charIndex = sourceAlphabet.indexOf(char);
        
    if (charIndex === -1) {
      throw new Error(`Invalid character "${char}" for base ${base}`);
    }
        
    decimalValue = decimalValue * BigInt(base) + BigInt(charIndex);
  }
  if (decimalValue === 0n) return ALPHABET[0];
  const targetAlphabet = ALPHABET.slice(0, targetBase);
  let result = "";
    
  while (decimalValue > 0n) {
    const remainder = decimalValue % BigInt(targetBase);
    result = targetAlphabet[Number(remainder)] + result;
    decimalValue = decimalValue / BigInt(targetBase);
  }
  return result;
}

/**
 * ToolBake Handler
 * 
 * @param {InputUIWidgets} inputWidgets 
 * @param {ChangedUIWidget} changedWidgetIds 
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  // Mapping of widget IDs to their numeric bases
  const baseConfig = {
    bin        : 2,
    oct        : 8,
    dec        : 10,
    hex        : 16,
    base62     : 62,
    customValue: parseInt(inputWidgets.customBase) || 10
  };

  try {
    let sourceValue = "";
    let sourceBase = 10;

    // 1. Identify which widget triggered the change and get its base
    if (changedWidgetIds === "customBase") {
      // If the base number itself changed, we re-calculate from the current decimal value
      sourceValue = inputWidgets.dec || "0";
      sourceBase = 10;
    } else if (baseConfig[changedWidgetIds] !== undefined) {
      sourceValue = inputWidgets[changedWidgetIds] || "0";
      sourceBase = baseConfig[changedWidgetIds];
    } else {
      // Default fallback
      sourceValue = inputWidgets.dec || "0";
      sourceBase = 10;
    }

    // Cleaning input: For bases <= 36, user might input uppercase, we normalize to lowercase 
    // to match the ALPHABET "0123...abc..." (unless it's Base > 36 where it's case sensitive)
    if (sourceBase <= 36) {
      sourceValue = sourceValue.toLowerCase();
    }

    // 2. Convert source to Decimal first (Base 10) as our intermediate anchor
    // We use the provided convertBase function
    const decimalStr = convertBase(sourceValue, sourceBase, 10);

    // 3. Generate all target outputs using convertBase
    return {
      bin        : convertBase(decimalStr, 10, 2),
      oct        : convertBase(decimalStr, 10, 8),
      dec        : decimalStr,
      hex        : convertBase(decimalStr, 10, 16),
      base62     : convertBase(decimalStr, 10, 62),
      customValue: convertBase(decimalStr, 10, parseInt(inputWidgets.customBase) || 10),
      status     : "<span style='color: #10b981;'>✔ Success</span>"
    };

  } catch (e) {
    // Error handling for invalid characters
    return {
      status     : `<span style='color: #ef4444;'>✘ Error: ${e.message}</span>`,
      // Mark other fields as invalid to notify user
      bin        : changedWidgetIds === "bin" ? inputWidgets.bin : "Invalid",
      oct        : changedWidgetIds === "oct" ? inputWidgets.oct : "Invalid",
      dec        : changedWidgetIds === "dec" ? inputWidgets.dec : "Invalid",
      hex        : changedWidgetIds === "hex" ? inputWidgets.hex : "Invalid",
      base62     : changedWidgetIds === "base62" ? inputWidgets.base62 : "Invalid",
      customValue: changedWidgetIds === "customValue" ? inputWidgets.customValue : "Invalid"
    };
  }
}