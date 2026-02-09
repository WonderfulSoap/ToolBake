import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolBase64TextEncoderDecoder: Tool = {
  id         : "official-base64-text-encoder-decoder",
  uid        : "uid-official-base64-text-encoder-decoder",
  name       : "Text Base64 Encoder/Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Fast and secure Base64 converter. Encode or decode text instantly in your browser with full UTF-8 and emoji support.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
