import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolTextLinesTransformer: Tool = {
  id         : "official-text-lines-transformer",
  uid        : "uid-official-text-lines-transformer",
  name       : "Text Lines Transformer",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Transform multi-line text by trimming, de-duplicating, sorting, changing case, and adding per-line prefixes or suffixes. Optionally join lines with custom delimiters and wrap the full output with global prefixes or suffixes for fast text cleanup and formatting.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
