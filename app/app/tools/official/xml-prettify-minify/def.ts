import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolXmlPrettifyMinify: Tool = {
  id         : "official-xml-prettify-minify",
  uid        : "uid-official-xml-prettify-minify",
  name       : "XML Prettify/Minify",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Prettify or minify XML instantly with a browser-based formatter. Paste XML, select the mode, and get clean indented output or compact minified markup for config files, feeds, and payloads.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
