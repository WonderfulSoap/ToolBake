import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolImageBatchResizer: Tool = {
  id         : "official-image-batch-resizer",
  uid        : "uid-official-image-batch-resizer",
  name       : "Image Batch Resizer",
  namespace  : "🖼️ Image Tools",
  category   : "📐 Processor",
  isOfficial : true,
  description: "Batch resize multiple images to exact pixel dimensions or by scale percentage directly in the browser using ImageMagick WASM. Lock the aspect ratio to the first image and apply it uniformly across all uploads. Supports PNG, JPEG, WebP, GIF, BMP, and TIFF output with high-quality Lanczos resampling and one-click bulk download.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
