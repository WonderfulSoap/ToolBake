import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolQrcodeGenerator: Tool = {
  id         : "official-qrcode-generator",
  uid        : "uid-official-qrcode-generator",
  name       : "QR Code Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Generate QR codes from text or URLs with custom foreground/background colors and error correction levels. Preview the QR image instantly and download a PNG for sharing or printing.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
