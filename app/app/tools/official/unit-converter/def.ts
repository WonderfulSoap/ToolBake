import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolUnitConverter: Tool = {
  id         : "official-unit-converter",
  uid        : "uid-official-unit-converter",
  name       : "Unit Converter",
  namespace  : "🏠 Life",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Convert weight, length, volume, area, speed, temperature, and energy units in one place. Edit any field to instantly update the rest of the group with precise, browser-based calculations.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
