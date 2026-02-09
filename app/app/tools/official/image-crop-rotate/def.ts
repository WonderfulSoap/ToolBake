import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolImageCropRotate: Tool = {
  id         : "official-image-crop-rotate",
  uid        : "uid-official-image-crop-rotate",
  name       : "Image Batch Crop & Rotate",
  namespace  : "🖼️ Image Tools",
  category   : "📐 Processor",
  isOfficial : true,
  description: "Batch crop and rotate images with an interactive visual editor. Upload multiple images and process them all with the same settings. Adjust rotation angle and select precise crop areas with drag-and-drop controls. Powered by ImageMagick WASM for high-quality browser-based image processing. Download individual images or all at once.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
