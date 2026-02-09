import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJsonToCsvConverter: Tool = {
  id         : "official-json-to-csv-converter",
  uid        : "uid-official-json-to-csv-converter",
  name       : "JSON to CSV Converter",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Convert JSON arrays or column objects into CSV with custom layouts, headers, delimiters, and JSONPath filtering. Paste JSON data to generate CSV for exports, spreadsheets, and data pipelines.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
