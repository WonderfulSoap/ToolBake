import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolEscapedTextEncoderDecoder: Tool = {
  id         : "official-escaped-text-encoder-decoder",
  uid        : "uid-official-escaped-text-encoder-decoder",
  name       : "Escaped Text Encoder/Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Encode text into escaped control sequences (\\n, \\t, \\r, \\xNN, \\uXXXX) or decode escaped text back to rendered characters for easy inspection and editing.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
