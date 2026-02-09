import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolRawHtmlScriptShowcase: Tool = {
  id         : "official-raw-html-script-showcase",
  uid        : "uid-official-raw-html-script-showcase",
  name       : "Raw HTML Script Showcase",
  namespace  : "🐭 Demo/Showcase",
  category   : "🐕 RawHtmlInput",
  isOfficial : true,
  description: "Demonstrates RawHtmlInput rendering unsanitized HTML with inline script execution, and syncing data-* state back into handler output.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
