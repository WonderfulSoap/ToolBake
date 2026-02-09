import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolIcoExtractor: Tool = {
  id         : "official-ico-extractor",
  uid        : "uid-official-ico-extractor",
  name       : ".ico/.icon Extractor",
  namespace  : "🖼️ Image Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Extract all embedded icon sizes from an ICO file and export each layer as a PNG image using ImageMagick WASM. Preview every extracted icon size and download files individually or all at once.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
