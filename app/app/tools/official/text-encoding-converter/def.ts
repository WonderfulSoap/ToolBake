import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolTextEncodingFixer: Tool = {
  id         : "official-text-encoding-fixer",
  uid        : "uid-official-text-encoding-fixer",
  name       : "Text File Encoding/Mojibake Fixer",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Detect text file encoding with chardet, manually override the source charset, and convert to a target encoding such as UTF-8, GBK, Big5, or Shift JIS. Upload files, preview the decoded content, and download the converted file instantly in your browser.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
