/**
 * @param {InputUIWidgets} inputWidgets 
 * @param {ChangedUIWidget} changedWidgetIds 
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const arabicVal = inputWidgets.arabic_input;
  const romanVal = inputWidgets.roman_input;

  // 1. If Arabic Number changed (NumberInput ensures it's numeric or null)
  if (changedWidgetIds === "arabic_input") {
    if (arabicVal === null || arabicVal === undefined) {
      return { roman_input: "" };
    }

    // NumberInput uses its own min/max, but we handle logic just in case
    if (arabicVal < 1 || arabicVal > 3999) {
      return {
        roman_input: "Out of Range (1-3999)"
      };
    }

    const romanResult = romanize(arabicVal);
    return {
      roman_input: romanResult
    };
  }

  // 2. If Roman Numeral changed
  if (changedWidgetIds === "roman_input") {
    if (!romanVal || romanVal.trim() === "") {
      return { arabic_input: null };
    }
    
    // Check if the current roman_input is an error message from previous step
    if (romanVal.includes("Range") || romanVal.includes("Invalid")) {
      return {};
    }

    const arabicResult = deromanize(romanVal);
    
    if (arabicResult === false) {
      // If Roman is invalid, we show error in the roman input itself
      return {
        roman_input: "Error: Invalid Format"
      };
    }

    return {
      arabic_input: arabicResult
    };
  }

  return {};
}

/**
 * Converts Arabic number to Roman
 */
function romanize(num) {
  if (!+num) return false;
  var digits = String(+num).split("");
  var key = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
    "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
    "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"
  ];
  var roman = "", i = 3;
  while (i--) roman = (key[+digits.pop() + (i * 10)] || "") + roman;
  return Array(+digits.join("") + 1).join("M") + roman;
}

/**
 * Converts Roman string to Arabic number
 */
function deromanize(str) {
  str = str.toUpperCase().trim();
  // Standard Roman Numeral validator (1-3999)
  var validator = /^M{0,3}(?:D?C{0,3}|C[MD])Target(?:L?X{0,3}|X[CL])(?:V?I{0,3}|I[XV])$/;
  // Optimized regex for validation
  var strictValidator = /^M{0,3}(?:D?C{0,3}|C[MD])(?:L?X{0,3}|X[CL])(?:V?I{0,3}|I[XV])$/;
  
  var token = /[MDLV]|C[MD]?|X[CL]?|I[XV]?/g;
  var key = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  var num = 0, m;
  
  if (!(str && strictValidator.test(str))) return false;
  
  while (true) {
    m = token.exec(str);
    if (!m) break;
    num += key[m[0]];
  }

  return num === 0 ? false : num;
}