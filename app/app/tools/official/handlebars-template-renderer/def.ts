import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJsonDataTemplateRenderer: Tool = {
  id         : "official-json-data-template-renderer",
  uid        : "uid-official-json-data-template-renderer",
  name       : "JSON Data Template Renderer",
  namespace  : "🛠️ Devt Tools",
  category   : "🗂️ Data Process ",
  isOfficial : true,
  description: "Render JSON data into Handlebars templates instantly with a live preview, perfect for drafting emails, reports, and structured text snippets in the browser.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
