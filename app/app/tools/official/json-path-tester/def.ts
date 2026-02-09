import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJsonPathTester: Tool = {
  id         : "official-json-path-tester",
  uid        : "uid-official-json-path-tester",
  name       : "JSON Data Extractor/JSON Path Tester",
  namespace  : "🛠️ Devt Tools",
  category   : "🗂️ Data Process",
  isOfficial : true,
  description: "Test and evaluate JSONPath expressions against your JSON data. Enter a JSONPath query and paste your JSON to see the filtered results instantly.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
