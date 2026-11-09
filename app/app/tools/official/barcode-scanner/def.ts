import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolBarcodeScanner: Tool = {
  id         : "official-barcode-scanner",
  uid        : "uid-official-barcode-scanner",
  name       : "Barcode Scanner",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Decode one-dimensional barcodes from uploaded, dropped, or pasted images locally in your browser. Automatically detect Code 128, Code 39, Code 93, EAN, UPC, ITF, and Codabar, with decoded text and detailed scan results.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
