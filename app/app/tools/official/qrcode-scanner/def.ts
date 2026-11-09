import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolQrcodeScanner: Tool = {
  id         : "official-qrcode-scanner",
  uid        : "uid-official-qrcode-scanner",
  name       : "QR Code Scanner",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Scan QR codes from uploaded, dropped, or pasted images locally in your browser. View decoded text, Hex, Base64, and segment details, select legacy character encodings, and download binary payloads without data loss.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
