
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
  const CryptoJS = await requirePackage("crypto-js");

  const text = inputWidgets.user_input || "";
  const encoding = inputWidgets.hash_encoding;
  const uppercaseOutput = inputWidgets.uppercase_output !== false;

  if (!text) return {};

  function encode(wordArray) {
    let result;
    if (encoding === "bin") {
      result = wordArray
        .toString(CryptoJS.enc.Hex)
        .split("")
        .map(h => parseInt(h, 16).toString(2).padStart(4, "0"))
        .join("");
    }else if (encoding === "hex") {
      result = wordArray.toString(CryptoJS.enc.Hex);
    }else if (encoding === "base64") {
      result = CryptoJS.enc.Base64.stringify(wordArray);
    }else if (encoding === "base64_safe") {
      result = CryptoJS.enc.Base64.stringify(wordArray).replace(/=+$/, "");
    }else{
      throw Error(`Unknow encoding selected: '${encoding}'`);
    }
    return uppercaseOutput ? result.toUpperCase() : result;

  }

  return {
    hash_results: {
      md5      : encode(CryptoJS.MD5(text)),
      sha1     : encode(CryptoJS.SHA1(text)),
      sha224   : encode(CryptoJS.SHA224(text)),
      sha256   : encode(CryptoJS.SHA256(text)),
      sha384   : encode(CryptoJS.SHA384(text)),
      sha512   : encode(CryptoJS.SHA512(text)),
      sha3     : encode(CryptoJS.SHA3(text)),
      ripemd160: encode(CryptoJS.RIPEMD160(text)),
    },
  };
}
