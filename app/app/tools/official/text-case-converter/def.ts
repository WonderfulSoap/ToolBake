import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolTextCaseConverter: Tool = {
  id         : "official-text-case-converter",
  uid        : "uid-official-text-case-converter",
  name       : "Text Case Converter",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Transform your text into any naming convention with our lightning-fast Online Case Converter. Designed for developers and content creators, this tool allows you to instantly switch between camelCase, PascalCase, snake_case, kebab-case (param-case), and CONSTANT_CASE.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
