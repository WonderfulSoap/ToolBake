import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJsonXmlYamlTomlConverter: Tool = {
  id         : "official-json-xml-yaml-toml-converter",
  uid        : "uid-official-json-xml-yaml-toml-converter",
  name       : "JSON/YAML/TOML/XML Converter",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Convert between JSON, YAML, TOML, and XML instantly with this in-browser data formatter. Paste any format to see normalized outputs in the other formats with fast parsing and clean pretty-printing for configuration files and API payloads.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
