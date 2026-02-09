import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolCsvToJsonConverter: Tool = {
  id         : "official-csv-to-json-converter",
  uid        : "uid-official-csv-to-json-converter",
  name       : "CSV to JSON Converter",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Convert CSV to JSON with support for row or column layouts, optional headers, custom delimiters, and multiple JSON output formats. Paste CSV data to instantly generate structured JSON for datasets, exports, and APIs.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
