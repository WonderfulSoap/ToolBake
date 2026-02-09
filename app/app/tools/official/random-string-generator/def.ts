import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolRandomStringGenerator: Tool = {
  id         : "official-random-string-generator",
  uid        : "uid-official-random-string-generator",
  name       : "Random String/Password Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🎲 Generator",
  isOfficial : true,
  description: "Generate random strings with customizable options such as length, character sets (uppercase, lowercase, numbers, symbols), and exclusion of ambiguous characters. Perfect for creating secure passwords, unique identifiers, and test data.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
