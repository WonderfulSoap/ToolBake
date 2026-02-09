import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolImagemagickImageDiff: Tool = {
  id         : "official-imagemagick-image-diff",
  uid        : "uid-official-imagemagick-image-diff",
  name       : "Image Diff Compare",
  namespace  : "🖼️ Image Tools",
  category   : "🔍 Diff/Compare",
  isOfficial : true,
  description: "Compare two images in the browser with ImageMagick WASM, preview each upload side by side, and generate a diff image plus distortion report for quick visual inspection.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
