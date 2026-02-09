import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolImageToIcoMaker: Tool = {
  id         : "official-image-to-ico-maker",
  uid        : "uid-official-ico-maker",
  name       : ".icon/.icon Maker",
  namespace  : "🖼️ Image Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert PNG, JPG, WebP, BMP, and other image formats to Windows ICO files with ImageMagick WASM. Generate a multi-size icon in one click and customize the icon size set with a comma-separated list.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
