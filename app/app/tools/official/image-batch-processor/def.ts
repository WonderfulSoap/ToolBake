import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolImageBatchProcessor: Tool = {
  id         : "official-image-batch-processor",
  uid        : "uid-official-image-batch-processor",
  name       : "Batch Image Processor",
  namespace  : "🖼️ Image Tools",
  category   : "📐 Processor",
  isOfficial : true,
  description: "Batch process images directly in the browser with ImageMagick WASM. Crop, convert formats, flip, rotate, and resize multiple images at once with an interactive preview. Use the draggable crop box to precisely select regions. Supports JPEG, PNG, WebP, GIF, BMP, and TIFF with adjustable quality and compression options.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
