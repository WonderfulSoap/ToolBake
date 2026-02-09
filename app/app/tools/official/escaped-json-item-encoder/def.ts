import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolEscapedJsonItemDecoder: Tool = {
  id         : "official-escaped-json-item-decoder",
  uid        : "uid-official-escaped-json-item-decoder",
  name       : "Escaped JSON item Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Encode text into escaped control sequences (\\n, \\t, \\r, \\xNN, \\uXXXX) or decode escaped json text back to rendered characters, with optional JSONPath extraction for JSON payloads.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
