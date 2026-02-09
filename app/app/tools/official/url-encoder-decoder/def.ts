import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolUrlEncoderDecoder: Tool = {
  id         : "official-url-encoder-decoder",
  uid        : "uid-official-url-encoder-decoder",
  name       : "URL Encoder/Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Encode and decode URLs instantly with both encodeURI() and encodeURIComponent() outputs. Paste raw text or encoded strings to see synchronized conversions for full URLs and individual components, ideal for debugging query strings, path segments, and API parameters in the browser.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
