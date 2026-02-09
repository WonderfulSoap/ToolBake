import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolIntegerBaseConverter: Tool = {
  id         : "official-integer-base-converter",
  uid        : "uid-official-integer-base-converter",
  name       : "Integer ↔ Base Converter",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Professional Multi-Base Converter for real-time bidirectional sync between Binary, Hex, Base 62, and custom bases (2-62). Powered by BigInt for high-precision large number calculations, this developer-friendly tool offers instant validation and smart case handling for accurate numeric system conversion.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
