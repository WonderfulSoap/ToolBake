import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import { uiWidgets } from "./uiWidgets";

export const OfficialToolJsonataTester: Tool = {
  id         : "official-jsonata-tester",
  uid        : "uid-official-jsonata-tester",
  name       : "JSON Query Transformer/JSONata Tester",
  namespace  : "🛠️ Devt Tools",
  category   : "🗂️ Data Process",
  isOfficial : true,
  description: "Evaluate JSONata expressions against your JSON data. A lightweight query and transformation language for JSON data.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
