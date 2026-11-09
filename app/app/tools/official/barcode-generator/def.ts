import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolBarcodeGenerator: Tool = {
  id         : "official-barcode-generator",
  uid        : "uid-official-barcode-generator",
  name       : "Barcode Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Create Code 128, Code 39, Code 93, EAN, UPC, ITF, and Codabar barcodes locally in your browser. Validate values and checksums, customize bar width, height, and captions, preview instantly, and download PNG or SVG images.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
