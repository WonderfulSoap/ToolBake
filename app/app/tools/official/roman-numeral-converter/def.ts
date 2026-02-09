import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolRomanNumeralConverter: Tool = {
  id         : "official-roman-numeral-converter",
  uid        : "uid-official-roman-numeral-converter",
  name       : "Roman Numeral Converter",
  namespace  : "🏠 Life",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Instant bi-directional converter for Arabic numbers and Roman numerals. Convert values from 1-3999 accurately with real-time validation. Simple, fast, and free online tool for students, historians, and designers.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
