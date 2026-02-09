import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolBase64FileEncoderDecoder: Tool = {
  id         : "official-base64-file-encoder-decoder",
  uid        : "uid-official-base64-file-encoder-decoder",
  name       : "File Base64 Encoder/Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Convert files to Base64 DataURLs and decode Base64 strings back into original files instantly with this high-performance, browser-based utility. Designed for developers and designers, this tool supports images, audio, video, and PDFs, providing integrated live previews and one-click downloads.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
