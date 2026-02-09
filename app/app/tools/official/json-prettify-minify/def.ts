import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJsonPrettifyMinify: Tool = {
  id         : "official-json-prettify-minify",
  uid        : "uid-official-json-prettify-minify",
  name       : "JSON Prettify/Minify",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Prettify or minify JSON instantly with a clean browser-based formatter. Paste JSON, choose the mode, and get readable indentation or compact output ready for APIs, config files, and payload optimization.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
