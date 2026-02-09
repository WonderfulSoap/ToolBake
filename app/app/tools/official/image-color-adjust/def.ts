import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolImageFilterLab: Tool = {
  id         : "official-image-filter-lab",
  uid        : "uid-official-image-filter-lab",
  name       : "Image Batch Filter Lab",
  namespace  : "🖼️ Image Tools",
  category   : "✨ Filter/Color Adjustment",
  isOfficial : true,
  description: "Batch adjust image colors with real-time preview. Upload multiple images and fine-tune brightness, contrast, saturation, hue, gamma, sharpness, and blur. Apply professional filter presets including grayscale, sepia, charcoal, edge detection, emboss, and solarize effects. Powered by ImageMagick WASM for high-quality browser-based color grading. All images processed with the same settings for consistent results.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
