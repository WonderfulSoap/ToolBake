import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

/**
 * Official tool for converting SVG files to raster image formats (PNG, JPEG, WebP, BMP).
 * Uses browser Canvas API for high-quality rendering with customizable output dimensions.
 */
export const OfficialToolSvgConverter: Tool = {
  id         : "official-svg-converter",
  uid        : "uid-official-svg-converter",
  name       : "SVG to Other Format Converter",
  namespace  : "🖼️ Image Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert SVG vector graphics to PNG, JPEG, WebP, or BMP raster images using browser Canvas API. Customize output dimensions with pixel-perfect scaling, maintain aspect ratio, or scale by percentage. Perfect for exporting SVG icons, logos, and illustrations at any resolution.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
