import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

/**
 * Official tool for batch converting image formats using ImageMagick WASM.
 * Supports a wide range of formats with format-specific options dynamically rendered via LabelInput.
 */
export const OfficialToolImageFormatConverter: Tool = {
  id         : "official-image-format-converter",
  uid        : "uid-official-image-format-converter",
  name       : "Image Batch Format Converter",
  namespace  : "🖼️ Image Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Batch convert images between various formats (JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, ICO, PSD, TGA, PCX, PNM, EXR, HDR) using ImageMagick WASM. Dynamic format-specific options let you fine-tune quality, compression, and color settings for each target format.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
