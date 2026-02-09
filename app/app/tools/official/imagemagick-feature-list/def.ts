import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolImagemagickFeatureList: Tool = {
  id         : "official-imagemagick-feature-list",
  uid        : "uid-official-imagemagick-feature-list",
  name       : "ImageMagick.wasm Feature List",
  namespace  : "🖼️ Image Tools",
  category   : "⚡ ImageMagick.wasm",
  isOfficial : true,
  description: "Comprehensive scanner for ImageMagick WASM library capabilities. Discover all available methods, properties, supported image formats, and enums to understand what features are actually available in the WASM build. Essential reference tool for developers working with ImageMagick WASM who need to verify feature availability like gamma correction, filters, and color adjustments.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};

