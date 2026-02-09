import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolRandomPortGenerator: Tool = {
  id         : "official-random-port-generator",
  uid        : "uid-official-random-port-generator",
  name       : "Random Port Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🌐 Network Tools",
  isOfficial : true,
  description: "Generate a random network port for quick testing, service setup, or local development, with one-click refresh and a built-in reference of common ports and port ranges.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
