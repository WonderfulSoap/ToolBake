import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolLabelDynamicDemo: Tool = {
  id         : "official-label-dynamic-demo",
  uid        : "uid-official-label-dynamic-demo",
  name       : "Label Dynamic Demo",
  namespace  : "🐭 Demo/Showcase",
  category   : "🐕 LabelInput",
  isOfficial : true,
  description: "Demonstrates LabelInput's dynamic interaction capabilities including afterHook event binding, data-* attribute collection, and state persistence across handler executions.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
