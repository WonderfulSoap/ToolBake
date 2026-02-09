import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolArchiveFormatConverter: Tool = {
  id         : "official-archive-format-converter",
  uid        : "uid-official-archive-format-converter",
  name       : "Archive Format Converter",
  namespace  : "🗄️ Archive Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Convert ZIP, 7Z, and TAR archives directly in the browser. Upload a compressed file, choose an output format, and repackage it with a 7-Zip worker using an optional password.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
